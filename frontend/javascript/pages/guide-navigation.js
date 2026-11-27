import { escapeHtml, prefersReducedMotion, replayMotion } from "../utils.js";
import { t, tFormat } from "../i18n.js";
import { heroIcon } from "../icons.js";
import { enableDialogLightDismissFallback } from "../components/dialog-light-dismiss.js";
import { bindGuideHashChange } from "./shared/cache.js";

function createSectionNavigationElements(guideContent) {
  const sectionNavigation = document.createElement("nav");
  const previousSectionButton = document.createElement("button");
  const nextSectionButton = document.createElement("button");

  sectionNavigation.className = "guide-section-navigation";
  sectionNavigation.id = "guideSectionNavigation";
  sectionNavigation.setAttribute("aria-label", t("guide.section_navigation", "Section navigation"));
  previousSectionButton.className = "guide-section-navigation__button guide-section-navigation__button--previous";
  previousSectionButton.type = "button";
  previousSectionButton.innerHTML = `${heroIcon("arrow-left", "guide-section-navigation__icon", { "stroke-width": 2.5 })}<span class="guide-section-navigation__copy"><span class="guide-section-navigation__direction">${escapeHtml(t("guide.previous_section_label", "Previous section"))}</span><span class="guide-section-navigation__title"></span></span>`;
  nextSectionButton.className = "guide-section-navigation__button guide-section-navigation__button--next";
  nextSectionButton.type = "button";
  nextSectionButton.innerHTML = `<span class="guide-section-navigation__copy"><span class="guide-section-navigation__direction">${escapeHtml(t("guide.next_section_label", "Next section"))}</span><span class="guide-section-navigation__title"></span></span>${heroIcon("arrow-left", "guide-section-navigation__icon", { "stroke-width": 2.5 })}`;
  sectionNavigation.append(previousSectionButton, nextSectionButton);
  guideContent?.appendChild(sectionNavigation);

  return { sectionNavigation, previousSectionButton, nextSectionButton };
}

/**
 * Phones and tablets show the guide as a topic list ("hub") that opens one section at a time
 * ("section"); the contents then live in a bottom sheet. Desktop always shows the sidebar and the
 * active section, so the view only changes the compact layout.
 * @typedef {"hub" | "section"} GuideView
 */
const COMPACT_GUIDE_QUERY = "(max-width: 1024px)";

/**
 * @param {{
 *   page: HTMLElement,
 *   navLinks: HTMLAnchorElement[],
 *   sections: HTMLElement[],
 *   guideNav: HTMLElement | null,
 * }} options
 */
export function setupGuideSectionNavigation({
  page,
  navLinks,
  sections,
  guideNav,
}) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const guideLayout = page.querySelector(".guide-layout");
  const guideContent = page.querySelector(".guide-content");
  const compactLayout = window.matchMedia(COMPACT_GUIDE_QUERY);
  const navHome = document.getElementById("guideNavHome");
  const navSheet = document.getElementById("guideNavSheet");
  const navSheetBody = document.getElementById("guideNavSheetBody");
  const navSheetClose = document.getElementById("guideNavSheetClose");
  const mobileNavToggle = document.getElementById("guideMobileNavToggle");
  const hubLink = document.getElementById("guideHubLink");
  const barGroup = document.getElementById("guideSectionBarGroup");
  const barTitle = document.getElementById("guideSectionBarTitle");

  const { sectionNavigation, previousSectionButton, nextSectionButton } = createSectionNavigationElements(guideContent);
  let activeGuideId = sections[0]?.id || "";

  const previousGuideId = (id) => {
    const currentIndex = sections.findIndex((section) => section.id === id);
    return currentIndex > 0 ? sections[currentIndex - 1].id : "";
  };

  const nextGuideId = (id) => {
    const currentIndex = sections.findIndex((section) => section.id === id);
    return currentIndex >= 0 ? (sections[currentIndex + 1]?.id || "") : "";
  };

  const navLinkFor = (id) => navLinks.find((item) => String(item.dataset.guideHash || item.getAttribute("href") || "").endsWith(`#${id}`));

  const sectionLabel = (id) => String(navLinkFor(id)?.textContent || "").trim() || id;

  const groupLabel = (id) => String(navLinkFor(id)?.closest(".guide-nav-group")?.querySelector(".guide-nav-title")?.textContent || "").trim();

  /** @returns {GuideView} */
  const currentView = () => (page.getAttribute("data-guide-view") === "hub" ? "hub" : "section");

  const closeNavSheet = () => {
    if (navSheet instanceof HTMLDialogElement && navSheet.open) navSheet.close();
  };

  // The one contents list moves between the hub and the sheet so links, labels, and listeners stay single.
  const placeNav = () => {
    if (!guideNav) return;
    const inSheet = compactLayout.matches && currentView() === "section";
    const home = inSheet ? navSheetBody : navHome;
    if (!inSheet) closeNavSheet();
    if (home && guideNav.parentElement !== home) home.append(guideNav);
  };

  /** @param {GuideView} view */
  const setView = (view) => {
    page.setAttribute("data-guide-view", view);
    placeNav();
  };

  const syncMobileNavigation = (id) => {
    const label = sectionLabel(id);
    if (barTitle) barTitle.textContent = label;
    if (barGroup) barGroup.textContent = groupLabel(id);
    if (mobileNavToggle) {
      mobileNavToggle.setAttribute("aria-label", tFormat("guide.contents_current", { section: label }, `Contents: ${label}`));
    }
    if (hubLink) {
      hubLink.setAttribute("href", `${window.location.pathname}${window.location.search}`);
      hubLink.setAttribute("aria-label", t("guide.all_topics", "All topics"));
    }
  };

  const updateSectionNavigation = (id) => {
    const previousId = previousGuideId(id);
    const nextId = nextGuideId(id);
    sectionNavigation.setAttribute("aria-label", t("guide.section_navigation", "Section navigation"));
    previousSectionButton.querySelector(".guide-section-navigation__direction").textContent = t("guide.previous_section_label", "Previous section");
    nextSectionButton.querySelector(".guide-section-navigation__direction").textContent = t("guide.next_section_label", "Next section");
    previousSectionButton.hidden = !previousId;
    previousSectionButton.dataset.sectionId = previousId;
    nextSectionButton.hidden = !nextId;
    nextSectionButton.dataset.sectionId = nextId;

    if (previousId) {
      previousSectionButton.querySelector(".guide-section-navigation__title").textContent = sectionLabel(previousId);
      previousSectionButton.setAttribute("aria-label", tFormat("guide.previous_section", { section: sectionLabel(previousId) }, `Back to ${sectionLabel(previousId)}`));
      previousSectionButton.title = tFormat("guide.previous_section", { section: sectionLabel(previousId) }, `Back to ${sectionLabel(previousId)}`);
    } else {
      previousSectionButton.querySelector(".guide-section-navigation__title").textContent = "";
      previousSectionButton.removeAttribute("aria-label");
      previousSectionButton.removeAttribute("title");
    }

    if (nextId) {
      nextSectionButton.querySelector(".guide-section-navigation__title").textContent = sectionLabel(nextId);
      nextSectionButton.setAttribute("aria-label", tFormat("guide.next_section", { section: sectionLabel(nextId) }, `Continue to ${sectionLabel(nextId)}`));
      nextSectionButton.title = tFormat("guide.next_section", { section: sectionLabel(nextId) }, `Continue to ${sectionLabel(nextId)}`);
    } else {
      nextSectionButton.querySelector(".guide-section-navigation__title").textContent = "";
      nextSectionButton.removeAttribute("aria-label");
      nextSectionButton.removeAttribute("title");
    }
  };

  /**
   * @param {string} id
   * @param {{ historyMode?: "push" | "replace" | null, scroll?: boolean, scrollBehavior?: ScrollBehavior | null, view?: GuideView, anchor?: HTMLElement | null }} [options]
   *   `anchor` is a subsection heading inside the section to bring into view and put in the URL.
   */
  const activateSection = (id, { historyMode = null, scroll = false, scrollBehavior = null, view = "section", anchor = null } = {}) => {
    const nextId = sectionById.has(id) ? id : (sections[0]?.id || "");
    if (!nextId) return;
    const targetSection = sectionById.get(nextId);
    const viewChanged = currentView() !== view;
    // Only the compact layout shows the view, so only there does a view change replace the section motion.
    const compactViewChange = compactLayout.matches && viewChanged;

    let sectionChanged = false;
    // Sections come in from the side the reader moved toward; the first section shown stays still.
    const previousIndex = sections.findIndex((section) => section.classList.contains("is-active"));
    const forward = sections.findIndex((section) => section.id === nextId) > previousIndex;
    sections.forEach((section) => {
      const active = section.id === nextId;
      const wasActive = section.classList.contains("is-active");
      if (active && !wasActive) {
        sectionChanged = true;
      }
      section.classList.toggle("is-active", active);
      section.setAttribute("aria-hidden", active ? "false" : "true");
      section.hidden = !active;
      if (active && !wasActive && previousIndex >= 0 && !compactViewChange) {
        replayMotion(section, forward ? "motion-tab-forward" : "motion-tab-back", { timeoutMs: 320 });
      }
    });

    navLinks.forEach((link) => {
      const active = String(link.dataset.guideHash || link.getAttribute("href") || "").trim() === `#${nextId}`;
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    setView(view);

    const hash = `#${anchor?.id || nextId}`;
    if (historyMode && view === "section" && (sectionChanged || viewChanged || window.location.hash !== hash)) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      if (historyMode === "push") {
        // Count the entries since the topic list, so "All topics" can step back past followed links.
        const hubDepth = Number(history.state?.guideHubDepth) || 0;
        history.pushState({ ...history.state, guideHubDepth: compactViewChange ? 1 : (hubDepth ? hubDepth + 1 : 0) }, "", url);
      } else {
        history.replaceState(history.state, "", url);
      }
    }
    activeGuideId = nextId;
    syncMobileNavigation(nextId);
    updateSectionNavigation(nextId);

    if (scroll && targetSection) {
      const behavior = scrollBehavior || (prefersReducedMotion() || compactViewChange ? "instant" : "smooth");
      if (anchor && view === "section") {
        // The section has only just been shown, so measure the subsection on the next frame.
        window.requestAnimationFrame(() => anchor.scrollIntoView({ block: "start", behavior: sectionChanged ? "instant" : behavior }));
      } else if (compactLayout.matches && view === "hub") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      } else if (compactLayout.matches && guideLayout) {
        const navbar = document.querySelector(".navbar");
        const navHeight = navbar instanceof HTMLElement ? Math.ceil(navbar.getBoundingClientRect().height) : 70;
        const top = Math.max(0, guideLayout.getBoundingClientRect().top + window.scrollY - navHeight - 12);
        window.scrollTo({ top, left: 0, behavior });
      } else if (historyMode === "push") {
        window.scrollTo({ top: 0, left: 0, behavior });
      }
    }
  };

  /**
   * Finds the section for a guide id: a section itself, or a subsection heading inside one.
   * @param {string} id
   * @returns {{ sectionId: string, anchor: HTMLElement | null } | null}
   */
  const resolveTarget = (id) => {
    const key = String(id || "").trim().replace(/^#/, "");
    if (!key) return null;
    if (sectionById.has(key)) return { sectionId: key, anchor: null };
    const element = document.getElementById(key);
    const section = element instanceof HTMLElement ? element.closest(".guide-section[id]") : null;
    return section && sectionById.has(section.id) ? { sectionId: section.id, anchor: element } : null;
  };

  const focusHeading = (heading) => {
    window.requestAnimationFrame(() => {
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  };

  const moveToSection = (id, historyMode = "replace") => {
    const target = resolveTarget(id);
    if (!target) return;
    activateSection(target.sectionId, { historyMode, scroll: true, anchor: target.anchor });
    focusHeading(target.anchor || sectionById.get(target.sectionId)?.querySelector("h2"));
  };

  const showHub = () => {
    activateSection(activeGuideId, { scroll: true, view: "hub" });
    navLinkFor(activeGuideId)?.focus();
  };

  const isGuideSectionHash = (hash) => Boolean(resolveTarget(hash));

  const isPlainClick = (event) => !(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

  // Event Listeners
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = String(link.dataset.guideHash || link.getAttribute("href") || "").replace("#", "");
      if (compactLayout.matches && currentView() === "hub") {
        // Opening a topic from the list adds a history entry, so the phone's Back returns to the list.
        moveToSection(targetId, "push");
        return;
      }
      if (navSheet instanceof HTMLDialogElement && navSheet.open) {
        // Closing the sheet returns focus to its button; move it on to the section just chosen.
        navSheet.close();
        moveToSection(targetId);
        return;
      }
      activateSection(targetId, {
        historyMode: "replace",
        scroll: true,
      });
    });
  });

  guideContent?.addEventListener("click", (event) => {
    if (!isPlainClick(event)) return;
    const link = event.target.closest('.guide-doc a[href^="guide.html#guide-"]');
    if (!link || !isGuideSectionHash(link.hash)) return;
    event.preventDefault();
    moveToSection(link.hash.slice(1), "push");
  });

  hubLink?.addEventListener("click", (event) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    closeNavSheet();
    const hubDepth = Number(history.state?.guideHubDepth) || 0;
    if (hubDepth > 0) {
      history.go(-hubDepth);
      return;
    }
    history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
    showHub();
  });

  if (navSheet instanceof HTMLDialogElement && mobileNavToggle) {
    enableDialogLightDismissFallback(navSheet);
    mobileNavToggle.addEventListener("click", () => {
      placeNav();
      navSheet.showModal();
      mobileNavToggle.setAttribute("aria-expanded", "true");
      guideNav?.querySelector('a[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    });
    navSheetClose?.addEventListener("click", () => navSheet.close());
    navSheet.addEventListener("close", () => {
      mobileNavToggle.setAttribute("aria-expanded", "false");
    });
  }

  compactLayout.addEventListener("change", placeNav);

  previousSectionButton.addEventListener("click", () => moveToSection(previousSectionButton.dataset.sectionId));
  nextSectionButton.addEventListener("click", () => moveToSection(nextSectionButton.dataset.sectionId));

  bindGuideHashChange(() => {
    const hash = String(window.location.hash || "");
    if (hash && !isGuideSectionHash(hash)) return;
    if (!hash) {
      showHub();
      return;
    }
    const target = resolveTarget(hash);
    activateSection(target.sectionId, {
      scroll: true,
      anchor: target.anchor,
    });
  });

  return {
    activateSection,
    resolveTarget,
    groupLabel,
    getActiveGuideId: () => activeGuideId,
    refreshLabels: () => {
      syncMobileNavigation(activeGuideId);
      updateSectionNavigation(activeGuideId);
    },
    sectionById,
  };
}

/**
 * Orders sections like the contents list so Previous and Next follow what readers see there.
 * @param {HTMLElement[]} sections
 * @param {HTMLAnchorElement[]} navLinks
 * @returns {HTMLElement[]}
 */
export function sectionsInNavOrder(sections, navLinks) {
  const order = navLinks.map((link) => String(link.getAttribute("href") || "").replace(/^.*#/, ""));
  const rank = (section) => {
    const index = order.indexOf(section.id);
    return index === -1 ? order.length : index;
  };
  return sections.toSorted((left, right) => rank(left) - rank(right));
}
