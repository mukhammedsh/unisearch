import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { getCurrentLanguage, t } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { safeUrl } from "../_shared.js";
import { createDeadlineIcs, getCalendarCells, parseExactDeadlineDate } from "./deadline-calendar.js";
import { admissionDeadlineTitle } from "./admissions-render.js";
import { translateAdmissionSummary } from "../../university-translations.js";

const label = key => t(`university.deadlines.${key}`);

export function renderDeadlineCalendar(deadlines, state = {}) {
  const dated = deadlines.map((item, index) => ({ item, index, date: item.approximate || item.is_approximate ? null : parseExactDeadlineDate(item.deadline) }))
    .filter(entry => entry.date).sort((left, right) => left.date.localeCompare(right.date));
  if (!dated.length) return `<section class="deadline-calendar"><h4>${escapeHtml(label("calendar_title"))}</h4><p>${escapeHtml(label("calendar_no_exact"))}</p></section>`;
  const language = getCurrentLanguage();
  const locale = { eng: "en-US", rus: "ru-RU", kaz: "kk-KZ" }[language];
  const today = new Date().toISOString().slice(0, 10);
  const first = dated.find(entry => entry.date >= today) || dated[0];
  const monthKey = state.monthKey || first.date.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const monthTitle = language === "kaz" ? `${year} жылғы ${t(`university.admissions.reading.month.${month}`)}`
    : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const formatDate = date => language === "kaz" ? `${Number(date.slice(8))} ${t(`university.admissions.reading.month.${Number(date.slice(5, 7))}`)} ${date.slice(0, 4)}`
    : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const monthEvents = dated.filter(entry => entry.date.startsWith(monthKey));
  const activeDay = state.day?.startsWith(monthKey) ? state.day : monthEvents[0]?.date || "";
  const activeEvents = monthEvents.filter(entry => entry.date === activeDay);
  const cells = getCalendarCells(year, month - 1).map(day => {
    if (day === null) return '<span class="deadline-calendar__blank" aria-hidden="true"></span>';
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const count = monthEvents.filter(entry => entry.date === date).length;
    return count ? `<button type="button" class="deadline-calendar__day deadline-calendar__day--event${date === activeDay ? " is-active" : ""}" data-calendar-day="${date}" aria-label="${escapeHtmlAttr(formatDate(date))}: ${count} ${escapeHtmlAttr(label("calendar_events"))}" aria-pressed="${date === activeDay}"><span>${day}</span><span class="deadline-calendar__count">${count}</span></button>`
      : `<span class="deadline-calendar__day">${day}</span>`;
  }).join("");
  return `<section class="deadline-calendar" aria-label="${escapeHtmlAttr(label("calendar_title"))}">
    <div class="deadline-calendar__head"><h4>${escapeHtml(label("calendar_title"))}</h4><div class="deadline-calendar__navigation">
      <button type="button" data-calendar-month="previous" aria-label="${escapeHtmlAttr(label("calendar_previous"))}">${heroIcon("chevron-left", "ui-icon ui-icon--16")}</button>
      <strong aria-live="polite">${escapeHtml(monthTitle)}</strong>
      <button type="button" data-calendar-month="next" aria-label="${escapeHtmlAttr(label("calendar_next"))}">${heroIcon("chevron-right", "ui-icon ui-icon--16")}</button>
    </div></div>
    <div class="deadline-calendar__grid" role="group" aria-label="${escapeHtmlAttr(monthTitle)}" data-calendar-month-key="${monthKey}">
      ${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => `<span class="deadline-calendar__weekday">${escapeHtml(label(`weekday.${day}`))}</span>`).join("")}${cells}
    </div><div class="deadline-calendar__details" aria-live="polite">
      ${activeEvents.length ? `<strong>${escapeHtml(formatDate(activeDay))}</strong><ul>${activeEvents.map(({ item, index }) => {
        const href = item.sourceFactId ? safeUrl(item.sourceUrl) : `#deadline-card-${index}`;
        const exportable = !item.time || Boolean(createDeadlineIcs(item));
        return `<li><div>${href ? `<a href="${escapeHtmlAttr(href)}"${item.sourceFactId ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(admissionDeadlineTitle(item))}</a>` : escapeHtml(admissionDeadlineTitle(item))}
          ${item.sourceFactId ? `<small>${escapeHtml(item.time ? [item.time, item.timezone].filter(Boolean).join(" · ") : label("calendar_time_unknown"))}</small>${item.applicantCategoryLabel ? `<small>${escapeHtml(translateAdmissionSummary(item.applicantCategoryLabel, { section: "applicant_scope" }) || translateAdmissionSummary(item.applicantCategoryLabel) || item.applicantCategoryLabel)}</small>` : ""}` : ""}</div>
          <button type="button" class="deadline-calendar__export" data-calendar-export="${index}"${exportable ? "" : ` disabled title="${escapeHtmlAttr(label("export_time_unresolved"))}"`}>${escapeHtml(label("export_ics"))}</button></li>`;
      }).join("")}</ul>` : `<p>${escapeHtml(label("calendar_empty_month"))}</p>`}
    </div>${deadlines.length > dated.length ? `<p class="deadline-calendar__note">${escapeHtml(label("calendar_partial_note"))}</p>` : ""}</section>`;
}

export function mountDeadlineCalendar(host, deadlines, state = {}) {
  if (!host) return;
  const render = () => { host.innerHTML = renderDeadlineCalendar(deadlines, state); };
  render();
  host.onclick = event => {
    const button = event.target.closest("button");
    if (!button || !host.contains(button) || button.disabled) return;
    if (button.dataset.calendarMonth) {
      const monthKey = host.querySelector("[data-calendar-month-key]").dataset.calendarMonthKey;
      const [year, month] = monthKey.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1 + (button.dataset.calendarMonth === "next" ? 1 : -1), 1));
      state.monthKey = date.toISOString().slice(0, 7);
      state.day = "";
      const direction = button.dataset.calendarMonth;
      render();
      host.querySelector(`[data-calendar-month="${direction}"]`).focus();
    } else if (button.dataset.calendarDay) {
      state.day = button.dataset.calendarDay;
      render();
      host.querySelector(`[data-calendar-day="${state.day}"]`).focus();
    } else if (button.dataset.calendarExport !== undefined) {
      const item = deadlines[Number(button.dataset.calendarExport)];
      if (!item) return;
      const ics = createDeadlineIcs({ ...item, title: item.kind ? `${admissionDeadlineTitle(item)} · ${item.title}` : item.title }, { uid: globalThis.crypto?.randomUUID?.() || `${item.id || item.deadline}@unisearch` });
      if (!ics) return;
      const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `unisearch-deadline-${parseExactDeadlineDate(item.deadline)}.ics`;
      link.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
}
