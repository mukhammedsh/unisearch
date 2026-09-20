import {
  EXAM_CONFIG,
  LANG_CONFIG,
  aiName,
  canonicalizeExamId,
  escapeHtml,
  getExamDisplayName,
  replayMotion,
} from "../utils.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { heroIcon } from "../icons.js";

let guideExternalUpdateHandler = null;
let guideHashChangeHandler = null;

function bindGuideExternalUpdates(handler) {
  if (guideExternalUpdateHandler) {
    window.removeEventListener("languageChanged", guideExternalUpdateHandler);
    window.removeEventListener("examConfigLoaded", guideExternalUpdateHandler);
    window.removeEventListener("languageConfigLoaded", guideExternalUpdateHandler);
  }
  guideExternalUpdateHandler = handler;
  window.addEventListener("languageChanged", guideExternalUpdateHandler);
  window.addEventListener("examConfigLoaded", guideExternalUpdateHandler);
  window.addEventListener("languageConfigLoaded", guideExternalUpdateHandler);
}

function bindGuideHashChange(handler) {
  if (guideHashChangeHandler) {
    window.removeEventListener("hashchange", guideHashChangeHandler);
  }
  guideHashChangeHandler = handler;
  window.addEventListener("hashchange", guideHashChangeHandler);
}

export function initGuidePage() {
  const page = document.getElementById("guidePage");
  if (!page) return;
  const navLinks = Array.from(page.querySelectorAll(".guide-nav a[href^='#guide-']"));
  const sections = Array.from(page.querySelectorAll(".guide-section[id]"));
  const mobileNavToggle = document.getElementById("guideMobileNavToggle");
  const guideNav = document.getElementById("guideNav");

  const academicWrap = document.getElementById("guideAcademicExams");
  const languageWrap = document.getElementById("guideLanguageExams");
  const glossaryWrap = document.getElementById("guideGlossary");

  const normalizeExamId = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stableExamSortKey = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const canonical = canonicalizeExamId(raw);
    return normalizeExamId(canonical || raw) || normalizeExamId(raw);
  };
  const scoreScaleText = (cfg) => {
    const inputMode = String(cfg?.input_mode || "").trim().toLowerCase();
    if (inputMode && inputMode !== "number") return "";
    const min = Number(cfg?.min);
    const max = Number(cfg?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";
    return tFormat("guide.scale_text", { min, max }, `In UniSearch, this score is entered on a ${min}-${max} scale.`);
  };

  const guideLoadingMarkup = (label) => `
    <div class="inline-loading-note inline-loading-note--compact" role="status" aria-live="polite">
      ${escapeHtml(String(label || t("common.loading", "Loading")))}
    </div>
  `;

  function withExamLabel(description, examLabel) {
    const desc = String(description || "").trim();
    const label = String(examLabel || "").trim();
    if (!label) return desc;
    if (!desc) return label;
    if (desc.toLocaleLowerCase().startsWith(label.toLocaleLowerCase())) return desc;
    return tFormat("guide.exam_desc_with_label", { exam: label, desc }, `${label} - ${desc}`);
  }

  function describeAcademicExam(id, cfg, labelText = "") {
    const normalized = normalizeExamId(id);
    const descriptions = {
      SAT: t("guide.academic.sat", "The American admission test of reading, writing, and math, recognized far beyond the US."),
      ACT: t("guide.academic.act", "Its counterpart, covering English, math, reading, and science reasoning."),
      GPA: t("guide.academic.gpa", "Your average school grade, normalized to a 4.0 scale inside UniSearch so that countries stay comparable."),
      UNT: t("guide.academic.unt", "Kazakhstan's national test and the main road to a bachelor's seat at home."),
      NUETTOTAL: t("guide.academic.nuettotal", "The combined score of a single university's own entrance exam, valid only on its routes."),
      APTOTAL: t("guide.academic.aptotal", "Combined performance across AP subjects, for systems that recognize them."),
      IBDIPLOMA: t("guide.academic.ibdiploma", "The IB Diploma total, accepted by universities worldwide."),
      ALEVELCERT: t("guide.academic.alevelcert", "British A-Level subject grades — enter them as A*AA, and the best three are converted into a comparable score."),
      HKDSELEVEL: t("guide.academic.hkdselevel", "Hong Kong secondary-school levels, converted internally with 5* counting as 6 and 5** as 7."),
      SWISSMATURITYCERT: t("guide.academic.swissmaturitycert", "The Swiss Matura, the general certificate that opens the country's universities."),
      GERMANABITURCERT: t("guide.academic.germanabiturcert", "The German Abitur, the general certificate that opens the country's universities."),
      OSSDCERT: t("guide.academic.ossdcert", "Completion of the Ontario Secondary School Diploma for Canadian admissions."),
    };
    const base = descriptions[normalized]
      || t("guide.academic.default", "An academic score that at least one requirement profile asks for.");
    const scale = scoreScaleText(cfg);
    return withExamLabel(`${base}${scale ? ` ${scale}` : ""}`.trim(), labelText);
  }

  function describeLanguageExam(examId, langCode, cfg, labelText = "") {
    const exam = String(examId || "").toUpperCase();
    const label = String(labelText || "").toUpperCase();
    const key = `${exam} ${label}`;

    let base = t("guide.language.default", "A language proof that at least one admission choice accepts.");
    if (key.includes("IELTS")) base = t("guide.language.ielts", "The English test of listening, reading, writing, and speaking, accepted almost everywhere.");
    else if (key.includes("TOEFL")) base = t("guide.language.toefl", "Academic English testing, strongest in American admissions.");
    else if (key.includes("DUOLINGO") || key.includes("DET")) base = t("guide.language.det", "The online adaptive English test: taken at home and accepted by a growing list of universities.");
    else if (key.includes("PTE")) base = t("guide.language.pte", "The fully computer-based English test with fast results.");
    else if (key.includes("CAMBRIDGE")) base = t("guide.language.cambridge", "Cambridge English qualifications, pegged to CEFR levels and valid for years.");
    else if (key.includes("TESTDAF") || key.includes("DSH")) base = t("guide.language.german", "TestDaF and DSH open German-taught tracks — most routes ask for one of the two.");
    else if (key.includes("DELF") || key.includes("DALF") || key.includes("TCF") || key.includes("TEF")) base = t("guide.language.french", "DELF, DALF, TCF, and TEF open French-taught tracks, depending on the route.");
    else if (key.includes("NT2")) base = t("guide.language.dutch", "NT2 Dutch, the proof that Dutch-taught programs ask for.");
    else if (key.includes("HSK")) base = t("guide.language.hsk", "The official ladder of Chinese proficiency, climbed level by level.");
    else if (key.includes("JLPT")) base = t("guide.language.jlpt", "The five levels of Japanese, running backwards: a lower number means stronger language, so N1 beats N5.");
    else if (key.includes("TOPIK")) base = t("guide.language.topik", "The Korean proficiency scale used for Korean-taught admission.");
    else if (langCode) base = tFormat("guide.language.by_code", { code: String(langCode).toUpperCase() }, `A language proof accepted on ${String(langCode).toUpperCase()}-taught routes.`);

    const scale = scoreScaleText(cfg);
    return withExamLabel(`${base}${scale ? ` ${scale}` : ""}`.trim(), labelText);
  }

  function glossaryEntries() {
    const fitName = aiName("fit");
    const chanceName = aiName("chance");
    return [
      { term: fitName, desc: tFormat("guide.glossary.fit", { fit: fitName }, `${fitName} is the sorting mode that ranks the catalog by your profile, where a lower score ranks higher.`) },
      { term: chanceName, desc: tFormat("guide.glossary.chance", { chance: chanceName }, `${chanceName} is the 0–100 admission estimate for one choice; the card shows your best choice.`) },
      { term: t("guide.glossary.term.admission_track", "Admission Choice"), desc: t("guide.glossary.admission_track", "Category, profile, and funding selected together as one choice — the unit everything is computed for.") },
      { term: t("guide.glossary.term.requirements", "Requirements"), desc: t("guide.glossary.requirements", "The minimum scores a profile demands before an application is even considered.") },
      { term: t("guide.glossary.term.stats_avg", "Average (Admitted)"), desc: t("guide.glossary.stats_avg", "The average scores of previously admitted students — the number worth planning against.") },
      { term: t("guide.glossary.term.language_requirements", "Language Requirements"), desc: t("guide.glossary.language_requirements", "The language proofs a route accepts: native language, CEFR level, or exam score.") },
      { term: t("guide.glossary.term.roi", "ROI"), desc: t("guide.glossary.roi", "Early salary divided by one year of cost: a planning ratio, not a promise.") },
      { term: t("guide.glossary.term.comparison", "Comparison"), desc: t("guide.glossary.comparison", "The side-by-side table that compares only same-scope published numbers and never names an overall winner.") },
      { term: t("guide.glossary.term.mode_any", "Mode = any"), desc: t("guide.glossary.mode_any", "A single proof from the language list is enough.") },
      { term: t("guide.glossary.term.mode_all", "Mode = all"), desc: t("guide.glossary.mode_all", "Every proof from the language list is required.") },
      { term: t("guide.glossary.term.match_score", "Match Score"), desc: tFormat("guide.glossary.match_score", { fit: fitName }, `The internal ${fitName} ranking number that orders the list.`) },
    ];
  }

  function getLanguageTitle(code, fallback = "") {
    const normalized = String(code || "").trim().toLowerCase();
    const fallbackLabel = String(fallback || "").trim() || String(code || "").toUpperCase();
    if (!normalized) return fallbackLabel;
    return t(`languages.name.${normalized}`, fallbackLabel);
  }

  function renderGlossary() {
    if (!glossaryWrap) return;
    const items = glossaryEntries().map((entry) => `<li><strong>${escapeHtml(entry.term)}:</strong> ${escapeHtml(entry.desc)}</li>`).join("");
    glossaryWrap.innerHTML = `<p>${escapeHtml(t("guide.glossary.intro", "The working vocabulary of the site — the same meanings the calculations rely on, one line per term."))}</p><ul class="guide-list">${items}</ul>`;
  }

  function renderAcademicExams() {
    if (!academicWrap) return;
    const languageExamIds = new Set();
    const groups = LANG_CONFIG?.language_exams || {};
    for (const arr of Object.values(groups)) {
      if (!Array.isArray(arr)) continue;
      arr.forEach((item) => languageExamIds.add(String(item?.id || "").trim()));
    }

    const seen = new Set();
    const exams = Object.entries(EXAM_CONFIG || {})
      .filter(([id]) => !languageExamIds.has(String(id)))
      .filter(([, cfg]) => !cfg?.hidden)
      .filter(([id]) => {
        const normalized = canonicalizeExamId(id);
        const key = String(normalized || id).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const left = stableExamSortKey(a[0]);
        const right = stableExamSortKey(b[0]);
        const byKey = left.localeCompare(right);
        if (byKey !== 0) return byKey;
        return String(a[0] || "").localeCompare(String(b[0] || ""));
      });

    if (!exams.length) {
      academicWrap.innerHTML = guideLoadingMarkup(t("guide.loading_exam_config", "Loading exam config"));
      return;
    }

    const items = exams.map(([id, cfg]) => {
      const examLabel = getExamDisplayName(id, { locale: getCurrentLanguage() });
      return `<li>${escapeHtml(describeAcademicExam(id, cfg, examLabel))}</li>`;
    }).join("");
    academicWrap.innerHTML = `<p>${escapeHtml(t("guide.academic.intro", "These are the academic exams UniSearch actually matches against requirement profiles. Enter yours in the profile and every relevant choice is re-scored:"))}</p><ul class="guide-list">${items}</ul>`;
  }

  function renderLanguageExams() {
    if (!languageWrap) return;
    const groups = LANG_CONFIG?.language_exams || {};
    const languages = LANG_CONFIG?.languages || [];
    const nameByCode = Object.fromEntries(languages.map((item) => [item.code, item.name || item.label || item.code]));
    const codes = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    if (!codes.length) {
      languageWrap.innerHTML = guideLoadingMarkup(t("guide.loading_language_config", "Loading language exam config"));
      return;
    }

    languageWrap.innerHTML = codes.map((code) => {
      const arr = Array.isArray(groups[code]) ? groups[code] : [];
      if (!arr.length) return "";
      const title = getLanguageTitle(code, nameByCode[code] || code.toUpperCase());
      const sortedArr = [...arr].sort((a, b) => {
        const left = stableExamSortKey(a?.id);
        const right = stableExamSortKey(b?.id);
        const byKey = left.localeCompare(right);
        if (byKey !== 0) return byKey;
        return String(a?.id || "").localeCompare(String(b?.id || ""));
      });

      return `
        <section class="guide-subsection" id="guide-lang-${escapeHtml(String(code).toLowerCase())}">
          <h4>${escapeHtml(title)} (${escapeHtml(code.toUpperCase())})</h4>
          <ul class="guide-list">
            ${sortedArr.map((exam) => {
              const examLabel = getExamDisplayName(exam?.id, { langCode: code, locale: getCurrentLanguage() });
              return `<li>${escapeHtml(describeLanguageExam(exam?.id, code, exam, examLabel))}</li>`;
            }).join("")}
          </ul>
        </section>
      `;
    }).join("");
  }

  function renderAll() {
    renderGlossary();
    renderAcademicExams();
    renderLanguageExams();
  }

  function syncGuideSidebarOffset() {
    const navbar = document.querySelector(".navbar");
    const navbarHeight = navbar instanceof HTMLElement ? Math.ceil(navbar.getBoundingClientRect().height) : 72;
    page.style.setProperty("--guide-sidebar-offset", `${navbarHeight + 10}px`);
  }

  function updateGuideNavHrefs() {
    navLinks.forEach((link) => {
      const hash = String(link.dataset.guideHash || link.getAttribute("href") || "").trim();
      if (!/^#guide-[a-z0-9-]+$/i.test(hash)) return;
      link.dataset.guideHash = hash;
      link.setAttribute("href", `${window.location.pathname}${window.location.search}${hash}`);
    });
  }


  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const guideLayout = page.querySelector(".guide-layout");
  const guideContent = page.querySelector(".guide-content");
  const sectionNavigation = document.createElement("nav");
  const previousSectionButton = document.createElement("button");
  const nextSectionButton = document.createElement("button");
  let activeGuideId = sections[0]?.id || "";

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

  const previousGuideId = (id) => {
    const currentIndex = sections.findIndex((section) => section.id === id);
    return currentIndex > 0 ? sections[currentIndex - 1].id : "";
  };
  const nextGuideId = (id) => {
    const currentIndex = sections.findIndex((section) => section.id === id);
    return currentIndex >= 0 ? (sections[currentIndex + 1]?.id || "") : "";
  };

  const sectionLabel = (id) => {
    const link = navLinks.find((item) => String(item.dataset.guideHash || item.getAttribute("href") || "").endsWith(`#${id}`));
    return String(link?.textContent || "").trim() || id;
  };

  const closeMobileNavigation = ({ restoreFocus = false } = {}) => {
    if (!mobileNavToggle || !guideNav) return;
    guideNav.classList.remove("is-mobile-open");
    mobileNavToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) mobileNavToggle.focus();
  };

  const syncMobileNavigation = (id) => {
    const label = sectionLabel(id);
    if (mobileNavToggle) {
      mobileNavToggle.setAttribute("aria-label", tFormat("guide.contents_current", { section: label }, `Contents: ${label}`));
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

  const moveToSection = (id) => {
    const targetId = String(id || "").trim();
    if (!sectionById.has(targetId)) return;
    activateSection(targetId, { updateHash: true, scroll: true });
    window.requestAnimationFrame(() => {
      const heading = sectionById.get(targetId)?.querySelector("h2");
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  };

  const isGuideSectionHash = (hash) => sectionById.has(String(hash || "").replace("#", ""));

  const activateSection = (id, { updateHash = false, scroll = false, scrollBehavior = null } = {}) => {
    const nextId = sectionById.has(id) ? id : (sections[0]?.id || "");
    if (!nextId) return;
    const targetSection = sectionById.get(nextId);

    let sectionChanged = false;
    sections.forEach((section) => {
      const active = section.id === nextId;
      const wasActive = section.classList.contains("is-active");
      if (active && !wasActive) {
        sectionChanged = true;
      }
      section.classList.toggle("is-active", active);
      section.setAttribute("aria-hidden", active ? "false" : "true");
      section.hidden = !active;
      if (active && !wasActive) replayMotion(section, "motion-state-pulse", { timeoutMs: 520 });
    });
    navLinks.forEach((link) => {
      const active = String(link.dataset.guideHash || link.getAttribute("href") || "").trim() === `#${nextId}`;
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (updateHash && sectionChanged) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${nextId}`);
    }
    activeGuideId = nextId;
    syncMobileNavigation(nextId);
    updateSectionNavigation(nextId);
    if (scroll && targetSection) {
      const behavior = scrollBehavior || (prefersReducedMotion ? "auto" : "smooth");
      const isMobileLayout = window.innerWidth <= 1024;
      if (isMobileLayout && guideLayout) {
        const navbar = document.querySelector(".navbar");
        const navHeight = navbar instanceof HTMLElement ? Math.ceil(navbar.getBoundingClientRect().height) : 70;
        const top = Math.max(0, guideLayout.getBoundingClientRect().top + window.scrollY - navHeight - 12);
        window.scrollTo({ top, left: 0, behavior });
      }
    }
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = String(link.dataset.guideHash || link.getAttribute("href") || "").replace("#", "");
      closeMobileNavigation();
      activateSection(targetId, {
        updateHash: true,
        scroll: true,
      });
    });
  });

  mobileNavToggle?.addEventListener("click", () => {
    if (!guideNav) return;
    const expanded = mobileNavToggle.getAttribute("aria-expanded") === "true";
    guideNav.classList.toggle("is-mobile-open", !expanded);
    mobileNavToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileNavToggle?.getAttribute("aria-expanded") === "true") {
      closeMobileNavigation({ restoreFocus: true });
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) closeMobileNavigation();
  });

  previousSectionButton.addEventListener("click", () => moveToSection(previousSectionButton.dataset.sectionId));
  nextSectionButton.addEventListener("click", () => moveToSection(nextSectionButton.dataset.sectionId));

  bindGuideHashChange(() => {
    const hash = String(window.location.hash || "");
    if (!isGuideSectionHash(hash)) return;
    activateSection(hash.replace("#", ""), {
      updateHash: false,
      scroll: true,
    });
  });

  syncGuideSidebarOffset();
  updateGuideNavHrefs();
  renderAll();

  const initialHash = String(window.location.hash || "").replace("#", "");
  activateSection(sectionById.has(initialHash) ? initialHash : (sections[0]?.id || "guide-unifit"), { updateHash: false, scroll: false });
  if (window.history && "scrollRestoration" in window.history) {
    try {
      window.history.scrollRestoration = "manual";
    } catch {}
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  window.addEventListener("resize", () => {
    syncGuideSidebarOffset();
  });
  bindGuideExternalUpdates(() => {
    syncGuideSidebarOffset();
    updateGuideNavHrefs();
    renderAll();
    updateSectionNavigation(activeGuideId);
  });
}
