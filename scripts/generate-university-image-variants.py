from __future__ import annotations

from pathlib import Path
import sys

try:
    from PIL import Image, ImageOps, ImageFilter
except ImportError as exc:
    raise SystemExit(
        "Pillow is required for image generation. Install it locally with: python -m pip install Pillow"
    ) from exc


REPO_ROOT = Path(__file__).resolve().parents[1]
ASSETS_ROOT = REPO_ROOT / "backend" / "data" / "university_assets"
THUMBNAILS = ASSETS_ROOT / "thumbnails"
THUMBNAILS_MEDIUM = ASSETS_ROOT / "thumbnails-medium"
THUMBNAILS_SMALL = ASSETS_ROOT / "thumbnails-small"

FULL_SIZE = (1600, 900)
MEDIUM_SIZE = (960, 540)
SMALL_SIZE = (640, 360)

FULL_HARD_LIMIT = 800 * 1024
FULL_WEBP_LIMIT = 900 * 1024
MEDIUM_WEBP_LIMIT = 360 * 1024
SMALL_WEBP_LIMIT = 180 * 1024


def center_crop_resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = ImageOps.exif_transpose(image).convert("RGB")
    target_w, target_h = size
    source_w, source_h = source.size
    target_ratio = target_w / target_h
    source_ratio = source_w / source_h

    if source_ratio > target_ratio:
        crop_w = int(round(source_h * target_ratio))
        left = max(0, (source_w - crop_w) // 2)
        box = (left, 0, left + crop_w, source_h)
    else:
        crop_h = int(round(source_w / target_ratio))
        top = max(0, (source_h - crop_h) // 2)
        box = (0, top, source_w, top + crop_h)

    cropped = source.crop(box)
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    return resized.filter(ImageFilter.UnsharpMask(radius=0.8, percent=70, threshold=3))


def save_jpeg(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="JPEG", quality=quality, optimize=True, progressive=True)


def save_jpeg_under_limit(image: Image.Image, path: Path, start_quality: int, max_bytes: int) -> None:
    for quality in range(start_quality, 74, -2):
        save_jpeg(image, path, quality=quality)
        if path.stat().st_size <= max_bytes:
            return
    save_jpeg(image, path, quality=74)


def save_webp(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=quality, method=6)


def save_webp_under_limit(image: Image.Image, path: Path, start_quality: int, max_bytes: int) -> None:
    for quality in range(start_quality, 67, -2):
        save_webp(image, path, quality=quality)
        if path.stat().st_size <= max_bytes:
            return
    save_webp(image, path, quality=68)


def should_rewrite_full(path: Path, image: Image.Image) -> bool:
    if image.size != FULL_SIZE:
        return True
    return path.stat().st_size > FULL_HARD_LIMIT


def main() -> int:
    if not THUMBNAILS.exists():
        print(f"Missing thumbnail directory: {THUMBNAILS}", file=sys.stderr)
        return 1

    THUMBNAILS_MEDIUM.mkdir(parents=True, exist_ok=True)
    THUMBNAILS_SMALL.mkdir(parents=True, exist_ok=True)

    rewritten_full = 0
    generated_medium = 0
    generated_small = 0
    generated_webp = 0
    warnings: list[str] = []

    for source_path in sorted(THUMBNAILS.glob("*.jpg")):
        with Image.open(source_path) as image:
            original_size = image.size
            rewrite_full = should_rewrite_full(source_path, image)
            if image.width < 1100 or image.height < 620:
                warnings.append(
                    f"{source_path.name}: low source resolution {image.width}x{image.height}; replace with an official higher-res source"
                )
            full_image = center_crop_resize(image, FULL_SIZE)

        if rewrite_full:
            save_jpeg_under_limit(full_image, source_path, start_quality=88, max_bytes=FULL_HARD_LIMIT)
            rewritten_full += 1

        medium = full_image.resize(MEDIUM_SIZE, Image.Resampling.LANCZOS).filter(
            ImageFilter.UnsharpMask(radius=0.6, percent=55, threshold=3)
        )
        small = full_image.resize(SMALL_SIZE, Image.Resampling.LANCZOS).filter(
            ImageFilter.UnsharpMask(radius=0.5, percent=45, threshold=3)
        )

        save_jpeg(medium, THUMBNAILS_MEDIUM / source_path.name, quality=84)
        save_jpeg(small, THUMBNAILS_SMALL / source_path.name, quality=82)
        webp_name = source_path.with_suffix(".webp").name
        save_webp_under_limit(
            full_image,
            THUMBNAILS / webp_name,
            start_quality=86,
            max_bytes=FULL_WEBP_LIMIT,
        )
        save_webp_under_limit(
            medium,
            THUMBNAILS_MEDIUM / webp_name,
            start_quality=84,
            max_bytes=MEDIUM_WEBP_LIMIT,
        )
        save_webp_under_limit(
            small,
            THUMBNAILS_SMALL / webp_name,
            start_quality=82,
            max_bytes=SMALL_WEBP_LIMIT,
        )
        generated_medium += 1
        generated_small += 1
        generated_webp += 3

        if original_size[0] < FULL_SIZE[0] or original_size[1] < FULL_SIZE[1]:
            warnings.append(
                f"{source_path.name}: normalized from {original_size[0]}x{original_size[1]} to 1600x900; check detail-page sharpness"
            )

    print(
        f"Generated {generated_medium} medium, {generated_small} small, and {generated_webp} WebP thumbnails; rewrote {rewritten_full} full thumbnails."
    )
    if warnings:
        print("\n".join(f"warning: {item}" for item in warnings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
