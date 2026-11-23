"""Generate frontend/javascript/data/region-currency.js.

Usage: download into one folder under the current working directory Unicode CLDR
`cldr-json/cldr-core/supplemental/currencyData.json` and the IANA tz database
`zone.tab` and `backward`, then run:
  python -I scripts/generate-region-currency.py <folder>
"""
import json
import pathlib
import re
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_FILE = REPO_ROOT / "frontend" / "javascript" / "data" / "region-currency.js"


def _resolve_input_dir(raw_arg: str) -> pathlib.Path:
    base = pathlib.Path.cwd().resolve()
    candidate = (base / raw_arg).resolve(strict=True)
    if not candidate.is_relative_to(base) or not candidate.is_dir():
        raise SystemExit(f"Input directory must stay inside {base}")
    return candidate


def _read_source_file(src_dir: pathlib.Path, filename: str) -> str:
    file_path = (src_dir / filename).resolve(strict=True)
    if not file_path.is_relative_to(src_dir) or not file_path.is_file():
        raise SystemExit(f"Source file must stay inside {src_dir}: {filename}")
    return file_path.read_text(encoding="utf-8")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python -I scripts/generate-region-currency.py <folder>")
    src_dir = _resolve_input_dir(sys.argv[1])
    cldr = json.loads(_read_source_file(src_dir, "currencyData.json"))
    regions = cldr["supplemental"]["currencyData"]["region"]
    countries: dict[str, str] = {}
    for cc, entries in regions.items():
        if len(cc) != 2 or not cc.isalpha():
            continue
        current = []
        for entry in entries:
            for code, info in entry.items():
                if "_to" in info or info.get("_tender") == "false":
                    continue
                current.append((info.get("_from", ""), code))
        if current:
            countries[cc] = sorted(current)[-1][1]
    zones: dict[str, str] = {}
    for line in _read_source_file(src_dir, "zone.tab").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        cc, _coords, tz = line.split("\t")[:3]
        zones[tz] = cc
    for line in _read_source_file(src_dir, "backward").splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[0] == "Link" and parts[1] in zones and parts[2] not in zones:
            zones[parts[2]] = zones[parts[1]]
    raw_version = str(cldr["supplemental"]["version"]["_cldrVersion"]).strip()
    if not re.fullmatch(r"\d+(?:\.\d+)*", raw_version):
        raise SystemExit(f"Unexpected CLDR version: {raw_version!r}")
    body = (
        "// Generated from Unicode CLDR " + raw_version + " supplemental currencyData (each region's current tender currency) and the\n"
        "// IANA tz database zone.tab and backward links (each time zone's country). Regenerate from those sources; do not edit by hand.\n"
        "export const COUNTRY_CURRENCY = " + json.dumps(dict(sorted(countries.items())), separators=(",", ":")) + ";\n"
        "export const TIME_ZONE_COUNTRY = " + json.dumps(dict(sorted(zones.items())), separators=(",", ":")) + ";\n"
    )
    with open(OUT_FILE, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(body)
    print(
        len(countries),
        len(zones),
        countries.get("KZ"),
        countries.get("SA"),
        countries.get("AE"),
        zones.get("Asia/Almaty"),
        zones.get("Asia/Calcutta"),
        zones.get("Asia/Riyadh"),
    )


if __name__ == "__main__":
    main()
