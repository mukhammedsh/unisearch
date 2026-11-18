# University Media Assets

This directory contains credited campus photographs for the UniSearch catalog.

## Directory Structure

- `thumbnails/`: Master university campus cover images (1600x900, 16:9 aspect ratio, JPG and WebP formats).
- `thumbnails-medium/`: Tablet/preview variants (960x540, 16:9 aspect ratio, JPG and WebP formats).
- `thumbnails-small/`: Mobile/list variants (640x360, 16:9 aspect ratio, JPG and WebP formats).
- `gallery/<university-id>/`: Credited JPEGs for future use, including former covers and other views of the campus. The current cover already lives in `thumbnails/` and should be the first photo in a future gallery.

## Technical Specifications

- **Thumbnails**: 16:9 aspect ratio (`1600x900` full, `960x540` medium, `640x360` small). Must pass `npm run audit:images`.
- Variant generation script: `scripts/generate-university-image-variants.py`.

## Legal Status & Intellectual Property Notice

1. **Trademarks & Logos**:
   - University names, crests, and emblems are registered or unregistered trademarks of their respective academic institutions.
   - Public listings identify institutions by name and campus photography. UniSearch does not publish university logos.
2. **Campus Photography**:
   - Campus photographs remain the property of their respective photographers, copyright holders, or academic institutions.
   - Photographs are copyrighted works; nominative trademark use does not cover them. Every campus photograph comes from a freely licensed file on Wikimedia Commons (CC0, public domain, CC BY or CC BY-SA). Do not take photographs from search engines, news sites, photo stocks, or social media.
   - `credits.json` records each photograph's Commons file page (`source_url`), `author`, `license`, `license_url`, and whether it was cropped (`modified`). The university page and comparison headers show this credit below the image with a link to the file page, as the CC licenses require. `npm run audit:images` fails when a university has no credit, a non-Commons source, or a license outside that list.
   - Choose a cover with a recognizable campus building visible at card size. Check the 16:9 crop at 640 px and use a source with enough pixels to produce 1600×900 without enlarging it. Verify the source, author and license on the individual Commons file page, including any conditions on photographing the subject itself.
   - To add or replace a photograph: pick a landscape file at least 1600 px wide on Commons, save its 1920 px rendition as `thumbnails/<university-id>.jpg`, add its entry to `credits.json` from the file page, then run `scripts/generate-university-image-variants.py` and `npm run audit:images`.
   - Keep other useful campus views under `gallery/<university-id>/<photo-name>.jpg`. Record the same credit fields under `gallery.<university-id>.<photo-name>.jpg` in `credits.json`, using the full filename as the key. Keep the author, file link, license and edit notice with each image when displaying it.
3. **Exclusion from the MIT License**:
   - The UniSearch software MIT License (`LICENSE` at root) applies to the project source code and original software design.
   - It does **not** grant or convey any rights to third-party university trademarks, logos, or campus photographs.

## Notice & Takedown Procedure

If you are an authorized university representative, photographer, or intellectual property rights holder and wish to:
- request attribution credit for a photograph,
- provide an official updated logo or photo, or
- request the immediate removal or replacement of any image,

Please contact the project maintainers at **unisearch.sup@gmail.com** or open an issue on the UniSearch GitHub repository. We review each request and reply by email; a disputed asset is removed while the request is reviewed.
