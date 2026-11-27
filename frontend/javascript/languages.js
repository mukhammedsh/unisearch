import {
  API_BASE,
  escapeHtml,
  escapeHtmlAttr,
  getExamDisplayName,
  initCustomSelect,
  motionPress,
  showToast,
} from "./utils.js";
import { enterNewRows, readRowKeys, setRevealed } from "./utils/motion-reveal.js";
import { SHOW_PROFILE_SECTION_EVENT } from "./components/profile/profile-sections.js";
import { getCurrentLanguage, t, tFormat } from "./i18n.js";
import {
  CEFR_LABEL,
  KIND_CEFR,
  KIND_EXAM,
  KIND_NATIVE,
  clearNumericInputLimits,
  findEditedLanguageIndex,
  findExistingExamEntry,
  formatLanguageExamValue,
  formatLanguageValidationToast,
  formatValuePart,
  getBreakdownScheme,
  getConfigOrNull,
  getExam,
  getExamInputMode,
  getKindLabel,
  getLangLabel,
  getLocalizedKindLabel,
  getProfileDraftBridge,
  getVisibleExamList,
  loadEditableProfile,
  normalizeBreakdownDefs,
  normalizeKind,
  normalizeLangEntry,
  saveEditableProfile,
  setNumericInputLimits,
  usesOverallScoreInput,
  validateExamScore,
} from "./components/profile/language-helpers.js";

export { findEditedLanguageIndex };

export function initLanguagesPanel() {
  let disposed = false;
  let booted = false;
  let languageConfigLoadedHandler = null;
  let disposeWindowHandlers = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (languageConfigLoadedHandler) {
      window.removeEventListener("languageConfigLoaded", languageConfigLoadedHandler);
      languageConfigLoadedHandler = null;
    }
    disposeWindowHandlers();
  };

  const boot = () => {
    if (disposed || booted) return;
    const cfg = getConfigOrNull();
    if (!cfg) return;

    const langCode = document.getElementById("langCode");
    const langKind = document.getElementById("langKind");
    const langCefr = document.getElementById("langCefr");
    const langExam = document.getElementById("langExam");
    const langExamScore = document.getElementById("langExamScore");
    const langExamScoreLabel = document.getElementById("langExamScoreLabel");
    const langExamScoreHint = document.getElementById("langExamScoreHint");
    const langExamTakenOn = document.getElementById("langExamTakenOn");
    const langExamTakenOnContainer = document.getElementById("langExamTakenOnContainer");
    if (langExamTakenOn) langExamTakenOn.max = new Date().toISOString().slice(0, 10);
    const cefrContainer = document.getElementById("cefrContainer");
    const examContainer = document.getElementById("examContainer");
    const scoreContainer = document.getElementById("scoreContainer");
    const langExamSpecialContainer = document.getElementById("langExamSpecialContainer");
    const langAddBtn = document.getElementById("langAddBtn");
    const clearLanguageDraftBtn = document.getElementById("clearLanguageDraftBtn");
    const langList = document.getElementById("langList");
    const languagesBlock = document.getElementById("languagesBlock");

    if (
      !langCode || !langKind || !langCefr || !langExam || !langExamScore
      || !langAddBtn || !langList || !languagesBlock
    ) {
      return;
    }
    booted = true;
    let isSubmitting = false;
    let draftRevision = 0;
    let editorResetRevision = 0;
    // The saved entry opened with "Edit": submitting replaces it even when its date changed, instead of adding a second row.
    let editingEntry = null;

    function setEditorDirty(dirty) {
      getProfileDraftBridge()?.setLanguageEditorDirty?.(dirty);
      if (clearLanguageDraftBtn) clearLanguageDraftBtn.hidden = !langKind.value;
    }

    function markEditorChanged() {
      draftRevision += 1;
      const kind = normalizeKind(langKind.value);
      const hasExamValue = [langExamScore, langExamTakenOn, ...langExamSpecialContainer.querySelectorAll("input")]
        .some(control => String(control?.value || "").trim());
      setEditorDirty(kind === KIND_NATIVE || kind === KIND_CEFR || (kind === KIND_EXAM && hasExamValue));
    }

    function findExistingEntryIndex(entries, draft) {
      const list = Array.isArray(entries) ? entries : [];
      const item = draft && typeof draft === "object" ? draft : null;
      if (!item?.code || !item?.kind) return -1;
      if (item.kind === KIND_EXAM) {
        if (!item.exam) return -1;
        return list.findIndex((x) =>
          x.code === item.code && x.kind === item.kind && x.exam === item.exam && String(x.taken_on || "") === String(item.taken_on || "")
        );
      }
      return list.findIndex((x) => x.code === item.code && x.kind === item.kind);
    }

    function getDraftEntryFromUI() {
      const code = String(langCode.value || "").trim().toLowerCase();
      const kind = normalizeKind(langKind.value);
      const takenOn = kind === KIND_EXAM ? String(langExamTakenOn?.value || "").trim() : "";
      if (!code || !kind) return null;
      if (kind === KIND_EXAM) {
        const exam = String(langExam.value || "").trim();
        if (!exam) return null;
        return { code, kind, exam, ...(takenOn ? { taken_on: takenOn } : {}) };
      }
      return { code, kind };
    }

    function refreshLangActionButton() {
      const prof = loadEditableProfile();
      const entries = (Array.isArray(prof.languages) ? prof.languages : [])
        .map(normalizeLangEntry)
        .filter(Boolean);
      const draft = getDraftEntryFromUI();
      const isUpdate = findExistingEntryIndex(entries, draft) >= 0;
      const key = isUpdate ? "profile.edit" : "profile.add";
      const fallback = isUpdate ? "Edit" : "Add";
      langAddBtn.setAttribute("data-i18n", key);
      langAddBtn.textContent = t(key, fallback);
      if (clearLanguageDraftBtn) clearLanguageDraftBtn.hidden = !langKind.value;
    }

    function populateLangCode() {
      const current = String(langCode.value || "").trim().toLowerCase();
      langCode.replaceChildren();
      (cfg.languages || []).forEach((row) => {
        const opt = document.createElement("option");
        opt.value = row.code;
        opt.textContent = getLangLabel(cfg, row.code);
        if (opt.value === current) opt.selected = true;
        langCode.appendChild(opt);
      });
    }

    function populateLangKind() {
      const current = normalizeKind(langKind.value);
      langKind.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("languages.select_type", "Select type");
      placeholder.disabled = true;
      placeholder.selected = !current;
      langKind.appendChild(placeholder);

      (cfg.proof_kinds || []).forEach((row) => {
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = getLocalizedKindLabel(row.id, row.label);
        if (opt.value === current) opt.selected = true;
        langKind.appendChild(opt);
      });
    }

    function populateLangExam() {
      const code = String(langCode.value || "").trim().toLowerCase();
      const list = getVisibleExamList(cfg, code);
      const current = String(langExam.value || "").trim();
      langExam.replaceChildren();

      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = t("languages.no_exams", "No exams");
        langExam.appendChild(opt);
        langExam.disabled = true;
        return;
      }

      langExam.disabled = false;
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("languages.select_exam", "Select exam");
      placeholder.disabled = true;
      placeholder.selected = true;
      langExam.appendChild(placeholder);

      list.forEach((examObj) => {
        const opt = document.createElement("option");
        opt.value = examObj.id;
        opt.textContent = getExamDisplayName(examObj.id, { langCode: code, locale: getCurrentLanguage() });
        if (opt.value === current) {
          placeholder.selected = false;
          opt.selected = true;
        }
        langExam.appendChild(opt);
      });
    }

    function renderList() {
      const prof = loadEditableProfile();
      const arr = (Array.isArray(prof.languages) ? prof.languages : [])
        .map(normalizeLangEntry)
        .filter(Boolean);

      if (JSON.stringify(prof.languages) !== JSON.stringify(arr)) {
        prof.languages = arr;
        saveEditableProfile(prof);
      }

      const previousKeys = readRowKeys(langList);
      langList.innerHTML = arr.map((entry, idx) => {
        const langName = escapeHtml(getLangLabel(cfg, entry.code));
        const kindName = escapeHtml(getKindLabel(cfg, entry.kind));

        let meta = "";
        if (entry.kind === KIND_CEFR) {
          meta = ` — ${escapeHtml(CEFR_LABEL[entry.level] || String(entry.level))}`;
        }
        if (entry.kind === KIND_EXAM) {
          const exLabel = escapeHtml(getExamDisplayName(entry.exam, { langCode: entry.code, locale: getCurrentLanguage() }));
          const valueLabel = escapeHtml(formatLanguageExamValue(cfg, entry));
          const dateLabel = entry.taken_on ? ` · ${escapeHtml(entry.taken_on)}` : "";
          meta = `${valueLabel ? ` — ${exLabel}: ${valueLabel}` : ` — ${exLabel}`}${dateLabel}`;
        }

        return `
          <div class="lang-item" data-row-key="${escapeHtmlAttr(JSON.stringify(entry))}">
            <div class="lang-item__main">
              <strong>${langName}</strong>
              <small>${kindName}${meta}</small>
            </div>
            <div class="profile-list-actions">
              <button class="ui-btn ui-btn--sm ui-btn--subtle profile-button-subtle" data-edit-idx="${idx}" type="button">${escapeHtml(t("profile.edit", "Edit"))}</button>
              <button class="ui-btn ui-btn--sm ui-btn--danger-soft profile-delete" data-idx="${idx}" type="button">${escapeHtml(t("profile.delete", "Delete"))}</button>
            </div>
          </div>
        `;
      }).join("");
      enterNewRows(langList, ".lang-item", previousKeys);

      refreshLangActionButton();
    }

    function selectedExamObject() {
      if (normalizeKind(langKind.value) !== KIND_EXAM) return null;
      return getExam(cfg, String(langCode.value || "").trim().toLowerCase(), String(langExam.value || "").trim());
    }

    function renderSpecialExamInput() {
      if (!langExamSpecialContainer) return;
      const examObj = selectedExamObject();
      if (!examObj || getExamInputMode(examObj) !== "subject_breakdown") {
        langExamSpecialContainer.hidden = true;
        langExamSpecialContainer.replaceChildren();
        return;
      }

      const defs = normalizeBreakdownDefs(getBreakdownScheme(examObj).fixed_components);
      if (!defs.length) {
        langExamSpecialContainer.hidden = true;
        langExamSpecialContainer.replaceChildren();
        return;
      }

      const profile = loadEditableProfile();
      const existing = findExistingExamEntry(
        profile,
        String(langCode.value || "").trim().toLowerCase(),
        String(examObj.id || "").trim(),
        String(langExamTakenOn?.value || "").trim()
      );
      const existingComponents = new Map(
        (Array.isArray(existing?.details?.components) ? existing.details.components : [])
          .filter((row) => row && typeof row === "object")
          .map((row) => [String(row.exam || row.id || row.exam_id || "").trim(), row])
      );

      langExamSpecialContainer.hidden = false;
      langExamSpecialContainer.dataset.examId = String(examObj.id || "");
      const lang = String(langCode.value || "").trim().toLowerCase();
      // One labelled group of short section fields under the overall score, as on a score report.
      langExamSpecialContainer.innerHTML = `
        <fieldset class="profile-lang-sections">
          <legend class="profile-form-label">${escapeHtml(t("languages.exam_sections_label", "Section scores (if your report shows them)"))}</legend>
          <div class="profile-exam-special-grid profile-exam-special-grid--grades">
          ${defs.map((def) => {
            const childExam = getExam(cfg, lang, def.exam);
            const name = getExamDisplayName(def.exam, { langCode: lang, locale: getCurrentLanguage() });
            const valueText = escapeHtml(formatValuePart(existingComponents.get(def.exam)));
            return `
              <label class="profile-exam-special-field" data-lang-breakdown-row="${escapeHtml(def.exam)}">
                <span class="mini-label">${escapeHtml(name)}</span>
                <input
                  type="text"
                  inputmode="decimal"
                  class="ui-input ui-input--lg profile-input"
                  value="${valueText}"
                  placeholder="${escapeHtml(t("profile.placeholder.score", "Score"))}"
                  data-lang-breakdown-input="${escapeHtml(def.exam)}"
                  ${childExam?.min !== undefined ? `min="${escapeHtml(String(childExam.min))}"` : ""}
                  ${childExam?.max !== undefined ? `max="${escapeHtml(String(childExam.max))}"` : ""}
                  ${childExam?.step !== undefined ? `step="${escapeHtml(String(childExam.step))}"` : ""}
                />
              </label>
            `;
          }).join("")}
          <div class="profile-exam-special-hint">${escapeHtml(
            t(
              "languages.exam_breakdown_optional_hint",
              "Section scores are optional: enter the overall score, or fill every section and it is calculated automatically. Sections allow a more precise check."
            )
          )}</div>
          </div>
        </fieldset>
      `;
    }

    function syncExamUi() {
      const kind = normalizeKind(langKind.value);
      const examObj = selectedExamObject();
      const examMode = getExamInputMode(examObj);
      const usesParentScore = examMode === "number" || usesOverallScoreInput(examObj);
      const showScoreField = kind === KIND_EXAM && !!examObj && usesParentScore;
      const hasSectionBreakdown = showScoreField && examMode === "subject_breakdown";

      if (cefrContainer) cefrContainer.hidden = kind !== KIND_CEFR;
      if (examContainer) examContainer.hidden = kind !== KIND_EXAM;
      if (scoreContainer) scoreContainer.hidden = !showScoreField;
      if (langExamTakenOnContainer) {
        langExamTakenOnContainer.hidden = kind !== KIND_EXAM;
        if (kind !== KIND_EXAM && langExamTakenOn) langExamTakenOn.value = "";
      }

      if (langExamScoreLabel) {
        const labelKey = hasSectionBreakdown ? "languages.exam_overall_score_label" : "profile.score";
        const labelFallback = hasSectionBreakdown ? "Overall score" : "Score";
        langExamScoreLabel.setAttribute("data-i18n", labelKey);
        langExamScoreLabel.textContent = t(labelKey, labelFallback);
      }

      if (langExamScoreHint) {
        langExamScoreHint.hidden = !hasSectionBreakdown;
      }

      if (hasSectionBreakdown && langExamScoreHint) {
        langExamScore.setAttribute("aria-describedby", "langExamScoreHint");
      } else {
        langExamScore.removeAttribute("aria-describedby");
      }

      if (showScoreField) {
        setNumericInputLimits(langExamScore, examObj);
        langExamScore.placeholder = hasSectionBreakdown
          ? t("profile.exam_total_placeholder", "Overall total")
          : t("profile.placeholder.lang_score", "Score (e.g. 7.5)");
      } else {
        clearNumericInputLimits(langExamScore);
        langExamScore.placeholder = t("profile.placeholder.lang_score", "Score (e.g. 7.5)");
      }

      renderSpecialExamInput();
    }

    function readCompositeDetails(examObj) {
      if (!langExamSpecialContainer || getExamInputMode(examObj) !== "subject_breakdown") return null;
      const defs = normalizeBreakdownDefs(getBreakdownScheme(examObj).fixed_components);
      const components = [];
      for (const def of defs) {
        const input = langExamSpecialContainer.querySelector(`[data-lang-breakdown-input="${def.exam}"]`);
        const raw = String(input?.value || "").trim();
        if (!raw) continue;
        const childExam = getExam(cfg, String(langCode.value || "").trim().toLowerCase(), def.exam);
        const parsed = validateExamScore(childExam || { id: def.exam }, String(langCode.value || "").trim().toLowerCase(), raw, { required: false });
        if (parsed.error) {
          input?.focus();
          showToast(parsed.error, "error");
          return null;
        }
        if (parsed.empty) continue;
        components.push({ exam: def.exam, score: parsed.score });
      }
      return components.length ? { components } : undefined;
    }

    function resetExamInputs() {
      editingEntry = null;
      langExam.value = "";
      langExamScore.value = "";
      if (langExamTakenOn) langExamTakenOn.value = "";
      if (langExamSpecialContainer) {
        langExamSpecialContainer.replaceChildren();
        langExamSpecialContainer.hidden = true;
      }
      initCustomSelect("langExam");
      syncExamUi();
      refreshLangActionButton();
    }

    function renderForm({ preserveDraft = false } = {}) {
      const score = langExamScore.value;
      const takenOn = langExamTakenOn?.value;
      const components = new Map(Array.from(langExamSpecialContainer.querySelectorAll("[data-lang-breakdown-input]"),
        input => [input.dataset.langBreakdownInput, input.value]));
      populateLangCode();
      populateLangKind();
      populateLangExam();
      renderList();
      initCustomSelect("langCode");
      initCustomSelect("langKind");
      initCustomSelect("langCefr");
      initCustomSelect("langExam");
      syncExamUi();
      if (preserveDraft) {
        langExamScore.value = score;
        if (langExamTakenOn) langExamTakenOn.value = takenOn;
        langExamSpecialContainer.querySelectorAll("[data-lang-breakdown-input]").forEach(input => {
          if (components.has(input.dataset.langBreakdownInput)) input.value = components.get(input.dataset.langBreakdownInput);
        });
      }
      refreshLangActionButton();
    }

    // Fills the editor with a saved entry, or with a new one for the given language, kind and test.
    function loadIntoEditor(entry) {
      langCode.value = entry.code;
      langKind.value = entry.kind || "";
      populateLangExam();
      if (entry.kind === KIND_CEFR) langCefr.value = String(entry.level);
      if (entry.kind === KIND_EXAM) {
        langExam.value = entry.exam;
        if (langExamTakenOn) langExamTakenOn.value = entry.taken_on || "";
        langExamScore.value = entry.score != null && Number.isFinite(Number(entry.score)) ? String(entry.score) : "";
      }
      initCustomSelect("langCode");
      initCustomSelect("langKind");
      initCustomSelect("langCefr");
      initCustomSelect("langExam");
      syncExamUi();
      setEditorDirty(false);
      refreshLangActionButton();
    }

    // A university page links here to add a missing English result (?language_exam=IELTS), opening the editor at that test on
    // its first empty section score or the overall score, or to state a native language (?language=en), opening a new
    // "native" entry on the language list without choosing the language for the applicant.
    function openFromLink() {
      const params = new URLSearchParams(window.location.search);
      void openExamEditor(String(params.get("language_exam") || "").trim(), String(params.get("language") || "").trim().toLowerCase(), { fromLink: true });
    }

    // The editor lives in the profile's Languages section, which must be shown before the field can take focus.
    async function showLanguagesSection(replaceHistory) {
      const detail = { section: "languages", replaceHistory };
      window.dispatchEvent(new CustomEvent(SHOW_PROFILE_SECTION_EVENT, { detail }));
      return detail.result ? detail.result : true;
    }

    // Also opened from the exam list's English-test shortcuts, which name the test only.
    async function openExamEditor(exam, code = "", { fromLink = false } = {}) {
      if (!exam && !code) return;
      const lang = code || "en";
      if (!(cfg.languages || []).some(row => row.code === lang)) return;
      if (exam && !getExam(cfg, lang, exam)) return;
      if (!(await showLanguagesSection(fromLink))) return;
      const languages = loadEditableProfile().languages;
      const entries = (Array.isArray(languages) ? languages : []).map(normalizeLangEntry).filter(Boolean);
      const saved = exam ? entries.findLast(entry => entry.code === lang && entry.kind === KIND_EXAM && entry.exam === exam) || null : null;
      loadIntoEditor(saved || (exam ? { code: lang, kind: KIND_EXAM, exam } : { code: langCode.value, kind: KIND_NATIVE }));
      const target = !exam ? langCode
        : [...langExamSpecialContainer.querySelectorAll("[data-lang-breakdown-input]")].find(input => saved && !input.value) || langExamScore;
      // A custom select hides its native control, so the visible trigger takes focus. The route moves focus to the page
      // heading in the next frame, so the field is focused one frame later.
      const field = () => target === langCode ? langCode.parentElement?.querySelector(".custom-select-trigger") || langCode : target;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        languagesBlock.scrollIntoView({ block: "center" });
        field().focus({ preventScroll: true });
      }));
    }

    renderForm();
    if (languagesBlock.dataset.bound === "1") {
      return;
    }
    languagesBlock.dataset.bound = "1";

    langCode.addEventListener("change", () => {
      populateLangExam();
      initCustomSelect("langExam");
      syncExamUi();
      refreshLangActionButton();
    });

    langKind.addEventListener("change", () => {
      syncExamUi();
      refreshLangActionButton();
    });

    langExam.addEventListener("change", () => {
      syncExamUi();
      refreshLangActionButton();
    });

    langCefr.addEventListener("change", refreshLangActionButton);

    langExamScore.addEventListener("input", () => {
      if (langExamScore.value.includes(",")) {
        langExamScore.value = langExamScore.value.replaceAll(",", ".");
      }
    });
    langExamTakenOn?.addEventListener("change", () => {
      refreshLangActionButton();
    });

    langExamSpecialContainer?.addEventListener("input", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.value.includes(",")) {
        target.value = target.value.replaceAll(",", ".");
      }
    });

    languagesBlock.addEventListener("input", markEditorChanged);
    languagesBlock.addEventListener("change", markEditorChanged);

    function clearEditor() {
      editorResetRevision += 1;
      draftRevision += 1;
      langKind.value = "";
      resetExamInputs();
      initCustomSelect("langKind");
      setEditorDirty(false);
    }
    clearLanguageDraftBtn?.addEventListener("click", () => {
      if (!isSubmitting) clearEditor();
    });

    langAddBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (isSubmitting) return;
      motionPress(langAddBtn);
      addLanguage();
    });

    const submitLanguageOnEnter = (ev) => {
      if (ev.key !== "Enter" || ev.isComposing || ev.keyCode === 229) return;
      if (ev.defaultPrevented || ev.repeat) return;
      if (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) return;
      if (ev.target instanceof Element && ev.target.closest(".custom-select-wrapper.open, button")) return;
      ev.preventDefault();
      if (isSubmitting) return;
      addLanguage();
    };

    [langCode, langKind, langCefr, langExam, langExamScore, langExamTakenOn].filter(Boolean).forEach((control) => {
      control.addEventListener("keydown", submitLanguageOnEnter);
    });
    languagesBlock.addEventListener("keydown", submitLanguageOnEnter);

    async function addLanguage() {
      if (isSubmitting) return;
      const submittedDraftRevision = draftRevision;
      const submittedResetRevision = editorResetRevision;
      const submittedEditingEntry = editingEntry;
      isSubmitting = true;
      if (langAddBtn) langAddBtn.disabled = true;
      if (clearLanguageDraftBtn) clearLanguageDraftBtn.disabled = true;

      try {
      let prof = loadEditableProfile();
      prof.languages = (Array.isArray(prof.languages) ? prof.languages : [])
        .map(normalizeLangEntry)
        .filter(Boolean);

      const code = String(langCode.value || "").trim().toLowerCase();
      const kind = normalizeKind(langKind.value);

      if (!code || !kind) {
        showToast(t("languages.error.choose_language_type", "Choose language and type"), "error");
        return;
      }
      const takenOn = kind === KIND_EXAM ? String(langExamTakenOn?.value || "").trim() : "";
      const partialDate = kind === KIND_EXAM && Boolean(langExamTakenOn?.validity?.badInput);
      if (partialDate || (takenOn && (takenOn > new Date().toISOString().slice(0, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)))) {
        langExamTakenOn?.focus();
        showToast(t("profile.evidence.error.dates", "Check the dates for this evidence."), "error");
        return;
      }

      let payload = { code, kind };

      if (kind === KIND_CEFR) {
        const level = Number(langCefr.value);
        if (!Number.isInteger(level) || level < 1 || level > 6) {
          showToast(t("languages.error.choose_cefr", "Choose CEFR level"), "error");
          return;
        }
        payload = { ...payload, level };
      }

      if (kind === KIND_EXAM) {
        const examId = String(langExam.value || "").trim();
        const examObj = getExam(cfg, code, examId);
        if (!examObj) {
          showToast(t("languages.error.choose_exam", "Choose exam"), "error");
          return;
        }

        payload = { ...payload, exam: examId, ...(takenOn ? { taken_on: takenOn } : {}) };
        const examMode = getExamInputMode(examObj);
        const parseOverallScore = () => {
          const parsedTotal = validateExamScore(examObj, code, langExamScore.value, { required: true });
          if (parsedTotal.error) {
            showToast(parsedTotal.error, "error");
            return false;
          }
          payload.score = parsedTotal.score;
          return true;
        };

        if (examMode === "number") {
          if (!parseOverallScore()) return;
        }

        if (examMode === "subject_breakdown") {
          const details = readCompositeDetails(examObj);
          if (details === null) return;
          const scheme = getBreakdownScheme(examObj);
          const definitions = normalizeBreakdownDefs(scheme.fixed_components);
          const components = details?.components || [];
          if (components.length === definitions.length) {
            const values = components.map((item) => Number(item.score));
            const autoStrategy = String(
              scheme.auto_total_strategy
              || (String(examObj?.id || examId).toUpperCase().startsWith("IELTS") ? "average" : "sum")
            ).trim().toLowerCase();
            let total = values.reduce((sum, value) => sum + value, 0);
            if (autoStrategy === "average") total = Math.round((total / values.length) * 2) / 2;
            payload.score = total;
            payload.details = details;
          } else {
            // Sections are optional: without a full set the applicant's overall score is the evidence.
            if (!usesOverallScoreInput(examObj)) {
              showToast(
                t("languages.exam_breakdown_required", "Enter a score for every section"),
                "error"
              );
              return;
            }
            if (!parseOverallScore()) return;
            if (components.length) payload.details = details;
          }
        }
      }

      try {
        const res = await fetch(`${API_BASE}/languages/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let json = {};
        try {
          json = await res.json();
        } catch {
          json = {};
        }

        if (!res.ok) {
          const error = new Error("language_validate_failed");
          error.detail = json?.detail || json?.message || json?.error || "";
          throw error;
        }

        if (disposed || editorResetRevision !== submittedResetRevision) return;
        const entry = normalizeLangEntry(json?.language);
        if (!entry) throw new Error("Server returned invalid language data");

        // Only update this report; other profile fields may change while validation is pending.
        prof = loadEditableProfile();

        const existsIdx = prof.languages.findIndex((row) =>
          row.code === entry.code
          && row.kind === entry.kind
          && (entry.kind !== KIND_EXAM || (row.exam === entry.exam && String(row.taken_on || "") === String(entry.taken_on || "")))
        );

        // The edited entry is replaced in place when the language, kind and test stay the same; a row the new date
        // now duplicates is merged into it.
        // Saved rows are compared in the same normalized form as the entry opened in the editor; the mapping keeps positions.
        const editedIdx = findEditedLanguageIndex((prof.languages || []).map(normalizeLangEntry), submittedEditingEntry, entry);
        const isUpdate = editedIdx >= 0 || existsIdx >= 0;
        if (editedIdx >= 0) {
          prof.languages[editedIdx] = entry;
          if (existsIdx >= 0 && existsIdx !== editedIdx) prof.languages.splice(existsIdx, 1);
        } else if (existsIdx >= 0) prof.languages[existsIdx] = entry;
        else prof.languages.push(entry);

        saveEditableProfile(prof);
        renderList();

        if (entry.kind === KIND_EXAM) {
          const langLabel = getLangLabel(cfg, entry.code);
          const examLabel = getExamDisplayName(entry.exam, { langCode: entry.code, locale: getCurrentLanguage() });
          const valueLabel = formatLanguageExamValue(cfg, entry);
          showToast(
            valueLabel
              ? (isUpdate
                ? tFormat("languages.updated_value", { language: langLabel, exam: examLabel, value: valueLabel }, `Updated ${langLabel} ${examLabel}: ${valueLabel}`)
                : tFormat("languages.added_value", { language: langLabel, exam: examLabel, value: valueLabel }, `Added ${langLabel} ${examLabel}: ${valueLabel}`))
              : (isUpdate
                ? t("languages.updated", "Language updated")
                : t("languages.added", "Language added")),
            "success"
          );
        } else {
          showToast(
            isUpdate
              ? t("languages.updated", "Language updated")
              : t("languages.added", "Language added"),
            "success"
          );
        }
        if (draftRevision === submittedDraftRevision) {
          resetExamInputs();
          setEditorDirty(false);
        }
        } catch (e) {
          if (!disposed && editorResetRevision === submittedResetRevision && draftRevision === submittedDraftRevision) {
            showToast(
              formatLanguageValidationToast(code, payload.exam || "", e?.detail || e?.message || ""),
              "error"
            );
          }
        }
      } finally {
        isSubmitting = false;
        if (langAddBtn) langAddBtn.disabled = false;
        if (clearLanguageDraftBtn) clearLanguageDraftBtn.disabled = false;
      }
    }

    langList.addEventListener("click", (event) => {
      const editBtn = event.target.closest("button[data-edit-idx]");
      if (editBtn) {
        motionPress(editBtn);
        const idx = Number(editBtn.dataset.editIdx);
        const prof = loadEditableProfile();
        const entry = (Array.isArray(prof.languages) ? prof.languages : []).map(normalizeLangEntry).filter(Boolean)[idx];
        if (!entry) return;
        loadIntoEditor(entry);
        editingEntry = entry;
        (entry.kind === KIND_EXAM ? langExamTakenOn : langCefr)?.focus();
        return;
      }
      const btn = event.target.closest("button[data-idx]");
      if (!btn) return;
      motionPress(btn);
      const idx = Number(btn.dataset.idx);
      if (!Number.isFinite(idx)) return;

      const prof = loadEditableProfile();
      prof.languages = (Array.isArray(prof.languages) ? prof.languages : [])
        .map(normalizeLangEntry)
        .filter(Boolean);

      const row = btn.closest(".lang-item");
      const removedKey = JSON.stringify(prof.languages[idx]);
      if (!row || removedKey === undefined) return;
      // Re-read on completion and remove by content: another row may have been removed meanwhile.
      setRevealed(row, false, { onHidden: () => {
        const latest = loadEditableProfile();
        latest.languages = (Array.isArray(latest.languages) ? latest.languages : []).map(normalizeLangEntry).filter(Boolean);
        const at = latest.languages.findIndex((entry) => JSON.stringify(entry) === removedKey);
        if (at < 0) return;
        latest.languages.splice(at, 1);
        saveEditableProfile(latest);
        renderList();
        showToast(t("languages.removed", "Removed"), "success");
      } });
    });

    // The profile opens after this panel boots and rebuilds its selects, so a link to a test is followed once it is open.
    let linkPending = true;
    const onProfileModalOpened = () => {
      renderForm();
      if (linkPending) openFromLink();
      linkPending = false;
    };
    const onLanguageChanged = () => renderForm({ preserveDraft: true });
    const onProfileUpdated = () => renderForm({ preserveDraft: true });
    window.addEventListener("profileModalOpened", onProfileModalOpened);
    window.addEventListener("languageChanged", onLanguageChanged);
    window.addEventListener("profileUpdated", onProfileUpdated);
    window.addEventListener("profileReportDraftReset", clearEditor);
    const onOpenLanguageExam = event => { void openExamEditor(String(event.detail?.exam || "").trim()); };
    window.addEventListener("unisearch:open-language-exam", onOpenLanguageExam);
    disposeWindowHandlers = () => {
      window.removeEventListener("unisearch:open-language-exam", onOpenLanguageExam);
      window.removeEventListener("profileModalOpened", onProfileModalOpened);
      window.removeEventListener("languageChanged", onLanguageChanged);
      window.removeEventListener("profileUpdated", onProfileUpdated);
      window.removeEventListener("profileReportDraftReset", clearEditor);
    };
  };

  if (!getConfigOrNull()) {
    languageConfigLoadedHandler = () => boot();
    window.addEventListener("languageConfigLoaded", languageConfigLoadedHandler, { once: true });
    return dispose;
  }
  boot();
  return dispose;
}
