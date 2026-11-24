/* cover-credit.js - Author and license credit for university photographs */

import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { loadStaticSnapshotManifest, staticSnapshotAssetUrl } from "../../utils/static-snapshot.js";
import { buildApiUrl, safeUrl } from "../_shared.js";

let creditsPromise = null;

// The credits file lives next to the photographs and is served by the same static asset route.
export function loadPhotoCredits() {
  if (!creditsPromise) {
    creditsPromise = loadStaticSnapshotManifest()
      .then(() => {
        const snapshotUrl = staticSnapshotAssetUrl("credits.json");
        const url = snapshotUrl || buildApiUrl("universities/assets/credits.json");
        return fetch(url, { credentials: snapshotUrl ? "same-origin" : "omit" });
      })
      .then((response) => {
        if (!response.ok) throw new Error(`credits.json responded ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        // Without credits the cover keeps its photograph but shows no caption; the next page view retries.
        console.warn("cover_credits_unavailable", error);
        creditsPromise = null;
        return null;
      });
  }
  return creditsPromise;
}

export function coverCreditHtml(credit) {
  if (!credit || typeof credit !== "object") return "";
  const author = String(credit.author || "").trim() || t("university.cover_credit.unknown_author", "Unknown author");
  const license = String(credit.license || "").trim();
  if (!license) return "";
  const text = tFormat(
    credit.modified ? "university.cover_credit.text_modified" : "university.cover_credit.text",
    { author, license },
    credit.modified ? `Photo: ${author}, ${license} (cropped)` : `Photo: ${author}, ${license}`,
  );
  const href = safeUrl(credit.source_url);
  const title = escapeHtmlAttr(t("university.cover_credit.source_title", "Open the photo's source page with its license"));
  return href
    ? `<a class="d-cover-credit" href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer" title="${title}">${escapeHtml(text)}</a>`
    : `<span class="d-cover-credit">${escapeHtml(text)}</span>`;
}
