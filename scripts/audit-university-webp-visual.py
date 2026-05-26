from __future__ import annotations

from pathlib import Path
import sys

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError as exc:
    raise SystemExit(
        "Pillow is required for visual image auditing. Install dev dependencies with: pip install -r backend/requirements-dev.txt"
    ) from exc


REPO_ROOT = Path(__file__).resolve().parents[1]
ASSETS_ROOT = REPO_ROOT / "backend" / "data" / "university_assets"
FOLDERS = ("thumbnails", "thumbnails-medium", "thumbnails-small")
MAX_MEAN_ABSOLUTE_ERROR = 18.0
MAX_RMS_ERROR = 28.0


def compare_pair(jpg_path: Path, webp_path: Path) -> tuple[float, float]:
    with Image.open(jpg_path) as jpg_image, Image.open(webp_path) as webp_image:
        jpg = jpg_image.convert("RGB")
        webp = webp_image.convert("RGB")
        if jpg.size != webp.size:
            raise ValueError(f"size mismatch: JPG {jpg.size[0]}x{jpg.size[1]}, WebP {webp.size[0]}x{webp.size[1]}")

        diff = ImageChops.difference(jpg, webp)
        stat = ImageStat.Stat(diff)
        mean_absolute_error = sum(stat.mean) / 3
        rms_error = (sum(value * value for value in stat.rms) / 3) ** 0.5
        return mean_absolute_error, rms_error


def main() -> int:
    errors: list[str] = []
    worst: list[tuple[float, float, str]] = []
    checked = 0

    for folder in FOLDERS:
        folder_path = ASSETS_ROOT / folder
        for jpg_path in sorted(folder_path.glob("*.jpg")):
            webp_path = jpg_path.with_suffix(".webp")
            label = f"{folder}/{jpg_path.stem}"

            if not webp_path.exists():
                errors.append(f"{label}: missing WebP pair")
                continue

            try:
                mae, rms = compare_pair(jpg_path, webp_path)
            except Exception as exc:
                errors.append(f"{label}: cannot decode/compare WebP pair: {exc}")
                continue

            checked += 1
            worst.append((mae, rms, label))
            if mae > MAX_MEAN_ABSOLUTE_ERROR or rms > MAX_RMS_ERROR:
                errors.append(
                    f"{label}: WebP differs too much from JPG fallback "
                    f"(MAE {mae:.2f}, RMS {rms:.2f}; limits {MAX_MEAN_ABSOLUTE_ERROR:.2f}/{MAX_RMS_ERROR:.2f})"
                )

    if errors:
        print("\n".join(f"error: {item}" for item in errors), file=sys.stderr)
        return 1

    worst.sort(reverse=True)
    preview = ", ".join(f"{label} MAE {mae:.2f}/RMS {rms:.2f}" for mae, rms, label in worst[:3])
    print(f"WebP visual audit passed for {checked} JPG/WebP pairs.")
    if preview:
        print(f"Worst pairs: {preview}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
