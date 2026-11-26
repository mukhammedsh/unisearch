import { getCurrentLanguage, t } from "../../i18n.js";
import { heroIcon } from "../../icons.js";

export function initProfileDatePicker(page) {
  const dialog = document.createElement("dialog");
  dialog.className = "profile-calendar";
  document.body.append(dialog);
  let input;
  let trigger;
  let shown;

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
    dialog.innerHTML = `<div class="profile-calendar__header"><button type="button" data-step="-1" aria-label="${t("profile.calendar.previous")}">${heroIcon("chevron-left", "ui-icon ui-icon--18")}</button><select aria-label="${t("profile.calendar.month")}">${monthNames.map((name, i) => `<option value="${i}"${i === month ? " selected" : ""}>${name}</option>`).join("")}</select><input type="number" min="100" max="9999" aria-label="${t("profile.calendar.year")}" value="${year}"><button type="button" data-step="1" aria-label="${t("profile.calendar.next")}">${heroIcon("chevron-right", "ui-icon ui-icon--18")}</button></div><div class="profile-calendar__grid">${Array.from({ length: 7 }, (_, i) => `<span class="profile-calendar__weekday">${weekday.format(new Date(2024, 0, i + 1))}</span>`).join("")}${"<span></span>".repeat(offset)}${Array.from({ length: days }, (_, i) => { const date = new Date(year, month, i + 1); const key = dateKey(date); return `<button type="button" data-date="${key}" aria-label="${new Intl.DateTimeFormat(locale(), { dateStyle: "full" }).format(date)}"${key === input.value ? ' aria-pressed="true"' : ""}${key === dateKey(new Date()) ? ' aria-current="date"' : ""}>${i + 1}</button>`; }).join("")}</div><div class="profile-calendar__footer"><button type="button" data-clear>${t("profile.calendar.clear")}</button><button type="button" data-today>${t("profile.calendar.today")}</button></div>`;
    dialog.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => { shown = new Date(year, month + Number(button.dataset.step), 1); render(); dialog.querySelector(`[data-step="${button.dataset.step}"]`).focus(); }));
    dialog.querySelector("select").addEventListener("change", (event) => { shown = new Date(year, Number(event.target.value), 1); render(); dialog.querySelector("select").focus(); });
    dialog.querySelector('input[type="number"]').addEventListener("change", (event) => { const nextYear = Number(event.target.value); if (nextYear >= 100 && nextYear <= 9999) shown = new Date(nextYear, month, 1); render(); dialog.querySelector('input[type="number"]').focus(); });
    dialog.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => choose(button.dataset.date)));
    dialog.querySelector("[data-clear]").addEventListener("click", () => choose(""));
    dialog.querySelector("[data-today]").addEventListener("click", () => choose(dateKey(new Date())));
  };
  const choose = (value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); dialog.close(); };
  dialog.addEventListener("close", () => trigger?.focus());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  const enhance = () => page.querySelectorAll('input[type="date"]:not([data-calendar-ready])').forEach((field) => {
    field.dataset.calendarReady = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-calendar-trigger";
    button.innerHTML = heroIcon("calendar", "ui-icon ui-icon--18");
    button.setAttribute("aria-label", t("profile.calendar.open"));
    field.after(button);
    button.addEventListener("click", () => {
      input = field;
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
