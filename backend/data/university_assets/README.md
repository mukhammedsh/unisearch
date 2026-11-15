# University Media Assets

This directory contains visual assets (logos and campus cover thumbnails) for universities indexed in the UniSearch platform.

## Directory Structure

- `logos/`: Master square university logos (PNG format, 1:1 aspect ratio).
- `logos-small/`: Optimized mobile/compact logo variants (PNG format, 1:1 aspect ratio).
- `thumbnails/`: Master university campus cover images (1600x900, 16:9 aspect ratio, JPG and WebP formats).
- `thumbnails-medium/`: Tablet/preview variants (960x540, 16:9 aspect ratio, JPG and WebP formats).
- `thumbnails-small/`: Mobile/list variants (640x360, 16:9 aspect ratio, JPG and WebP formats).

## Technical Specifications

- **Logos**: PNG format with transparent background where appropriate, square 1:1 aspect ratio.
- **Thumbnails**: 16:9 aspect ratio (`1600x900` full, `960x540` medium, `640x360` small). Must pass `npm run audit:images`.
- Variant generation script: `scripts/generate-university-image-variants.py`.

## Legal Status & Intellectual Property Notice

1. **Trademarks & Logos**:
   - University names, crests, and emblems are registered or unregistered trademarks of their respective academic institutions.
   - They are used on the UniSearch platform only to identify the institution a catalog entry refers to (nominative use), in a non-commercial educational project.
2. **Campus Photography**:
   - Campus photographs remain the property of their respective photographers, copyright holders, or academic institutions.
   - Photographs are copyrighted works; nominative trademark use does not cover them. Add or replace a photograph only from a source that permits reuse: a freely licensed file (for example on Wikimedia Commons under CC0, CC BY, or CC BY-SA) or press or media material the university publishes for reuse. Do not take photographs from news sites, photo stocks, or social media.
   - With every new or replaced photograph, record the university, file name, source page URL, author, and license in the pull request description, and keep any attribution the license requires.
3. **Exclusion from the MIT License**:
   - The UniSearch software MIT License (`LICENSE` at root) applies to the project source code and original software design.
   - It does **not** grant or convey any rights to third-party university trademarks, logos, or campus photographs.

## Notice & Takedown Procedure

If you are an authorized university representative, photographer, or intellectual property rights holder and wish to:
- request attribution credit for a photograph,
- provide an official updated logo or photo, or
- request the immediate removal or replacement of any image,

Please contact the project maintainers at **unisearch@inbox.ru** or open an issue on the UniSearch GitHub repository. We review each request and reply by email; a disputed asset is removed while the request is reviewed.
