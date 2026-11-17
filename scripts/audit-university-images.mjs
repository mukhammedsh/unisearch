import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const dataPath = path.join(repoRoot, "backend", "data", "universities.json");
const assetsRoot = path.join(repoRoot, "backend", "data", "university_assets");

const IMAGE_RULES = [
  {
    folder: "thumbnails",
    ext: ".jpg",
    width: 1600,
    height: 900,
    maxBytes: 800 * 1024,
  },
  {
    folder: "thumbnails",
    ext: ".webp",
    width: 1600,
    height: 900,
    maxBytes: 700 * 1024,
  },
  {
    folder: "thumbnails-medium",
    ext: ".jpg",
    width: 960,
    height: 540,
    maxBytes: 350 * 1024,
  },
  {
    folder: "thumbnails-medium",
    ext: ".webp",
    width: 960,
    height: 540,
    maxBytes: 240 * 1024,
  },
  {
    folder: "thumbnails-small",
    ext: ".jpg",
    width: 640,
    height: 360,
    maxBytes: 200 * 1024,
  },
  {
    folder: "thumbnails-small",
    ext: ".webp",
    width: 640,
    height: 360,
    maxBytes: 105 * 1024,
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readPngSize(buffer) {
  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 1, 4) !== "PNG" ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) break;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && size >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += size;
  }
  return null;
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpSize(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (payload + chunkSize > buffer.length) return null;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: readUint24LE(buffer, payload + 4) + 1,
        height: readUint24LE(buffer, payload + 7) + 1,
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5 && buffer[payload] === 0x2f) {
      const bits = buffer.readUInt32LE(payload + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      buffer[payload + 3] === 0x9d &&
      buffer[payload + 4] === 0x01 &&
      buffer[payload + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(payload + 6) & 0x3fff,
        height: buffer.readUInt16LE(payload + 8) & 0x3fff,
      };
    }

    offset = payload + chunkSize + (chunkSize % 2);
  }

  return null;
}

function readImageSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return readPngSize(buffer);
  if (ext === ".jpg" || ext === ".jpeg") return readJpegSize(buffer);
  if (ext === ".webp") return readWebpSize(buffer);
  return null;
}

function formatKb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

const universities = readJson(dataPath);
const ids = universities.map((row) => String(row?.id || "").trim()).filter(Boolean);
const errors = [];
for (const file of ["university-icon.png", "HEROICONS-LICENSE.txt"]) {
  if (!fs.existsSync(path.join(assetsRoot, file))) {
    errors.push(`${file}: shared university badge and its license must ship together`);
  }
}
for (const retiredDirectory of ["logos", "logos-small"]) {
  if (fs.existsSync(path.join(assetsRoot, retiredDirectory))) {
    errors.push(`${retiredDirectory}: legacy logo directory must not ship in the public media bundle`);
  }
}
const warnings = [];

// Every campus photograph needs a recorded reusable source, because the cover shows its credit
// and the photo licenses require attribution.
const creditsPath = path.join(assetsRoot, "credits.json");
const FREE_LICENSE = /^(CC0( 1\.0)?|Public domain|CC BY(-SA)? \d\.\d)$/;
const mediaCredits = fs.existsSync(creditsPath) ? readJson(creditsPath) : null;
const credits = mediaCredits?.photos;
if (!credits) errors.push("missing university_assets/credits.json");
for (const id of credits ? Object.keys(credits) : []) {
  if (!ids.includes(id)) errors.push(`credits.json: ${id} is not a catalog university`);
}

function auditCredit(label, credit) {
  if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(String(credit?.source_url || ""))) {
    errors.push(`${label}: photo credit source_url must be a Wikimedia Commons file page`);
  }
  if (!FREE_LICENSE.test(String(credit?.license || ""))) {
    errors.push(`${label}: photo credit license "${credit?.license}" is not an accepted free license`);
  }
  if (!String(credit?.author || "").trim()) {
    errors.push(`${label}: photo credit has no author`);
  }
}

const galleryRoot = path.join(assetsRoot, "gallery");
const galleryFiles = new Set(fs.existsSync(galleryRoot)
  ? fs.readdirSync(galleryRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(galleryRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
  : []);
for (const [id, photos] of Object.entries(mediaCredits?.gallery || {})) {
  if (!ids.includes(id)) errors.push(`credits.json: ${id} is not a catalog university`);
  for (const [filename, credit] of Object.entries(photos)) {
    const relativePath = `${id}/${filename}`;
    const label = `gallery/${relativePath}`;
    if (!/^[a-z0-9-]+\.jpg$/.test(filename) || !galleryFiles.delete(relativePath)) {
      errors.push(`${label}: missing gallery JPEG or invalid filename`);
    }
    auditCredit(label, credit);
  }
}
for (const uncredited of galleryFiles) errors.push(`gallery/${uncredited}: photo without a credit in credits.json`);

const THUMBNAIL_FOLDERS = ["thumbnails", "thumbnails-medium", "thumbnails-small"];
let withoutPhoto = 0;

for (const id of ids) {
  const credit = credits?.[id];
  if (credits && !credit) {
    // No reusable photograph was found: the university must ship no photo, and the pages show the shared university icon.
    const leftovers = THUMBNAIL_FOLDERS.flatMap((folder) => [".jpg", ".webp"]
      .map((ext) => `${folder}/${id}${ext}`)
      .filter((rel) => fs.existsSync(path.join(assetsRoot, rel))));
    if (leftovers.length) errors.push(`${id}: photo without a credit in credits.json (${leftovers.join(", ")})`);
    withoutPhoto += 1;
    continue;
  }
  if (credit) auditCredit(id, credit);

  for (const rule of IMAGE_RULES) {
    const filePath = path.join(assetsRoot, rule.folder, `${id}${rule.ext}`);
    if (!fs.existsSync(filePath)) {
      errors.push(`${id}: missing ${rule.folder}/${id}${rule.ext}`);
      continue;
    }

    const stat = fs.statSync(filePath);
    if (stat.size > rule.maxBytes) {
      errors.push(
        `${id}: ${rule.folder}/${id}${rule.ext} is ${formatKb(stat.size)}, limit ${formatKb(rule.maxBytes)}`,
      );
    }

    const size = readImageSize(filePath);
    if (!size) {
      errors.push(`${id}: cannot read image dimensions for ${rule.folder}/${id}${rule.ext}`);
      continue;
    }

    if (size.width !== rule.width || size.height !== rule.height) {
      errors.push(
        `${id}: ${rule.folder}/${id}${rule.ext} is ${size.width}x${size.height}, expected ${rule.width}x${rule.height}`,
      );
    }
  }

  for (const ext of [".jpg", ".webp"]) {
    const fullPath = path.join(assetsRoot, "thumbnails", `${id}${ext}`);
    const mediumPath = path.join(assetsRoot, "thumbnails-medium", `${id}${ext}`);
    const smallPath = path.join(assetsRoot, "thumbnails-small", `${id}${ext}`);
    if (!fs.existsSync(fullPath) || !fs.existsSync(mediumPath) || !fs.existsSync(smallPath)) continue;

    const fullSize = fs.statSync(fullPath).size;
    const mediumSize = fs.statSync(mediumPath).size;
    const smallSize = fs.statSync(smallPath).size;
    if (mediumSize >= fullSize) {
      errors.push(`${id}: medium ${ext} thumbnail is not smaller than full thumbnail`);
    }
    if (smallSize >= mediumSize) {
      errors.push(`${id}: small ${ext} thumbnail is not smaller than medium thumbnail`);
    }
    if (smallSize >= fullSize) {
      errors.push(`${id}: small ${ext} thumbnail is not smaller than full thumbnail`);
    }
  }

  for (const folder of THUMBNAIL_FOLDERS) {
    const jpgPath = path.join(assetsRoot, folder, `${id}.jpg`);
    const webpPath = path.join(assetsRoot, folder, `${id}.webp`);
    if (!fs.existsSync(jpgPath) || !fs.existsSync(webpPath)) continue;
    const jpgSize = fs.statSync(jpgPath).size;
    const webpSize = fs.statSync(webpPath).size;
    if (webpSize >= jpgSize) {
      errors.push(`${id}: ${folder}/${id}.webp is not smaller than the JPG fallback`);
    }
  }
}

if (warnings.length) {
  console.warn(warnings.map((item) => `warning: ${item}`).join("\n"));
}

if (errors.length) {
  console.error(errors.map((item) => `error: ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Image audit passed for ${ids.length} universities (${withoutPhoto} without a campus photo).`);
