import { t } from "../../i18n.js";
import { heroIcon } from "../../icons.js";

/** Sub-pixel slack so a tab bar resting at an edge does not count as scrollable in that direction. */
const EDGE_TOLERANCE = 1;
const PHONE_QUERY = "(max-width: 768px)";
const SCROLL_STEP = 0.7;

function scrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function ensureNavigation(tabs) {
  let nav = tabs.closest(".d-tabs-nav");
  if (nav) return nav;
  nav = document.createElement("div");
  nav.className = "d-tabs-nav";
  tabs.before(nav);
  nav.append(tabs);
  nav.insertAdjacentHTML("afterbegin", '<button type="button" data-tabs-previous></button>');
  nav.insertAdjacentHTML("beforeend", '<button type="button" data-tabs-next></button>');
  return nav;
}

/**
 * Makes the university section tabs usable when they do not fit the width: the active tab is kept in view,
 * previous/next buttons appear only while the bar overflows, and the URL hash follows a user's tab choice.
 * The tab list keeps its own ARIA roles and keyboard handling from `setupTabs`.
 * @param {ParentNode | null} card Element that contains the `.d-tabs` tab list.
 * @returns {() => void} Removes every listener and observer added here.
 */
export function mountTabsNavigation(card) {
  const tabs = card?.querySelector(".d-tabs");
  if (!tabs) return () => {};
  const nav = ensureNavigation(tabs);
  const previous = nav.querySelector("[data-tabs-previous]");
  const next = nav.querySelector("[data-tabs-next]");
  for (const [button, key, icon] of [[previous, "previous_tabs", "chevron-left"], [next, "next_tabs", "chevron-right"]]) {
    button.setAttribute("aria-label", t(`university.admissions.reading.${key}`));
    button.innerHTML = heroIcon(icon, "ui-icon ui-icon--16");
  }

  const update = () => {
    const maxScroll = tabs.scrollWidth - tabs.clientWidth;
    nav.toggleAttribute("data-scrollable", maxScroll > EDGE_TOLERANCE);
    previous.disabled = tabs.scrollLeft <= EDGE_TOLERANCE;
    next.disabled = tabs.scrollLeft >= maxScroll - EDGE_TOLERANCE;
  };
  const centerTab = (tab, behavior) => {
    if (tabs.scrollWidth <= tabs.clientWidth) return;
    tabs.scrollTo({ left: Math.max(0, tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2), behavior });
  };
  const onTabClick = (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    centerTab(button, scrollBehavior());
    if (!event.isTrusted) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = `#${button.dataset.tab}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    if (window.matchMedia(PHONE_QUERY).matches) nav.scrollIntoView({ block: "start" });
  };

  previous.onclick = () => tabs.scrollBy({ left: -tabs.clientWidth * SCROLL_STEP, behavior: scrollBehavior() });
  next.onclick = () => tabs.scrollBy({ left: tabs.clientWidth * SCROLL_STEP, behavior: scrollBehavior() });
  tabs.addEventListener("scroll", update, { passive: true });
  tabs.addEventListener("click", onTabClick);
  // The tab widths change with the interface language and with the card becoming visible.
  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(tabs);
  for (const tab of tabs.querySelectorAll("[data-tab]")) resizeObserver.observe(tab);

  const activeTab = tabs.querySelector('[role="tab"][aria-selected="true"]');
  if (activeTab) centerTab(activeTab, "auto");
  update();

  return () => {
    tabs.removeEventListener("scroll", update);
    tabs.removeEventListener("click", onTabClick);
    resizeObserver.disconnect();
    previous.onclick = null;
    next.onclick = null;
  };
}
