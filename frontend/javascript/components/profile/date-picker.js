import { getCurrentLanguage, t } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { replayMotion } from "../../utils/runtime.js";
import { initCustomSelect } from "../../utils/selects.js";

export function initProfileDatePicker(page) {
  const dialog = document.createElement("dialog");
  if (typeof dialog.showModal !== "function") return () => {};
  dialog.className = "profile-calendar";
  document.body.append(dialog);
  let input;
  let trigger;
  let shown;
  let selectedDate;
  let disposeMonthSelect;

  const locale = () => ({ eng: "en", ru: "ru", rus: "ru", kaz: "kk" }[getCurrentLanguage()] || "en");
  const dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const renderDays = (grid) => {
    const year = shown.getFullYear();
    const month = shown.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const weekday = new Intl.DateTimeFormat(locale(), { weekday: "short" });
    const fullDate = new Intl.DateTimeFormat(locale(), { dateStyle: "full" });
    const today = dateKey(new Date());
    const dayButtons = Array.from({ length: days }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const key = dateKey(date);
      return `<button class="ui-btn ui-btn--ghost ui-calendar__day" type="button" data-date="${key}" aria-label="${fullDate.format(date)}" aria-pressed="${key === selectedDate}"${key === today ? ' aria-current="date"' : ""}>${i + 1}</button>`;
    });
    grid.innerHTML = `
      ${Array.from({ length: 7 }, (_, i) => `<span class="ui-calendar__weekday">${weekday.format(new Date(2024, 0, i + 1))}</span>`).join("")}
      ${'<span aria-hidden="true"></span>'.repeat(offset)}
      ${dayButtons.join("")}`;
    replayMotion(grid, "motion-panel-enter");
  };
  const mountCalendar = () => {
    const monthFormatter = new Intl.DateTimeFormat(locale(), { month: "long" });
    const monthNames = Array.from({ length: 12 }, (_, i) => monthFormatter.format(new Date(2024, i, 1)));
    disposeMonthSelect?.();
    dialog.innerHTML = `
      <div class="ui-calendar__navigation profile-calendar__header">
        <button class="ui-btn ui-btn--icon" type="button" data-step="-1" aria-label="${t("profile.calendar.previous")}">${heroIcon("chevron-left", "ui-icon ui-icon--18")}</button>
        <select id="profileCalendarMonth" class="ui-select" aria-label="${t("profile.calendar.month")}">${monthNames.map((name, i) => `<option value="${i}"${i === shown.getMonth() ? " selected" : ""}>${name}</option>`).join("")}</select>
        <input class="ui-input" type="number" inputmode="numeric" min="100" max="9999" aria-label="${t("profile.calendar.year")}" value="${shown.getFullYear()}">
        <button class="ui-btn ui-btn--icon" type="button" data-step="1" aria-label="${t("profile.calendar.next")}">${heroIcon("chevron-right", "ui-icon ui-icon--18")}</button>
      </div>
      <div class="profile-calendar__grid ui-calendar__grid"></div>
      <div class="profile-calendar__footer">
        <button class="ui-btn ui-btn--lg" type="button" data-clear>${t("profile.calendar.clear")}</button>
        <button class="ui-btn ui-btn--lg ui-btn--primary" type="button" data-save>${t("profile.action.save_all")}</button>
      </div>`;
    const monthSelect = dialog.querySelector("#profileCalendarMonth");
    const yearInput = dialog.querySelector('input[type="number"]');
    const grid = dialog.querySelector(".profile-calendar__grid");
    disposeMonthSelect = initCustomSelect(monthSelect.id);
    dialog.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => {
      const next = new Date(shown);
      next.setMonth(next.getMonth() + Number(button.dataset.step), 1);
      if (next.getFullYear() < Number(yearInput.min) || next.getFullYear() > Number(yearInput.max)) return;
      shown = next;
      yearInput.value = String(shown.getFullYear());
      monthSelect.value = String(shown.getMonth());
      monthSelect.dispatchEvent(new Event("change"));
      renderDays(grid);
    }));
    monthSelect.addEventListener("change", () => {
      const month = Number(monthSelect.value);
      if (month === shown.getMonth()) return;
      shown.setMonth(month, 1);
      renderDays(grid);
    });
    yearInput.addEventListener("change", () => {
      if (yearInput.value && yearInput.validity.valid) {
        shown.setFullYear(Number(yearInput.value), shown.getMonth(), 1);
        renderDays(grid);
      }
      yearInput.value = String(shown.getFullYear());
    });
    const selectDate = (value) => {
      selectedDate = value;
      dialog.querySelectorAll("[data-date]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.date === value));
      });
    };
    grid.addEventListener("click", (event) => {
      const day = event.target.closest("[data-date]");
      if (day) selectDate(day.dataset.date);
    });
    dialog.querySelector("[data-clear]").addEventListener("click", () => selectDate(""));
    dialog.querySelector("[data-save]").addEventListener("click", () => choose(selectedDate));
    renderDays(grid);
  };
  const closeCalendar = async () => {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    dialog.classList.add("is-closing");
    const animations = dialog.getAnimations();
    await Promise.allSettled(animations.map((animation) => animation.finished));
    if (dialog.open) dialog.close();
    dialog.classList.remove("is-closing");
  };
  const choose = (value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); void closeCalendar(); };
  dialog.addEventListener("close", () => trigger?.focus());
  dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") event.stopPropagation(); });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); void closeCalendar(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) void closeCalendar(); });
  const enhance = () => page.querySelectorAll('input[type="date"]:not([data-calendar-ready])').forEach((field) => {
    field.dataset.calendarReady = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-btn ui-btn--sm ui-btn--icon ui-btn--ghost profile-calendar-trigger";
    button.innerHTML = heroIcon("calendar", "ui-icon ui-icon--18");
    button.setAttribute("aria-label", t("profile.calendar.open"));
    button.setAttribute("aria-haspopup", "dialog");
    field.after(button);
    button.addEventListener("click", () => {
      input = field;
      selectedDate = field.value;
      trigger = button;
      button.setAttribute("aria-label", t("profile.calendar.open"));
      const parts = field.value.split("-").map(Number);
      shown = parts.length === 3 && parts[0] >= 100 ? new Date(parts[0], parts[1] - 1, 1) : new Date();
      dialog.setAttribute("aria-label", t("profile.calendar.open"));
      mountCalendar();
      dialog.showModal();
    });
  });
  enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(page, { childList: true, subtree: true });
  return () => { observer.disconnect(); disposeMonthSelect?.(); dialog.remove(); page.querySelectorAll(".profile-calendar-trigger").forEach((button) => button.remove()); page.querySelectorAll("[data-calendar-ready]").forEach((field) => delete field.dataset.calendarReady); };
}
