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

    function scrollNavIntoView(link) {
      if (!link || window.innerWidth > 980) return;
      const nav = link.closest(".legal-nav");
      if (!nav) return;

      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const isOffLeft = linkRect.left < navRect.left + 16;
      const isOffRight = linkRect.right > navRect.right - 16;

      if (isOffLeft || isOffRight) {
        const scrollTarget = link.offsetLeft - (nav.clientWidth - link.clientWidth) / 2;
        nav.scrollTo({
          left: Math.max(0, scrollTarget),
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      }
    }

    let isProgrammaticScrolling = false;
    let scrollEndTimeout = null;

    const stopProgrammaticScroll = () => {
      if (isProgrammaticScrolling) {
        isProgrammaticScrolling = false;
        if (scrollEndTimeout) {
          clearTimeout(scrollEndTimeout);
          scrollEndTimeout = null;
        }
      }
    };

    const startProgrammaticScroll = () => {
      isProgrammaticScrolling = true;
      if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
      scrollEndTimeout = setTimeout(() => {
        isProgrammaticScrolling = false;
        scrollEndTimeout = null;
      }, 700);
    };

    window.addEventListener("scrollend", stopProgrammaticScroll, { passive: true });
    window.addEventListener("wheel", stopProgrammaticScroll, { passive: true });
    window.addEventListener("touchstart", stopProgrammaticScroll, { passive: true });

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
          scrollNavIntoView(link);
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
        startProgrammaticScroll();
        activateSection(targetId, { updateHash: true, scroll: true });
      });
    });

    bindLegalHashChange(() => {
      const hash = String(window.location.hash || "").replace("#", "");
      if (hash && sectionById.has(hash)) {
        startProgrammaticScroll();
        activateSection(hash, { updateHash: false, scroll: true });
      } else if (!hash) {
        startProgrammaticScroll();
        activateSection(sections[0]?.id, { updateHash: false, scroll: true });
      }
    });

    function getAnchorTop() {
      const isMobile = window.innerWidth <= 980;
      if (isMobile) {
        const navbar = document.querySelector(".navbar");
        const navHeight = navbar instanceof HTMLElement ? navbar.getBoundingClientRect().height : 70;
        return navHeight + 75;
      }
      return 115;
    }

    let scrollTicking = false;
    const syncActiveSectionFromScroll = () => {
      if (isProgrammaticScrolling) return;
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(() => {
        scrollTicking = false;
        if (isProgrammaticScrolling) return;

        const scrollY = window.scrollY || window.pageYOffset || 0;
        const windowHeight = window.innerHeight;
        const docHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );

        // 1. Самый низ страницы: принудительно выбирается последний пункт
        if (Math.ceil(windowHeight + scrollY) >= docHeight - 30) {
          activateSection(sections[sections.length - 1].id, { updateHash: true, scroll: false });
          return;
        }

        const anchorTop = getAnchorTop();

        // 2. Самый верх страницы: если первая секция еще не дошла до зоны чтения
        const firstRect = sections[0].getBoundingClientRect();
        if (scrollY < 40 || firstRect.top > anchorTop) {
          const shouldUpdateHash = Boolean(window.location.hash);
          activateSection(sections[0].id, { updateHash: shouldUpdateHash, scroll: false });
          return;
        }

        // 3. Последовательный зонд: находим последнюю секцию, верх которой прошел линию чтения
        let currentId = sections[0].id;
        for (let i = 0; i < sections.length; i++) {
          const rect = sections[i].getBoundingClientRect();
          if (rect.top <= anchorTop) {
            currentId = sections[i].id;
          } else {
            break;
          }
        }

        if (currentId) {
          activateSection(currentId, { updateHash: true, scroll: false });
        }
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
      startProgrammaticScroll();
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
