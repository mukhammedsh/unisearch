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
const warnings = [];

for (const id of ids) {
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

  for (const folder of ["thumbnails", "thumbnails-medium", "thumbnails-small"]) {
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

console.log(`Image audit passed for ${ids.length} universities.`);
