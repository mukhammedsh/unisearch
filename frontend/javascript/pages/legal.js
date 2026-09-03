/* legal.js - Скрипт оглавления, плавной прокрутки и scroll-spy для страниц Privacy Policy и Terms of Use */

let legalHashChangeHandler = null;
let legalExternalUpdateHandler = null;

function bindLegalHashChange(handler) {
  if (legalHashChangeHandler) {
    window.removeEventListener("hashchange", legalHashChangeHandler);
  }
  legalHashChangeHandler = handler;
  window.addEventListener("hashchange", legalHashChangeHandler);
}

function bindLegalExternalUpdates(handler) {
  if (legalExternalUpdateHandler) {
    window.removeEventListener("languageChanged", legalExternalUpdateHandler);
    window.removeEventListener("resize", legalExternalUpdateHandler);
  }
  legalExternalUpdateHandler = handler;
  window.addEventListener("languageChanged", legalExternalUpdateHandler);
  window.addEventListener("resize", legalExternalUpdateHandler);
}

export function initLegalPage() {
  const page = document.getElementById("legalPage");
  if (!page) return;

  const navLinks = Array.from(page.querySelectorAll(".legal-nav a"));
  const sections = Array.from(page.querySelectorAll(".legal-section[id]"));
  if (!sections.length) return;

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const getTargetIdFromHref = (href) => {
    const raw = String(href || "").trim();
    const hashIndex = raw.indexOf("#");
    return hashIndex >= 0 ? raw.slice(hashIndex + 1) : "";
  };

  function updateLegalNavHrefs() {
    navLinks.forEach((link) => {
      const current = String(link.dataset.legalHash || link.getAttribute("href") || "").trim();
      const hashIdx = current.indexOf("#");
      if (hashIdx === -1) return;
      const cleanHash = current.slice(hashIdx);
      link.dataset.legalHash = cleanHash;
      link.setAttribute("href", `${window.location.pathname}${window.location.search}${cleanHash}`);
    });
  }

  const activateSection = (sectionId, { updateHash = false, scroll = false, scrollBehavior = null } = {}) => {
    const targetId = String(sectionId || "").trim();
    const nextId = sectionById.has(targetId) ? targetId : (sections[0]?.id || "");
    if (!nextId) return;

    const targetSection = sectionById.get(nextId);

    let sectionChanged = false;
    sections.forEach((s) => {
      const active = s.id === nextId;
      const wasActive = s.classList.contains("is-active");
      if (active && !wasActive) sectionChanged = true;
      s.classList.toggle("is-active", active);
    });

    navLinks.forEach((link) => {
      const linkId = getTargetIdFromHref(link.dataset.legalHash || link.getAttribute("href"));
      const isActive = linkId === nextId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
        // Scroll horizontal navigation ribbon into view on mobile
        if (typeof link.scrollIntoView === "function" && window.innerWidth <= 980) {
          link.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (updateHash && sectionChanged) {
      const currentHash = String(window.location.hash || "").replace("#", "");
      if (currentHash !== nextId) {
        try {
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${nextId}`);
        } catch (e) {
          // ignore
        }
      }
    }

    if (scroll && targetSection) {
      const behavior = scrollBehavior || (prefersReducedMotion ? "auto" : "smooth");
      // Первая секция находится прямо под шапкой (hero-блоком).
      // Чтобы не срезать заголовок, прокручиваем в самый верх страницы (0, 0).
      if (nextId === sections[0]?.id) {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior,
        });
      } else {
        targetSection.scrollIntoView({
          behavior,
          block: "start",
        });
      }
    }
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const targetId = getTargetIdFromHref(link.dataset.legalHash || link.getAttribute("href"));
      activateSection(targetId, { updateHash: true, scroll: true });
    });
  });

  bindLegalHashChange(() => {
    const hash = String(window.location.hash || "").replace("#", "");
    if (hash && sectionById.has(hash)) {
      activateSection(hash, { updateHash: false, scroll: true });
    } else if (!hash) {
      activateSection(sections[0]?.id, { updateHash: false, scroll: true });
    }
  });

  let scrollTicking = false;
  const syncActiveSectionFromScroll = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const windowHeight = window.innerHeight;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      // 1. Самый верх страницы (первые 90px): гарантированно выбирается самый верхний пункт
      if (scrollY <= 90) {
        activateSection(sections[0].id, { updateHash: true, scroll: false });
        scrollTicking = false;
        return;
      }

      // 2. Самый низ страницы (с запасом 60px): гарантированно выбирается самый нижний пункт
      if ((windowHeight + scrollY) >= (docHeight - 60)) {
        activateSection(sections[sections.length - 1].id, { updateHash: true, scroll: false });
        scrollTicking = false;
        return;
      }

      // 3. Средняя часть страницы: выбор секции по наилучшему перекрытию области чтения
      const viewportTop = 110;
      const viewportBottom = windowHeight - 120;
      let currentId = sections[0]?.id || "";
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, viewportTop);
        const visibleBottom = Math.min(rect.bottom, viewportBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const distancePenalty = Math.abs(rect.top - viewportTop) * 0.08;
        const score = visibleHeight - distancePenalty;

        if (score > bestScore) {
          bestScore = score;
          currentId = section.id;
        }
      }

      if (currentId) {
        activateSection(currentId, { updateHash: true, scroll: false });
      }
      scrollTicking = false;
    });
  };

  updateLegalNavHrefs();
  window.addEventListener("scroll", syncActiveSectionFromScroll, { passive: true });

  bindLegalExternalUpdates(() => {
    updateLegalNavHrefs();
    syncActiveSectionFromScroll();
  });

  // Начальная позиция при открытии страницы
  const initialHash = String(window.location.hash || "").replace("#", "");
  if (initialHash && sectionById.has(initialHash)) {
    if (initialHash === sections[0]?.id) {
      activateSection(initialHash, { updateHash: false, scroll: false });
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } else {
      activateSection(initialHash, { updateHash: false, scroll: true, scrollBehavior: "auto" });
    }
  } else {
    activateSection(sections[0]?.id, { updateHash: false, scroll: false });
    if (window.history && "scrollRestoration" in window.history) {
      try {
        window.history.scrollRestoration = "manual";
      } catch {}
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  syncActiveSectionFromScroll();
}
