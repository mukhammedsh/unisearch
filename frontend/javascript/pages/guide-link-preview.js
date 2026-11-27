/* frontend/javascript/pages/guide-link-preview.js */

/**
 * Wikipedia-style previews for links between Guide articles: pointing at a link or reaching it with the
 * keyboard shows the target's heading and first paragraph. Touch taps follow the link as usual. The
 * preview only repeats what the link opens, so it is exposed as the link's description.
 * @typedef {{ sectionId: string, anchor: HTMLElement | null }} GuideTarget
 */

const PREVIEW_LINK_SELECTOR = '.guide-doc a[href^="guide.html#guide-"]';
const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 150;
const VIEWPORT_GUTTER = 12;
const LINK_GAP = 8;

const textOf = (element) => String(element?.textContent || "").replace(/\s+/g, " ").trim();

/** The first paragraph after a subsection heading, stopping at the next heading. */
function paragraphAfter(heading) {
  for (let node = heading.nextElementSibling; node; node = node.nextElementSibling) {
    if (/^H[1-6]$/.test(node.tagName)) return null;
    if (node.tagName === "P") return node;
  }
  return null;
}

/**
 * Places the open preview below the link's first line, or above it when there is no room below.
 * @param {HTMLElement} card
 * @param {HTMLAnchorElement} link
 */
function placePreview(card, link) {
  const rect = link.getClientRects()[0] || link.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = card;
  const x = Math.min(Math.max(rect.left, VIEWPORT_GUTTER), window.innerWidth - width - VIEWPORT_GUTTER);
  const below = rect.bottom + LINK_GAP;
  const above = rect.top - LINK_GAP - height;
  const y = below + height > window.innerHeight - VIEWPORT_GUTTER && above >= VIEWPORT_GUTTER ? above : below;
  card.style.setProperty("--guide-preview-x", `${Math.max(VIEWPORT_GUTTER, Math.round(x))}px`);
  card.style.setProperty("--guide-preview-y", `${Math.round(y)}px`);
}

/**
 * @param {{
 *   page: HTMLElement,
 *   guideContent: HTMLElement | null,
 *   resolveTarget: (id: string) => GuideTarget | null,
 *   groupLabel: (sectionId: string) => string,
 * }} options
 * @returns {{ refresh: () => void }}
 */
export function bindGuideLinkPreviews({ page, guideContent, resolveTarget, groupLabel }) {
  // Without the Popover API the links simply work without previews.
  if (!guideContent || !Object.hasOwn(HTMLElement.prototype, "popover")) return { refresh: () => {} };

  /** @type {Map<string, HTMLElement>} */
  const cards = new Map();
  /** @type {{ link: HTMLAnchorElement, card: HTMLElement } | null} */
  let open = null;
  let showTimer = 0;
  let hideTimer = 0;

  const cardFor = (id) => {
    if (cards.has(id)) return cards.get(id);
    const card = document.createElement("div");
    card.id = `guidePreview-${id}`;
    card.className = "guide-link-preview motion-top-layer motion-top-layer--fade";
    card.setAttribute("popover", "manual");
    card.setAttribute("role", "tooltip");
    card.innerHTML = '<span class="guide-link-preview__eyebrow"></span><strong class="guide-link-preview__title"></strong><span class="guide-link-preview__text"></span>';
    card.addEventListener("pointerenter", () => window.clearTimeout(hideTimer));
    card.addEventListener("pointerleave", () => scheduleHide());
    page.append(card);
    cards.set(id, card);
    return card;
  };

  const fill = (card, target) => {
    const section = document.getElementById(target.sectionId);
    const heading = target.anchor || section?.querySelector("h2");
    const paragraph = target.anchor ? paragraphAfter(target.anchor) : section?.querySelector(".guide-doc > p");
    card.querySelector(".guide-link-preview__eyebrow").textContent = target.anchor ? textOf(section?.querySelector("h2")) : groupLabel(target.sectionId);
    card.querySelector(".guide-link-preview__title").textContent = textOf(heading);
    const text = card.querySelector(".guide-link-preview__text");
    text.textContent = textOf(paragraph);
    text.hidden = !text.textContent;
  };

  const hideNow = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    if (open?.card.matches(":popover-open")) open.card.hidePopover();
    open = null;
  };

  const scheduleHide = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideNow, HIDE_DELAY_MS);
  };

  const show = (link) => {
    const card = cards.get(link.hash.slice(1));
    if (!card || !link.isConnected) return;
    if (open && open.card !== card) hideNow();
    window.clearTimeout(hideTimer);
    if (!card.matches(":popover-open")) card.showPopover();
    placePreview(card, link);
    open = { link, card };
  };

  // Moving between links while one preview is open switches at once instead of waiting again.
  const scheduleShow = (link) => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    if (open?.link === link) return;
    showTimer = window.setTimeout(() => show(link), open ? 0 : SHOW_DELAY_MS);
  };

  const previewLink = (event) => {
    const link = event.target instanceof Element ? event.target.closest(PREVIEW_LINK_SELECTOR) : null;
    return link instanceof HTMLAnchorElement && cards.has(link.hash.slice(1)) ? link : null;
  };

  guideContent.addEventListener("pointerover", (event) => {
    const link = previewLink(event);
    if (link && event.pointerType === "mouse") scheduleShow(link);
  });
  guideContent.addEventListener("pointerout", (event) => {
    const link = previewLink(event);
    if (link && !link.contains(/** @type {Node | null} */ (event.relatedTarget))) scheduleHide();
  });
  guideContent.addEventListener("focusin", (event) => {
    const link = previewLink(event);
    if (link?.matches(":focus-visible")) scheduleShow(link);
  });
  guideContent.addEventListener("focusout", (event) => {
    if (previewLink(event)) scheduleHide();
  });
  guideContent.addEventListener("click", (event) => {
    if (previewLink(event)) hideNow();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) hideNow();
  });
  window.addEventListener("scroll", () => {
    if (open) hideNow();
  }, { passive: true, capture: true });

  // Localized text replaces the links and headings, so cards and descriptions are rebuilt from the page.
  const refresh = () => {
    hideNow();
    guideContent.querySelectorAll(PREVIEW_LINK_SELECTOR).forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const id = link.hash.slice(1);
      const target = resolveTarget(id);
      if (!target) return;
      const card = cardFor(id);
      fill(card, target);
      link.setAttribute("aria-describedby", card.id);
    });
  };

  refresh();
  return { refresh };
}
