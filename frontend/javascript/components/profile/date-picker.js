import { getCurrentLanguage, t } from "../../i18n.js";
import { heroIcon } from "../../icons.js";

export function initProfileDatePicker(page) {
  const dialog = document.createElement("dialog");
  if (typeof dialog.showModal !== "function") return () => {};
  dialog.className = "profile-calendar";
  document.body.append(dialog);
  let input;
  let trigger;
  let shown;
  let selectedDate;

  const locale = () => ({ eng: "en", ru: "ru", rus: "ru", kaz: "kk" }[getCurrentLanguage()] || "en");
  const dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const render = () => {
    const year = shown.getFullYear();
    const month = shown.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const monthNames = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale(), { month: "long" }).format(new Date(2024, i, 1)));
    const weekday = new Intl.DateTimeFormat(locale(), { weekday: "short" });
    const fullDate = new Intl.DateTimeFormat(locale(), { dateStyle: "full" });
    const today = dateKey(new Date());
    const dayButtons = Array.from({ length: days }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const key = dateKey(date);
      return `<button class="ui-btn ui-btn--ghost ui-calendar__day" type="button" data-date="${key}" aria-label="${fullDate.format(date)}" aria-pressed="${key === selectedDate}"${key === today ? ' aria-current="date"' : ""}>${i + 1}</button>`;
    });
    dialog.innerHTML = `
      <div class="ui-calendar__navigation profile-calendar__header">
        <button class="ui-btn ui-btn--icon" type="button" data-step="-1" aria-label="${t("profile.calendar.previous")}">${heroIcon("chevron-left", "ui-icon ui-icon--18")}</button>
        <select class="ui-select" aria-label="${t("profile.calendar.month")}">${monthNames.map((name, i) => `<option value="${i}"${i === month ? " selected" : ""}>${name}</option>`).join("")}</select>
        <input class="ui-input" type="number" inputmode="numeric" min="100" max="9999" aria-label="${t("profile.calendar.year")}" value="${year}">
        <button class="ui-btn ui-btn--icon" type="button" data-step="1" aria-label="${t("profile.calendar.next")}">${heroIcon("chevron-right", "ui-icon ui-icon--18")}</button>
      </div>
      <div class="profile-calendar__grid ui-calendar__grid motion-panel-enter">
        ${Array.from({ length: 7 }, (_, i) => `<span class="ui-calendar__weekday">${weekday.format(new Date(2024, 0, i + 1))}</span>`).join("")}
        ${'<span aria-hidden="true"></span>'.repeat(offset)}
        ${dayButtons.join("")}
      </div>
      <div class="profile-calendar__footer">
        <button class="ui-btn ui-btn--lg" type="button" data-clear>${t("profile.calendar.clear")}</button>
        <button class="ui-btn ui-btn--lg ui-btn--primary" type="button" data-save>${t("profile.action.save_all")}</button>
      </div>`;
    dialog.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => { shown = new Date(year, month + Number(button.dataset.step), 1); render(); dialog.querySelector(`[data-step="${button.dataset.step}"]`).focus(); }));
    dialog.querySelector("select").addEventListener("change", (event) => { shown = new Date(year, Number(event.target.value), 1); render(); dialog.querySelector("select").focus(); });
    dialog.querySelector('input[type="number"]').addEventListener("change", (event) => { const nextYear = Number(event.target.value); if (nextYear >= 100 && nextYear <= 9999) shown = new Date(nextYear, month, 1); render(); dialog.querySelector('input[type="number"]').focus(); });
    const selectDate = (value) => {
      selectedDate = value;
      dialog.querySelectorAll("[data-date]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.date === value));
      });
    };
    dialog.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => selectDate(button.dataset.date)));
    dialog.querySelector("[data-clear]").addEventListener("click", () => selectDate(""));
    dialog.querySelector("[data-save]").addEventListener("click", () => choose(selectedDate));
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
      render();
      dialog.showModal();
    });
  });
  enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(page, { childList: true, subtree: true });
  return () => { observer.disconnect(); dialog.remove(); page.querySelectorAll(".profile-calendar-trigger").forEach((button) => button.remove()); page.querySelectorAll("[data-calendar-ready]").forEach((field) => delete field.dataset.calendarReady); };
}
