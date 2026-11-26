import { heroIcon } from "../../icons.js";
import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { safeUrl, trFactSource } from "../_shared.js";
import { formatPublishedDate } from "../university/admissions-presentation.js";
import { isEvidenceReviewed } from "../university/admissions-status.js";
import { admissionDeadlineTitle } from "../university/admissions-render.js";
import { getReviewedDeadlineEvents } from "../university/deadline-calendar.js";

const label = (key) => t(`universities.compare.pdf.${key}`);

export function comparisonPdfButton(disabled) {
  return `<button type="button" class="ui-btn ui-btn--sm compare-reviewed__button" data-compare-pdf-export ${disabled ? "disabled" : ""}>
    ${heroIcon("document-text", "ui-icon ui-icon--16")}<span>${escapeHtml(label("export"))}</span>
  </button>`;
}

export function pdfDeadlineItems(resolved) {
  return getReviewedDeadlineEvents(resolved)
    .filter(({ kind, publicationStatus }) => kind !== "decision" && publicationStatus !== "published_dated_reference")
    .sort((left, right) => left.deadline.localeCompare(right.deadline))
    .map((event) => ({
      text: [admissionDeadlineTitle(event), formatPublishedDate(event.deadline), [event.time, event.timezone].filter(Boolean).join(" "),
        event.applicantCategoryLabel].filter(Boolean).join(" · "),
      url: event.sourceUrl,
    }));
}

function officialSources(resolved) {
  if (!resolved) return [];
  const groups = ["requirements", "application", "deadlines", "costs", "funding"];
  const factIds = new Set(groups.flatMap((group) => resolved.fact_groups?.[group] || []));
  const facts = (resolved.facts || []).filter((fact) => factIds.has(fact.id)
    && fact.applicability?.status !== "mismatched" && isEvidenceReviewed(fact));
  const sourceIds = new Set([
    ...(resolved.selected_option?.source_ids || []),
    ...(resolved.selected_route?.source_ids || []),
    ...facts.flatMap((fact) => fact.source_ids || []),
  ]);
  const sources = new Map();
  for (const source of resolved.sources || []) {
    const url = safeUrl(source.url);
    if (sourceIds.has(source.id) && url) {
      const dates = [source.checked_at, ...facts.filter((fact) => fact.source_ids?.includes(source.id)).map((fact) => fact.checked_at)];
      const checked = dates.filter(Boolean).sort().at(-1);
      const previous = sources.get(url);
      sources.set(url, { url, title: previous?.title || trFactSource(source.title) || new URL(url).hostname,
        checked: [previous?.checked, checked].filter(Boolean).sort().at(-1) });
    }
  }
  return [...sources.values()];
}

function paragraphs(lines) {
  return lines.filter(Boolean).map((line) => `<p>${escapeHtml(typeof line === "string" ? line : line.text)}</p>`).join("");
}

function cell(value) {
  if (!value) return escapeHtml(t("universities.compare.reviewed.value.not_published"));
  if (value.state) return escapeHtml(value.text);
  const items = value.items?.length ? `<ul>${value.items.map(({ text, url }) => {
    const href = safeUrl(url);
    return `<li>${href ? `<a href="${escapeHtmlAttr(href)}">${escapeHtml(text)}</a>` : escapeHtml(text)}</li>`;
  }).join("")}</ul>` : "";
  return `${paragraphs([value.main, ...(value.details || [])])}${items}`;
}

function sourcesHtml(resolved) {
  const sources = officialSources(resolved);
  if (!sources.length) return escapeHtml(label("no_sources"));
  return `<ul>${sources.map(({ url, title, checked }) => `<li>
    <a href="${escapeHtmlAttr(url)}">${escapeHtml(title)}</a>${checked ? ` · ${escapeHtml(t("university.admissions.checked"))} ${escapeHtml(formatPublishedDate(checked))}` : ""}
  </li>`).join("")}</ul>`;
}

export function printComparisonPdf(container, columns, rows) {
  const now = new Date();
  const date = formatPublishedDate([now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-"));
  container.querySelector(".compare-pdf")?.remove();
  container.insertAdjacentHTML("beforeend", `<article class="compare-pdf">
    <header>
      <p class="compare-pdf__brand">UniSearch</p>
      <h1>${escapeHtml(t("universities.compare.results.title"))}</h1>
      <p>${escapeHtml(tFormat("universities.compare.pdf.date", { date }))}</p>
    </header>
    <table>
      <thead><tr>
        <th scope="col">${escapeHtml(t("universities.compare.row.metric"))}</th>
        ${columns.map(({ name, context }) => `<th scope="col"><strong>${escapeHtml(name)}</strong>${paragraphs(context)}</th>`).join("")}
      </tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th>${row.values.map((value) => `<td>${cell(value)}</td>`).join("")}</tr>`).join("")}
        <tr><th scope="row">${escapeHtml(t("university.admissions.reading.sources_disclosure"))}</th>
          ${columns.map(({ resolved }) => `<td>${sourcesHtml(resolved)}</td>`).join("")}
        </tr>
      </tbody>
    </table>
    <p class="compare-pdf__note">${escapeHtml(label("note"))}</p>
  </article>`);
  window.print();
}
