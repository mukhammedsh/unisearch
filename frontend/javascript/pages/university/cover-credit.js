/* cover-credit.js - Author and license credit for the university cover photograph */

import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { buildApiUrl, safeUrl } from "../_shared.js";

let creditsPromise = null;

// The credits file lives next to the photographs and is served by the same static asset route.
export function loadCoverCredits() {
  if (!creditsPromise) {
    creditsPromise = fetch(buildApiUrl("universities/assets/credits.json"), { credentials: "omit" })
      .then((response) => {
        if (!response.ok) throw new Error(`credits.json responded ${response.status}`);
        return response.json();
      })
      .then((data) => (data && typeof data.photos === "object" && data.photos) || {})
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

export async function renderCoverCredit(coverEl, universityId) {
  if (!coverEl) return;
  coverEl.querySelector(".d-cover-credit")?.remove();
  coverEl.dataset.creditFor = String(universityId || "");
  const credits = await loadCoverCredits();
  // A later navigation may have reused the cover for another university while the file loaded.
  if (!credits || coverEl.dataset.creditFor !== String(universityId || "")) return;
  const html = coverCreditHtml(credits[universityId]);
  if (html) coverEl.insertAdjacentHTML("beforeend", html);
}
