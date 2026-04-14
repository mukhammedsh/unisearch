import {
  EXAM_CONFIG,
  LANG_CONFIG,
  aiName,
  canonicalizeExamId,
  escapeHtml,
  getExamDisplayName,
} from "../utils.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";

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
  const layout = page.querySelector(".guide-layout");
  const sidebar = page.querySelector(".guide-sidebar");
  const stickyNav = page.querySelector(".guide-nav");
  const desktopGuideMedia = window.matchMedia("(min-width: 981px)");
  const navLinks = Array.from(page.querySelectorAll(".guide-nav a[href^='#guide-']"));
  const sections = Array.from(page.querySelectorAll(".guide-section[id]"));

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
      SAT: t("guide.academic.sat", "SAT is a standardized college admissions exam widely used for undergraduate applications, focused on evidence-based reading, writing, and mathematics."),
      ACT: t("guide.academic.act", "ACT is a standardized admissions exam used by many universities, covering English, mathematics, reading, and science reasoning."),
      GPA: t("guide.academic.gpa", "GPA represents cumulative school academic performance across courses and is often used as a baseline indicator of consistency."),
      UNT: t("guide.academic.unt", "UNT (Unified National Testing) is the national exam used in Kazakhstan for many undergraduate admission pathways."),
      NUETTOTAL: t("guide.academic.nuettotal", "This is a combined entrance test score used in specific institutional admission routes."),
      APTOTAL: t("guide.academic.aptotal", "AP Total reflects combined performance across multiple Advanced Placement subjects."),
      IBDIPLOMA: t("guide.academic.ibdiploma", "IB Diploma score is the overall International Baccalaureate Diploma result used in many global admissions systems."),
      ALEVELCERT: t("guide.academic.alevelcert", "A-Level results are entered as subject grades such as A*AA or ABB. UniSearch converts your best 3 grades into an internal comparable score."),
      HKDSELEVEL: t("guide.academic.hkdselevel", "HKDSE level uses the Hong Kong secondary-school scale where 5*=6 and 5**=7 for UniSearch matching."),
      SWISSMATURITYCERT: t("guide.academic.swissmaturitycert", "Swiss Maturity Certificate (Matura/Maturite) is the standard Swiss university-entrance qualification."),
      GERMANABITURCERT: t("guide.academic.germanabiturcert", "German Abitur certificate is the standard qualification granting access to German universities."),
      OSSDCERT: t("guide.academic.ossdcert", "OSSD confirms completion of the Ontario Secondary School Diploma used for Canadian (Ontario) admissions."),
    };
    const base = descriptions[normalized]
      || t("guide.academic.default", "This is an academic metric used by one or more admission tracks in the UniSearch dataset.");
    const scale = scoreScaleText(cfg);
    return withExamLabel(`${base}${scale ? ` ${scale}` : ""}`.trim(), labelText);
  }

  function describeLanguageExam(examId, langCode, cfg, labelText = "") {
    const exam = String(examId || "").toUpperCase();
    const label = String(labelText || "").toUpperCase();
    const key = `${exam} ${label}`;

    let base = t("guide.language.default", "This language proficiency exam is used to verify readiness for study in the program language.");
    if (key.includes("IELTS")) base = t("guide.language.ielts", "IELTS evaluates English proficiency across listening, reading, writing, and speaking for academic contexts.");
    else if (key.includes("TOEFL")) base = t("guide.language.toefl", "TOEFL measures academic English proficiency and is commonly accepted for university admissions.");
    else if (key.includes("DUOLINGO") || key.includes("DET")) base = t("guide.language.det", "Duolingo English Test is an online adaptive English proficiency exam accepted by many institutions.");
    else if (key.includes("PTE")) base = t("guide.language.pte", "PTE Academic is a computer-based English proficiency test used in international admissions.");
    else if (key.includes("CAMBRIDGE")) base = t("guide.language.cambridge", "Cambridge English qualifications assess practical English proficiency at standardized CEFR-aligned levels.");
    else if (key.includes("TESTDAF") || key.includes("DSH")) base = t("guide.language.german", "TestDaF and DSH are German-language proficiency exams commonly required for German-taught study tracks.");
    else if (key.includes("DELF") || key.includes("DALF") || key.includes("TCF") || key.includes("TEF")) base = t("guide.language.french", "These exams assess French proficiency and are used for French-language academic eligibility.");
    else if (key.includes("NT2")) base = t("guide.language.dutch", "NT2 is a Dutch-as-a-second-language exam used to confirm readiness for Dutch-language study.");
    else if (key.includes("HSK")) base = t("guide.language.hsk", "HSK measures Chinese language proficiency for academic and formal language use.");
    else if (key.includes("JLPT")) base = t("guide.language.jlpt", "JLPT measures Japanese language proficiency across standard difficulty levels.");
    else if (key.includes("TOPIK")) base = t("guide.language.topik", "TOPIK measures Korean language proficiency and is used for Korean-language academic readiness.");
    else if (langCode) base = tFormat("guide.language.by_code", { code: String(langCode).toUpperCase() }, `This exam is used as language proof for ${String(langCode).toUpperCase()}-language admission tracks.`);

    const scale = scoreScaleText(cfg);
    return withExamLabel(`${base}${scale ? ` ${scale}` : ""}`.trim(), labelText);
  }

  function glossaryEntries() {
    const fitName = aiName("fit");
    const chanceName = aiName("chance");
    return [
      { term: fitName, desc: tFormat("guide.glossary.fit", { fit: fitName }, `${fitName} is the smart sorting mode based on your profile.`) },
      { term: chanceName, desc: tFormat("guide.glossary.chance", { chance: chanceName }, `${chanceName} is an estimated admission chance based on your data.`) },
      { term: t("guide.glossary.term.swr", "Data Cache"), desc: t("guide.glossary.swr", "Cache behavior: we first show saved data, then refresh it in the background.") },
      { term: t("guide.glossary.term.admission_track", "Admission Track"), desc: t("guide.glossary.admission_track", "A specific way to apply to a university (e.g., direct, exam-based, scholarship path).") },
      { term: t("guide.glossary.term.requirements", "Requirements"), desc: t("guide.glossary.requirements", "Minimum scores to be considered for a track.") },
      { term: t("guide.glossary.term.stats_avg", "Average (Admitted)"), desc: t("guide.glossary.stats_avg", "Average scores of admitted students on that track.") },
      { term: t("guide.glossary.term.language_requirements", "Language Requirements"), desc: t("guide.glossary.language_requirements", "Accepted proof of language ability: native, CEFR, or language exam.") },
      { term: t("guide.glossary.term.mode_any", "Mode = any"), desc: t("guide.glossary.mode_any", "You need to satisfy at least one listed language option.") },
      { term: t("guide.glossary.term.mode_all", "Mode = all"), desc: t("guide.glossary.mode_all", "You must satisfy every listed language requirement.") },
      { term: t("guide.glossary.term.match_score", "Match Score"), desc: tFormat("guide.glossary.match_score", { fit: fitName }, `Internal ${fitName} ranking score; higher means a better fit for your profile.`) },
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
    glossaryWrap.innerHTML = `<p>${escapeHtml(t("guide.glossary.intro", "Short definitions of the terms you see on the site."))}</p><ul class="guide-list">${items}</ul>`;
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
    academicWrap.innerHTML = `<p>${escapeHtml(t("guide.academic.intro", "The following academic exams are currently used by UniSearch for admission track matching and recommendation quality."))}</p><ul class="guide-list">${items}</ul>`;
  }

  function renderLanguageExams() {
    if (!languageWrap) return;
    const groups = LANG_CONFIG?.language_exams || {};
    const languages = LANG_CONFIG?.languages || [];
    const nameByCode = Object.fromEntries(languages.map((item) => [item.code, item.name || item.label || item.code]));
    const codes = Object.keys(groups).sort();
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
        <section class="guide-subsection">
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

  function resetGuideFloatingNav() {
    if (!(sidebar instanceof HTMLElement) || !(stickyNav instanceof HTMLElement)) return;
    stickyNav.classList.remove("is-floating", "is-stuck-bottom");
    stickyNav.style.removeProperty("--guide-sidebar-left");
    stickyNav.style.removeProperty("--guide-sidebar-width");
    sidebar.style.removeProperty("min-height");
  }

  function syncGuideFloatingNav() {
    if (!(layout instanceof HTMLElement) || !(sidebar instanceof HTMLElement) || !(stickyNav instanceof HTMLElement)) return;
    if (!desktopGuideMedia.matches) {
      resetGuideFloatingNav();
      return;
    }

    const offset = parseFloat(getComputedStyle(page).getPropertyValue("--guide-sidebar-offset")) || 82;
    const sidebarRect = sidebar.getBoundingClientRect();
    const layoutRect = layout.getBoundingClientRect();
    const navHeight = stickyNav.offsetHeight;
    const sidebarTop = window.scrollY + sidebarRect.top;
    const layoutBottom = window.scrollY + layoutRect.bottom;
    const stickStart = sidebarTop - offset;
    const stickEnd = layoutBottom - navHeight - offset;

    sidebar.style.minHeight = `${navHeight}px`;
    stickyNav.style.setProperty("--guide-sidebar-left", `${Math.round(sidebarRect.left)}px`);
    stickyNav.style.setProperty("--guide-sidebar-width", `${Math.round(sidebarRect.width)}px`);

    if (window.scrollY <= stickStart) {
      stickyNav.classList.remove("is-floating", "is-stuck-bottom");
      return;
    }
    if (window.scrollY >= stickEnd) {
      stickyNav.classList.remove("is-floating");
      stickyNav.classList.add("is-stuck-bottom");
      return;
    }

    stickyNav.classList.remove("is-stuck-bottom");
    stickyNav.classList.add("is-floating");
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const activateSection = (id, { updateHash = false, scroll = false } = {}) => {
    const nextId = sectionById.has(id) ? id : (sections[0]?.id || "");
    if (!nextId) return;
    const targetSection = sectionById.get(nextId);

    sections.forEach((section) => {
      const active = section.id === nextId;
      section.classList.toggle("is-active", active);
      section.setAttribute("aria-hidden", "false");
    });
    navLinks.forEach((link) => {
      const active = String(link.dataset.guideHash || link.getAttribute("href") || "").trim() === `#${nextId}`;
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    });

    if (updateHash) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${nextId}`);
    }
    if (scroll && targetSection) {
      targetSection.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activateSection(String(link.dataset.guideHash || link.getAttribute("href") || "").replace("#", ""), {
        updateHash: true,
        scroll: true,
      });
    });
  });

  bindGuideHashChange(() => {
    activateSection(String(window.location.hash || "").replace("#", ""), {
      updateHash: false,
      scroll: false,
    });
  });

  let scrollTicking = false;
  const syncActiveSectionFromScroll = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      const viewportTop = 110;
      const viewportBottom = window.innerHeight - 120;
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

      if (currentId) activateSection(currentId, { updateHash: false, scroll: false });
      syncGuideFloatingNav();
      scrollTicking = false;
    });
  };

  syncGuideSidebarOffset();
  updateGuideNavHrefs();
  renderAll();
  activateSection(String(window.location.hash || "").replace("#", ""), { updateHash: false, scroll: false });
  window.addEventListener("scroll", syncActiveSectionFromScroll, { passive: true });
  window.addEventListener("resize", () => {
    syncGuideSidebarOffset();
    syncGuideFloatingNav();
    syncActiveSectionFromScroll();
  });
  bindGuideExternalUpdates(() => {
    syncGuideSidebarOffset();
    updateGuideNavHrefs();
    renderAll();
    syncGuideFloatingNav();
    syncActiveSectionFromScroll();
  });
  syncGuideFloatingNav();
  syncActiveSectionFromScroll();
}
