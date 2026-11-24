import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const ADMISSIONS_DIR = new URL("../../backend/data/admissions/", import.meta.url);

/**
 * Synchronously loads the split admissions index and all per-institution records
 * in the same combined `{ ...index, institutions }` shape used by unit tests.
 */
export function readAdmissionsCatalogSync() {
  const index = JSON.parse(readFileSync(new URL("index.json", ADMISSIONS_DIR), "utf8"));
  const institutions = (index.institutions || []).map((entry) =>
    JSON.parse(readFileSync(new URL(entry.file, ADMISSIONS_DIR), "utf8")),
  );
  return { ...index, institutions };
}

/**
 * Asynchronously loads the split admissions index and all per-institution records
 * in the same combined `{ ...index, institutions }` shape used by unit tests.
 */
export async function readAdmissionsCatalog() {
  const index = JSON.parse(await readFile(new URL("index.json", ADMISSIONS_DIR), "utf8"));
  const institutions = await Promise.all(
    (index.institutions || []).map(async (entry) =>
      JSON.parse(await readFile(new URL(entry.file, ADMISSIONS_DIR), "utf8")),
    ),
  );
  return { ...index, institutions };
}
