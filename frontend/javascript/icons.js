const ICONS = {
  "academic-cap": `<path d="M4.26 10.147a60.438 60.438 0 0 1 15.48 0M21.75 12a8.25 8.25 0 0 1-16.5 0m16.5 0v6.372a2.25 2.25 0 0 1-.84 1.767l-2.25 1.8a2.25 2.25 0 0 1-2.82 0l-2.25-1.8a2.25 2.25 0 0 1-.84-1.767V12m8.25 0a60.438 60.438 0 0 0-16.5 0" />`,
  "arrow-path": `<path d="M16.023 9.348h4.992V4.356m-.518 4.992a9 9 0 1 0 2.166 9.184" />`,
  "banknotes": `<path d="M2.25 6.75h19.5v10.5H2.25V6.75Z" /><path d="M18 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path d="M6.75 9h.008v.008H6.75V9Zm0 6h.008v.008H6.75V15Zm10.5-6h.008v.008h-.008V9Zm0 6h.008v.008h-.008V15Z" />`,
  "bars-3": `<path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />`,
  "bars-3-bottom-left": `<path d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h7.5" />`,
  "briefcase": `<path d="M6 7.5V6A2.25 2.25 0 0 1 8.25 3.75h7.5A2.25 2.25 0 0 1 18 6v1.5m-12 0h12m-12 0v10.125A2.625 2.625 0 0 0 8.625 20.25h6.75A2.625 2.625 0 0 0 18 17.625V7.5" />`,
  "building-office-2": `<path d="M3.75 21h16.5M5.25 21V7.5a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 .75.75V21M9 9.75h.75v.75H9v-.75Zm0 3h.75v.75H9v-.75Zm0 3h.75v.75H9v-.75Zm5.25-6h.75v.75h-.75v-.75Zm0 3h.75v.75h-.75v-.75Zm0 3h.75v.75h-.75v-.75ZM10.5 21v-3.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75V21" />`,
  "check-badge": `<path d="M9.813 15.904 9 15l.813.904Zm5.031-8.432a1.5 1.5 0 0 1 2.122 2.12l-6.563 6.563a1.5 1.5 0 0 1-2.121 0l-2.532-2.531a1.5 1.5 0 0 1 2.122-2.122l1.47 1.47 5.502-5.5Z" /><path d="M12 3.75 13.902 5.7l2.698-.39.39 2.698L18.75 9.75l-1.76 1.742.39 2.698-2.698.39L12 16.5l-1.902-1.92-2.698.39-.39-2.698L5.25 9.75l1.76-1.742-.39-2.698 2.698-.39L12 3.75Z" />`,
  "check-circle": `<path d="M9 12.75 11.25 15 15 9.75" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />`,
  "clipboard-document-list": `<path d="M9 5.25H7.5A2.25 2.25 0 0 0 5.25 7.5v10.5a2.25 2.25 0 0 0 2.25 2.25h9A2.25 2.25 0 0 0 18.75 18V7.5A2.25 2.25 0 0 0 16.5 5.25H15" /><path d="M9 3.75h6A1.5 1.5 0 0 1 16.5 5.25v.75a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 6V5.25A1.5 1.5 0 0 1 9 3.75Zm0 7.5h6m-6 3h6m-6 3h3" />`,
  "cpu-chip": `<path d="M9 3.75V2.25m6 1.5V2.25M9 21.75v-1.5m6 1.5v-1.5M3.75 9H2.25m1.5 6H2.25m19.5-6h-1.5m1.5 6h-1.5M7.5 6.75h9A2.25 2.25 0 0 1 18.75 9v6A2.25 2.25 0 0 1 16.5 17.25h-9A2.25 2.25 0 0 1 5.25 15V9A2.25 2.25 0 0 1 7.5 6.75Z" /><path d="M9.75 9.75h4.5v4.5h-4.5v-4.5Z" />`,
  "document-text": `<path d="M19.5 14.25V8.25a2.25 2.25 0 0 0-2.25-2.25H8.25A2.25 2.25 0 0 0 6 8.25v10.5A2.25 2.25 0 0 0 8.25 21h6.75" /><path d="M12 10.5h3m-6 3h6m-6 3h3" />`,
  "exclamation-triangle": `<path d="m11.25 9 1.5 0v4.5h-1.5V9Zm0 7.125h1.5v1.5h-1.5v-1.5Z" /><path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h16.94A1.5 1.5 0 0 0 21.34 18L12.87 3.86a1.5 1.5 0 0 0-2.58 0Z" />`,
  "funnel": `<path d="M12 3c2.755 0 5.455.203 8.076.592.894.133 1.334 1.147.803 1.878L15.75 12v6.75a.75.75 0 0 1-1.06.69l-3-1.5a.75.75 0 0 1-.44-.69V12L3.121 5.47c-.53-.731-.09-1.745.803-1.878A55.34 55.34 0 0 1 12 3Z" />`,
  "globe-alt": `<path d="M12 3.75c-4.556 0-8.25 3.694-8.25 8.25S7.444 20.25 12 20.25s8.25-3.694 8.25-8.25S16.556 3.75 12 3.75Z" /><path d="M3.75 12h16.5M12 3.75c2.071 2.252 3.375 5.102 3.375 8.25S14.071 18.998 12 21.25m0-17.5C9.929 6.002 8.625 8.852 8.625 12S9.929 17.998 12 20.25" />`,
  "information-circle": `<path d="M12 8.25h.008v.008H12V8.25Z" /><path d="M11.25 11.25h1.5v5.25h-1.5v-5.25Z" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />`,
  "magnifying-glass": `<path d="m21 21-4.35-4.35m1.35-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />`,
  "map": `<path d="m9 19.5-5.25 1.125V5.625L9 4.5m0 15 6-1.5m-6 1.5V4.5m6 13.5 5.25 1.125V4.125L15 3m0 15V3" />`,
  "map-pin": `<path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path d="M19.5 10.5c0 7.142-7.5 10.5-7.5 10.5S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />`,
  "moon": `<path d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.75 9.75 0 1 0 21.752 15.002Z" />`,
  "pencil-square": `<path d="M16.862 4.487a2.25 2.25 0 1 1 3.182 3.182L8.25 19.463 3.75 20.25l.787-4.5L16.862 4.487Z" /><path d="M15 5.25 18.75 9" />`,
  "question-mark-circle": `<path d="M12 17.25h.008v.008H12v-.008Zm-1.5-8.25a2.25 2.25 0 1 1 3.364 1.954c-.794.446-1.364 1.187-1.364 2.046v.75" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />`,
  "rocket-launch": `<path d="M15.59 14.37a6 6 0 0 0 .84-3.03V6.75a.75.75 0 0 0-.75-.75h-4.59a6 6 0 0 0-3.03.84L4.5 9.75l3 3-2.25 2.25a1.5 1.5 0 0 0 2.12 2.12L9.75 15l3 3 2.91-3.63ZM12.75 9.75h.008v.008h-.008V9.75Z" /><path d="M15 18.75 17.25 21m-8.25-2.25L6.75 21" />`,
  "sparkles": `<path d="M9.813 15.904 9 19.5l-.813-3.596A4.5 4.5 0 0 0 4.5 12.187L.904 11.374 4.5 10.56a4.5 4.5 0 0 0 3.687-3.687L9 3.277l.813 3.596A4.5 4.5 0 0 0 13.5 10.56l3.596.813-3.596.813a4.5 4.5 0 0 0-3.687 3.717ZM18 3.75l.394 1.729A2.25 2.25 0 0 0 20.021 7.106L21.75 7.5l-1.729.394a2.25 2.25 0 0 0-1.627 1.627L18 11.25l-.394-1.729a2.25 2.25 0 0 0-1.627-1.627L14.25 7.5l1.729-.394a2.25 2.25 0 0 0 1.627-1.627L18 3.75Z" />`,
  "sun": `<path d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364 6.364-1.061-1.06M6.697 6.697 5.636 5.636m12.728 0-1.06 1.06M6.697 17.303l-1.06 1.06M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />`,
  "trophy": `<path d="M16.5 18.75h-9m4.5-3.75v3.75m-3-10.5H6.75A2.25 2.25 0 0 1 4.5 6V4.5h3.75m7.5 0H19.5V6a2.25 2.25 0 0 1-2.25 2.25H15m-6.75-3.75h7.5V9a3.75 3.75 0 1 1-7.5 0V4.5Z" />`,
  "x-circle": `<path d="M9.75 9.75 14.25 14.25m0-4.5-4.5 4.5" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />`,
  "x-mark": `<path d="M6 18 18 6M6 6l12 12" />`,
};

function attrString(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, "&quot;")}"`)
    .join(" ");
}

export function heroIcon(name, className = "", attributes = {}) {
  const body = ICONS[name];
  if (!body) return "";
  const attrs = attrString({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.75",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    class: className || null,
    ...attributes,
  });
  return `<svg ${attrs}>${body}</svg>`;
}

export function setHeroIcon(element, name, className = "", attributes = {}) {
  if (!element) return;
  element.innerHTML = heroIcon(name, className, attributes);
}

export function hydrateHeroIcons(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("[data-heroicon]").forEach((node) => {
    const name = String(node.getAttribute("data-heroicon") || "").trim();
    const size = String(node.getAttribute("data-icon-size") || "").trim();
    const extraClass = String(node.getAttribute("data-icon-class") || "").trim();
    const classes = ["ui-icon"];
    if (size) classes.push(`ui-icon--${size}`);
    if (extraClass) classes.push(extraClass);
    node.innerHTML = heroIcon(name, classes.join(" "));
  });
}

export function stripLeadingDecorations(text) {
  return String(text || "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}
