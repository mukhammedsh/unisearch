import {
  EXAM_CONFIG,
  LANG_CONFIG,
  aiName,
  canonicalizeExamId,
  escapeHtml,
  getExamDisplayName,
  replayMotion,
  setManualScrollRestoration,
} from "../utils.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { heroIcon } from "../icons.js";
import { bindGuideExternalUpdates, bindGuideHashChange } from "./shared/cache.js";

function normalizeExamId(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stableExamSortKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const canonical = canonicalizeExamId(raw);
  return normalizeExamId(canonical || raw) || normalizeExamId(raw);
}

function scoreScaleText(cfg) {
  const inputMode = String(cfg?.input_mode || "").trim().toLowerCase();
  if (inputMode && inputMode !== "number") return "";
  const min = Number(cfg?.min);
  const max = Number(cfg?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return "";
  return tFormat("guide.scale_text", { min, max }, `Enter a score from ${min} to ${max}.`);
}

function guideLoadingMarkup(label) {
  return `
    <div class="inline-loading-note inline-loading-note--compact" role="status" aria-live="polite">
      ${escapeHtml(String(label || t("common.loading", "Loading")))}
    </div>
  `;
}

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
    SAT: t("guide.academic.sat", "An admissions test covering reading, writing, and mathematics. Check whether your chosen university accepts it."),
    ACT: t("guide.academic.act", "An admissions test that assesses academic skills, including English and mathematics."),
    GPA: t("guide.academic.gpa", "Your grade average. Enter the value and its original scale, such as out of 4 or out of 5."),
    UNT: t("guide.academic.unt", "Kazakhstan's Unified National Testing exam. Its results are used for undergraduate admissions where UNT is listed as a requirement."),
    NUETTOTAL: t("guide.academic.nuettotal", "The total score for the Nazarbayev University Entrance Test (NUET)."),
    APTOTAL: t("guide.academic.aptotal", "The combined score for Advanced Placement (AP) exams. It applies when the published requirements call for a combined score."),
    IBDIPLOMA: t("guide.academic.ibdiploma", "The total score for the International Baccalaureate Diploma."),
    ALEVELCERT: t("guide.academic.alevelcert", "A-Level subject grades. Enter them in a format such as A*AA. UniSearch converts the three highest grades to a combined score."),
    HKDSELEVEL: t("guide.academic.hkdselevel", "Grades from Hong Kong's secondary school examination. On the UniSearch scale, 5* corresponds to 6 and 5** corresponds to 7."),
    SWISSMATURITYCERT: t("guide.academic.swissmaturitycert", "The Swiss upper-secondary certificate (Matura), which can be used for university admission."),
    GERMANABITURCERT: t("guide.academic.germanabiturcert", "The German Abitur qualification, which can be used for university admission."),
    OSSDCERT: t("guide.academic.ossdcert", "The secondary school diploma awarded in Ontario, Canada."),
  };
  const base = descriptions[normalized]
    || t("guide.academic.default", "An academic result listed in published admission requirements.");
  const scale = scoreScaleText(cfg);
  return withExamLabel(`${base}${scale ? ` ${scale}` : ""}`.trim(), labelText);
}

function describeLanguageExam(examId, langCode, cfg, labelText = "") {
  const exam = String(examId || "").toUpperCase();
  const label = String(labelText || "").toUpperCase();
  const key = `${exam} ${label}`;

  let base = t("guide.language.default", "Proof of language proficiency. Check the application requirements for accepted options.");
  if (key.includes("IELTS")) base = t("guide.language.ielts", "An English proficiency test covering listening, reading, writing, and speaking.");
  else if (key.includes("TOEFL")) base = t("guide.language.toefl", "A test of English proficiency for academic study.");
  else if (key.includes("DUOLINGO") || key.includes("DET")) base = t("guide.language.det", "The Duolingo English Test assesses English proficiency online. Check whether your chosen university accepts it.");
  else if (key.includes("PTE")) base = t("guide.language.pte", "A computer-based English proficiency test.");
  else if (key.includes("CAMBRIDGE")) base = t("guide.language.cambridge", "Cambridge English qualifications certify an English level on the CEFR scale. Check which qualification and score the university accepts.");
  else if (key.includes("TESTDAF") || key.includes("DSH")) base = t("guide.language.german", "TestDaF and DSH assess German proficiency. Check which exam and result the university accepts.");
  else if (key.includes("DELF") || key.includes("DALF") || key.includes("TCF") || key.includes("TEF")) base = t("guide.language.french", "DELF, DALF, TCF, and TEF assess French proficiency. Accepted exams and minimum results depend on the program.");
  else if (key.includes("NT2")) base = t("guide.language.dutch", "The NT2 exam assesses Dutch proficiency.");
  else if (key.includes("HSK")) base = t("guide.language.hsk", "The HSK exam assesses Chinese proficiency.");
  else if (key.includes("JLPT")) base = t("guide.language.jlpt", "A Japanese proficiency test with five levels. N5 is the introductory level and N1 is the highest.");
  else if (key.includes("TOPIK")) base = t("guide.language.topik", "A Korean proficiency test. If the university accepts TOPIK, check its admission requirements for the required level.");
  else if (langCode) base = tFormat("guide.language.by_code", { code: String(langCode).toUpperCase() }, `Proof of proficiency in the language with code ${String(langCode).toUpperCase()}. Check whether your chosen university accepts it.`);

  const scale = scoreScaleText(cfg);
  return withExamLabel(`${base}${scale ? ` ${scale}` : ""}`.trim(), labelText);
}

function glossaryEntries() {
  const fitName = aiName("fit");
  const chanceName = aiName("chance");
  return [
    { term: fitName, desc: tFormat("guide.glossary.fit", { fit: fitName }, `${fitName} sorts universities using your profile and the available catalog information.`) },
    { term: chanceName, desc: tFormat("guide.glossary.chance", { chance: chanceName }, `${chanceName} is the share of academic and language minimums your profile meets among those the site can check.`) },
    { term: t("guide.glossary.term.admission_track", "Study option and application route"), desc: t("guide.glossary.admission_track", "A study option and the way the university accepts applications for it. Requirements may depend on applicant category, entry year, and fee category.") },
    { term: t("guide.glossary.term.requirements", "Requirements"), desc: t("guide.glossary.requirements", "Published conditions for admission to the selected study option. These may include minimum scores, prerequisites, and documents.") },
    { term: t("guide.glossary.term.stats_avg", "Average score of admitted students"), desc: t("guide.glossary.stats_avg", "The average score of students admitted in the period shown. It gives you a reference point from previous intakes.") },
    { term: t("guide.glossary.term.language_requirements", "Language Requirements"), desc: t("guide.glossary.language_requirements", "The university's rules for confirming proficiency in the language of instruction. Accepted evidence may include an exam result, a CEFR level, or a first language.") },
    { term: t("guide.glossary.term.comparison", "Comparison"), desc: t("guide.glossary.comparison", "A table that shows information for two universities side by side and identifies differences and missing data.") },
    { term: t("guide.glossary.term.mode_any", "Any one form of evidence accepted"), desc: t("guide.glossary.mode_any", "Provide any one of the listed forms of language evidence.") },
    { term: t("guide.glossary.term.mode_all", "All forms of evidence required"), desc: t("guide.glossary.mode_all", "Provide all listed forms of language evidence.") },
    { term: t("guide.glossary.term.match_score", "UniFit ranking score"), desc: tFormat("guide.glossary.match_score", { fit: fitName }, `The score ${fitName} uses to order universities. Universities with a smaller gap from your profile appear higher.`) },
  ];
}

function getLanguageTitle(code, fallback = "") {
  const normalized = String(code || "").trim().toLowerCase();
  const fallbackLabel = String(fallback || "").trim() || String(code || "").toUpperCase();
  if (!normalized) return fallbackLabel;
  return t(`languages.name.${normalized}`, fallbackLabel);
}

function renderGlossary(glossaryWrap) {
  if (!glossaryWrap) return;
  const items = glossaryEntries().map((entry) => `<li><strong>${escapeHtml(entry.term)}:</strong> ${escapeHtml(entry.desc)}</li>`).join("");
  glossaryWrap.innerHTML = `<p>${escapeHtml(t("guide.glossary.intro", "These terms appear in the catalog and on university pages."))}</p><ul class="guide-list">${items}</ul>`;
}

function renderAcademicExams(academicWrap) {
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
    academicWrap.innerHTML = guideLoadingMarkup(t("guide.loading_exam_config", "Loading academic exams"));
    return;
  }

  const items = exams.map(([id, cfg]) => {
    const examLabel = getExamDisplayName(id, { locale: getCurrentLanguage() });
    return `<li>${escapeHtml(describeAcademicExam(id, cfg, examLabel))}</li>`;
  }).join("");
  academicWrap.innerHTML = `<p>${escapeHtml(t("guide.academic.intro", "Add your grades and exam results in Profile. To find out which results a university accepts, check the application requirements for your study option."))}</p><ul class="guide-list">${items}</ul>`;
}

function renderLanguageExams(languageWrap) {
  if (!languageWrap) return;
  const groups = LANG_CONFIG?.language_exams || {};
  const languages = LANG_CONFIG?.languages || [];
  const nameByCode = Object.fromEntries(languages.map((item) => [item.code, item.name || item.label || item.code]));
  const codes = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  if (!codes.length) {
    languageWrap.innerHTML = guideLoadingMarkup(t("guide.loading_language_config", "Loading language exams"));
    return;
  }

  languageWrap.innerHTML = codes.map((code) => {
    const arr = Array.isArray(groups[code]) ? groups[code] : [];
    if (!arr.length) return "";
    const title = getLanguageTitle(code, nameByCode[code] || code.toUpperCase());
    const sortedArr = arr.toSorted((a, b) => {
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

function syncGuideSidebarOffset(page) {
  const navbar = document.querySelector(".navbar");
  const navbarHeight = navbar instanceof HTMLElement ? Math.ceil(navbar.getBoundingClientRect().height) : 72;
  page.style.setProperty("--guide-sidebar-offset", `calc(${navbarHeight}px + var(--layout-page-gutter))`);
}

function updateGuideNavHrefs(navLinks) {
  navLinks.forEach((link) => {
    const hash = String(link.dataset.guideHash || link.getAttribute("href") || "").trim();
    if (!/^#guide-[a-z0-9-]+$/i.test(hash)) return;
    link.dataset.guideHash = hash;
    link.setAttribute("href", `${window.location.pathname}${window.location.search}${hash}`);
  });
}

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

function setupGuideSectionNavigation({
  page,
  navLinks,
  sections,
  mobileNavToggle,
  guideNav,
}) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const guideLayout = page.querySelector(".guide-layout");
  const guideContent = page.querySelector(".guide-content");

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

  const activateSection = (id, { historyMode = null, scroll = false, scrollBehavior = null } = {}) => {
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
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (historyMode && sectionChanged) {
      const url = `${window.location.pathname}${window.location.search}#${nextId}`;
      if (historyMode === "push") {
        history.pushState(history.state, "", url);
      } else {
        history.replaceState(history.state, "", url);
      }
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
      } else if (historyMode === "push") {
        window.scrollTo({ top: 0, left: 0, behavior });
      }
    }
  };

  const moveToSection = (id, historyMode = "replace") => {
    const targetId = String(id || "").trim();
    if (!sectionById.has(targetId)) return;
    activateSection(targetId, { historyMode, scroll: true });
    window.requestAnimationFrame(() => {
      const heading = sectionById.get(targetId)?.querySelector("h2");
      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  };

  const isGuideSectionHash = (hash) => sectionById.has(String(hash || "").replace("#", ""));

  // Event Listeners
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = String(link.dataset.guideHash || link.getAttribute("href") || "").replace("#", "");
      closeMobileNavigation();
      activateSection(targetId, {
        historyMode: "replace",
        scroll: true,
      });
    });
  });

  guideContent?.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('.guide-doc a[href^="guide.html#guide-"]');
    if (!link || !isGuideSectionHash(link.hash)) return;
    event.preventDefault();
    closeMobileNavigation();
    moveToSection(link.hash.slice(1), "push");
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
    if (hash && !isGuideSectionHash(hash)) return;
    activateSection(hash.replace("#", ""), {
      scroll: true,
    });
  });

  return {
    activateSection,
    getActiveGuideId: () => activeGuideId,
    updateSectionNavigation,
    sectionById,
  };
}

export function initGuidePage() {
  const page = document.getElementById("guidePage");
  if (!page) return;

  const navLinks = Array.from(page.querySelectorAll(".guide-nav a[href^='#guide-']"));
  const sections = Array.from(page.querySelectorAll(".guide-section[id]"));
  const mobileNavToggle = document.getElementById("guideMobileNavToggle");
  const guideNav = document.getElementById("guideNav");
  const backLink = page.querySelector(".guide-back");

  backLink?.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const historyIndex = window.history.state?.appRouteHistoryIndex;
    const hasAppRouteHistory = Number.isInteger(historyIndex) && historyIndex > 0;
    const hasSameOriginHistory = window.history.length > 1
      && document.referrer
      && new URL(document.referrer).origin === window.location.origin;
    if (!hasAppRouteHistory && !hasSameOriginHistory) return;

    event.preventDefault();
    window.history.back();
  });

  const academicWrap = document.getElementById("guideAcademicExams");
  const languageWrap = document.getElementById("guideLanguageExams");
  const glossaryWrap = document.getElementById("guideGlossary");

  const renderAll = () => {
    renderGlossary(glossaryWrap);
    renderAcademicExams(academicWrap);
    renderLanguageExams(languageWrap);
  };

  const navControl = setupGuideSectionNavigation({
    page,
    navLinks,
    sections,
    mobileNavToggle,
    guideNav,
  });

  syncGuideSidebarOffset(page);
  updateGuideNavHrefs(navLinks);
  renderAll();

  const initialHash = String(window.location.hash || "").replace("#", "");
  navControl.activateSection(
    navControl.sectionById.has(initialHash) ? initialHash : (sections[0]?.id || "guide-unifit"),
    { scroll: false }
  );

  setManualScrollRestoration();
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });

  window.addEventListener("resize", () => {
    syncGuideSidebarOffset(page);
  });

  bindGuideExternalUpdates(() => {
    syncGuideSidebarOffset(page);
    updateGuideNavHrefs(navLinks);
    renderAll();
    navControl.updateSectionNavigation(navControl.getActiveGuideId());
  });
}
