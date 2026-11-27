import {
  EXAM_CONFIG,
  LANG_CONFIG,
  aiName,
  canonicalizeExamId,
  escapeHtml,
  getExamDisplayName,
  setManualScrollRestoration,
} from "../utils.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { navigateToAppRoute, routeUniversities } from "../routes.js";
import { bindGuideExternalUpdates, requestUniversitiesTourOpen } from "./shared/cache.js";
import { sectionsInNavOrder, setupGuideSectionNavigation } from "./guide-navigation.js";

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
  page.style.setProperty("--guide-navbar-height", `${navbarHeight}px`);
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

export function initGuidePage() {
  const page = document.getElementById("guidePage");
  if (!page) return;

  const navLinks = Array.from(page.querySelectorAll(".guide-nav a[href^='#guide-']"));
  const sections = sectionsInNavOrder(Array.from(page.querySelectorAll(".guide-section[id]")), navLinks);
  const guideNav = document.getElementById("guideNav");
  const backLink = page.querySelector(".guide-back");
  const launchTourBtn = document.getElementById("guideLaunchTourBtn");

  launchTourBtn?.addEventListener("click", () => {
    requestUniversitiesTourOpen();
    navigateToAppRoute(routeUniversities());
  });

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
    guideNav,
  });

  syncGuideSidebarOffset(page);
  updateGuideNavHrefs(navLinks);
  renderAll();

  const initialHash = String(window.location.hash || "").replace("#", "");
  const hasInitialSection = navControl.sectionById.has(initialHash);
  navControl.activateSection(
    hasInitialSection ? initialHash : (sections[0]?.id || "guide-unifit"),
    { scroll: false, view: hasInitialSection ? "section" : "hub" }
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
    navControl.refreshLabels();
  });
}
