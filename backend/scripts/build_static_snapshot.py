"""Build a static JSON snapshot of public catalog data for CDN/Firebase Hosting delivery."""

from __future__ import annotations

import argparse
import datetime
import json
import shutil
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "frontend" / "snapshot"
SNAPSHOT_SCHEMA_VERSION = "static-snapshot-1.0"
LANGUAGES = ("eng", "rus", "kaz")
REVIEWED_LEVELS = ("preparation", "undergraduate", "masters", "doctoral", "professional")


def _write_json(path: Path, payload: object) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.write_bytes(encoded)
    return len(encoded)


def _compact_search_fields(meta_row: dict[str, Any], lang: str) -> dict[str, Any]:
    suffix = "kaz" if lang == "kaz" else "rus" if lang == "rus" else ""
    names = [meta_row.get("name", "")]
    cities = [meta_row.get("city", "")]
    countries = [meta_row.get("country", "")]
    states = [meta_row.get("state", "")]
    tags = list(meta_row.get("tags") or [])
    majors = list(meta_row.get("major_exact") or [])
    if suffix:
        names.append(meta_row.get(f"name_{suffix}", ""))
        cities.append(meta_row.get(f"city_{suffix}", ""))
        countries.append(meta_row.get(f"country_{suffix}", ""))
        states.append(meta_row.get(f"state_{suffix}", ""))
        tags.extend(meta_row.get(f"tags_{suffix}") or [])
        majors.extend(meta_row.get(f"major_exact_{suffix}") or [])

    def dedup(values: list[object]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for raw in values:
            text = str(raw or "").strip().lower()
            if text and text not in seen:
                seen.add(text)
                out.append(text)
        return out

    return {
        "names": dedup(names),
        "cities": dedup(cities),
        "countries": dedup(countries),
        "states": dedup(states),
        "tags": dedup(tags),
        "majors": dedup(majors),
        "programs": dedup(list(meta_row.get("program_names") or [])[:30]),
    }


def _reviewed_costs_by_level(institution_id: str, study_levels: list[str], admissions_catalog: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for level in REVIEWED_LEVELS:
        if level not in study_levels:
            continue
        out[level] = admissions_catalog.catalog_costs(institution_id, study_level=level, study_mode="any")
    return out


def build_static_snapshot(output_dir: Path = DEFAULT_OUTPUT_DIR, *, include_assets: bool = False) -> dict[str, Any]:
    """Generate static public JSON files from the backend services without any profile data."""
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    from app.core.paths import UNIVERSITY_ASSETS_DIR
    from app.core.version import APP_VERSION
    from app.services import admissions_catalog, admissions_editorial
    from app.services import exams as exams_service
    from app.services import languages as languages_service
    from app.services import universities as uni_service
    from app.services.university_costs import _catalog_costs

    target = Path(output_dir).resolve()
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True, exist_ok=True)

    universities_list, meta_list = uni_service.get_universities_with_meta()
    admissions_revision = admissions_catalog.get_revision()
    reviewed_ids = sorted(admissions_catalog.INSTITUTION_IDS)

    exams_service.ensure_exams_cache()
    total_bytes = 0
    file_count = 0

    def emit(relpath: str, payload: object) -> None:
        nonlocal total_bytes, file_count
        total_bytes += _write_json(target / relpath, payload)
        file_count += 1

    emit("locations.json", uni_service.get_locations())
    emit("exams-config.json", exams_service.EXAMS_CONFIG)
    emit("languages-config.json", languages_service.get_languages_config())

    for lang in LANGUAGES:
        catalog_items: list[dict[str, Any]] = []
        for uni, meta in zip(universities_list, meta_list, strict=True):
            uid = str(uni.get("id") or "")
            is_reviewed = uid in admissions_catalog.INSTITUTION_IDS
            uni_with_costs = {
                **uni,
                "catalog_costs": admissions_catalog.catalog_costs(uid, study_mode="any")
                if is_reviewed
                else _catalog_costs(uni, "any"),
            }
            card = uni_service.to_university_card(uni_with_costs, format_preference="any", search_lang=lang)
            map_point = uni_service.to_university_map_point(uni_with_costs, search_lang=lang)
            study_levels = sorted({str(x).strip().lower() for x in (meta.get("study_levels") or []) if str(x).strip()})
            formats = sorted({str(x).strip().lower() for x in (meta.get("formats") or []) if str(x).strip()})
            entry: dict[str, Any] = {
                "card": card,
                "map_label": str(map_point.get("map_label") or "") if isinstance(map_point, dict) else "",
                "meta": {
                    "country": meta.get("country", ""),
                    "city": meta.get("city", ""),
                    "state": meta.get("state", ""),
                    "study_levels": study_levels,
                    "formats": formats,
                    "has_grant": meta.get("has_grant"),
                    "has_paid": meta.get("has_paid"),
                    "rank_num": meta.get("rank_num", 999999.0),
                    "acceptance_rate": meta.get("acceptance_rate"),
                    "search": _compact_search_fields(meta, lang),
                },
            }
            if is_reviewed:
                entry["costs_by_level"] = _reviewed_costs_by_level(uid, study_levels, admissions_catalog)
            catalog_items.append(entry)

            detail = uni_service.get_university_by_id(uid, search_lang=lang, localized=True)
            if detail is not None:
                emit(f"universities/{lang}/{uid}.json", detail)

        emit(
            f"catalog/{lang}.json",
            {
                "schema_version": SNAPSHOT_SCHEMA_VERSION,
                "lang": lang,
                "admissions_revision": admissions_revision,
                "total": len(catalog_items),
                "items": catalog_items,
            },
        )
        emit(f"translations/{lang}.json", uni_service.get_university_translation_bundle(lang))

    for uid in reviewed_ids:
        raw_options = admissions_catalog.list_study_options(uid, page=1, limit=10_000)
        public_options = admissions_editorial.strip_applicant_payload(
            admissions_catalog.public_study_options(raw_options)
        )
        for option in public_options.get("items", []):
            title = str(option.get("title") or "")
            option["major_tags"] = sorted(admissions_catalog._title_major_tags(title))
        emit(f"admissions/{uid}/study-options.json", public_options)

    assets_included = False
    if include_assets and UNIVERSITY_ASSETS_DIR.is_dir():
        shutil.copytree(UNIVERSITY_ASSETS_DIR, target / "assets", dirs_exist_ok=True)
        assets_included = True

    manifest = {
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "app_version": APP_VERSION,
        "admissions_revision": admissions_revision,
        "languages": list(LANGUAGES),
        "reviewed_ids": reviewed_ids,
        "assets_included": assets_included,
        "generated_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    emit("manifest.json", manifest)
    return {
        "output_dir": str(target),
        "files": file_count,
        "json_bytes": total_bytes,
        "assets_included": assets_included,
        "manifest": manifest,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--include-assets",
        action="store_true",
        help="Copy university_assets (campus covers, gallery, credits.json) into the snapshot.",
    )
    args = parser.parse_args(argv)
    summary = build_static_snapshot(args.output_dir, include_assets=args.include_assets)
    print(
        f"[build-static-snapshot] wrote {summary['files']} JSON files "
        f"({summary['json_bytes'] / 1024:.1f} KB), assets_included={summary['assets_included']} "
        f"-> {summary['output_dir']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
