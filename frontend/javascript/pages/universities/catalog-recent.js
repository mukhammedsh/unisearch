import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { renderInlineIcon, readIdListStorage, writeIdListStorage, trUniversityName } from "../_shared.js";
import { routeUniversityDetail } from "../../routes.js";

/**
 * Recently viewed universities bar
 */

export function renderRecentlyViewedBar(container, options = {}) {
  const {
    recentStorageKey = "unisearch_recent_universities",
    maxItems = 6,
    getUniversityName = () => "",
    universityLinkAttrs = () => ""
  } = options;

  if (!container) return;

  const recentIds = readIdListStorage(recentStorageKey).slice(0, maxItems);
  if (!recentIds.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const rows = recentIds
    .map((id) => ({ id, label: getUniversityName(id) }))
    .filter((row) => row.label);

  if (!rows.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <div class="u-recent__head">
      <span class="u-recent__label">${escapeHtml(t("universities.recent.title", "Recently viewed"))}</span>
      <button class="u-recent__clear" type="button" data-action="clear-recent">
        ${renderInlineIcon("x-mark", 14, "u-recent__clear-icon")}
        <span>${escapeHtml(t("universities.recent.clear_all", "Clear all"))}</span>
      </button>
    </div>
    <div class="u-recent__items">
      ${rows.map((row) => {
        const removeLabel = tFormat(
          "universities.recent.remove",
          { university: row.label },
          `Remove ${row.label} from recently viewed`
        );
        return `
          <span class="u-recent__chip">
            <a class="u-recent__link" href="${routeUniversityDetail(row.id)}"${universityLinkAttrs()}>${escapeHtml(row.label)}</a>
            <button
              class="u-recent__remove"
              type="button"
              data-action="remove-recent"
              data-uni-id="${escapeHtmlAttr(row.id)}"
              aria-label="${escapeHtmlAttr(removeLabel)}"
              title="${escapeHtmlAttr(removeLabel)}"
            >${renderInlineIcon("x-mark", 14, "u-recent__remove-icon")}</button>
          </span>
        `;
      }).join("")}
    </div>
  `;

  container.querySelector('[data-action="clear-recent"]')?.addEventListener("click", () => {
    writeIdListStorage(recentStorageKey, []);
    renderRecentlyViewedBar(container, options);
  });

  container.querySelectorAll('[data-action="remove-recent"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const uniId = String(button.getAttribute("data-uni-id") || "").trim();
      if (!uniId) return;
      const nextIds = readIdListStorage(recentStorageKey).filter((id) => id !== uniId);
      writeIdListStorage(recentStorageKey, nextIds);
      renderRecentlyViewedBar(container, options);
    });
  });
}

export function normalizeUniversitySearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function acronymForUniversityName(name) {
  const skip = new Set(["of", "the", "and", "for", "de", "la", "le"]);
  return String(name || "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !skip.has(word.toLowerCase()))
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

export function universitySearchTokens(item, options = {}) {
  const { trUniversityName: trName = (u) => u?.name || "", trCity = (c) => c, trCountry = (c) => c } = options;
  const name = String(item?.name || "");
  const translatedName = trName(item);
  const id = String(item?.id || "");
  const city = String(item?.location?.city || "");
  const country = String(item?.location?.country || "");
  const aliases = Array.isArray(item?.search_aliases) ? item.search_aliases : [];

  const tokens = [
    name,
    translatedName,
    id,
    id.replace(/-/g, " "),
    city,
    trCity(city),
    country,
    trCountry(country),
    acronymForUniversityName(name),
    acronymForUniversityName(translatedName),
    ...aliases,
  ];

  return Array.from(new Set(tokens.map(normalizeUniversitySearchText).filter(Boolean)));
}

export function matchesUniversityQuery(item, rawQuery, options = {}) {
  const query = normalizeUniversitySearchText(rawQuery);
  if (!query) return true;
  return universitySearchTokens(item, options).some((token) => token.includes(query) || query.includes(token));
}
