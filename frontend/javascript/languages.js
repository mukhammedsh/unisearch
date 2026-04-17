import {
  API_BASE,
  LANG_CONFIG,
  loadProfile,
  normalizeProfileData,
  saveProfile,
  showToast,
  initCustomSelect,
  escapeHtml,
  getExamDisplayName,
  animateElementOut,
  markMotionEnter,
  motionPress,
} from "./utils.js";
import { t, tFormat } from "./i18n.js";

const KIND_NATIVE = "native";
const KIND_CEFR = "cefr";
const KIND_EXAM = "exam";

const CEFR_LABEL = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
};

function getConfigOrNull() {
  return (typeof LANG_CONFIG !== "undefined" && LANG_CONFIG) ? LANG_CONFIG : null;
}

function normalizeKind(kindRaw) {
  const kind = String(kindRaw || "").trim().toLowerCase();
  if (kind === KIND_NATIVE) return KIND_NATIVE;
  if (kind === KIND_CEFR) return KIND_CEFR;
  if (kind === KIND_EXAM) return KIND_EXAM;
  return "";
}

function getLangLabel(cfg, code) {
  const item = (cfg.languages || []).find((x) => x.code === code);
  const normalizedCode = String(code || "").trim().toLowerCase();
  const fallback = item?.native_name || item?.name || item?.label || normalizedCode || code;
  return t(`languages.name.${normalizedCode}`, fallback);
}

function getLocalizedKindLabel(kindId, fallback = "") {
  const kind = normalizeKind(kindId);
  if (kind === KIND_NATIVE) return t("languages.kind.native", "Native");
  if (kind === KIND_CEFR) return t("languages.kind.cefr", "CEFR");
  if (kind === KIND_EXAM) return t("languages.kind.exam", "Exam");
  return String(fallback || kindId || "");
}

function getKindLabel(cfg, kindId) {
  const item = (cfg.proof_kinds || []).find((x) => x.id === kindId);
  return getLocalizedKindLabel(kindId, item?.label || kindId);
}

function getExamList(cfg, langCode) {
  return (cfg.language_exams && cfg.language_exams[langCode]) ? cfg.language_exams[langCode] : [];
}

function getVisibleExamList(cfg, langCode) {
  return getExamList(cfg, langCode).filter((item) => !item?.hidden);
}

function getExam(cfg, langCode, examId) {
  return getExamList(cfg, langCode).find((x) => String(x?.id || "").trim() === String(examId || "").trim()) || null;
}

function getExamInputMode(examObj) {
  const raw = String(examObj?.input_mode || "").trim().toLowerCase();
  return raw || "number";
}

function getBreakdownScheme(examObj) {
  const scheme = examObj?.breakdown_scheme;
  return scheme && typeof scheme === "object" ? scheme : {};
}

function normalizeBreakdownDefs(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const exam = String(row.exam || row.id || row.exam_id || "").trim();
      if (!exam) return null;
      return {
        exam,
        label: String(row.label || "").trim() || exam,
        required: !!row.required,
      };
    })
    .filter(Boolean);
}

function clearNumericInputLimits(inputEl) {
  if (!inputEl) return;
  inputEl.removeAttribute("min");
  inputEl.removeAttribute("max");
  inputEl.removeAttribute("step");
}

function setNumericInputLimits(inputEl, examObj) {
  if (!inputEl) return;
  if (!examObj) {
    clearNumericInputLimits(inputEl);
    return;
  }
  if (examObj.min !== undefined) inputEl.min = String(examObj.min);
  else inputEl.removeAttribute("min");
  if (examObj.max !== undefined) inputEl.max = String(examObj.max);
  else inputEl.removeAttribute("max");
  if (examObj.step !== undefined) inputEl.step = String(examObj.step);
  else inputEl.step = "0.5";
}

function isMultipleOfStep(score, min, step) {
  const k = (score - min) / step;
  return Math.abs(k - Math.round(k)) < 1e-9;
}

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return null;
  }
}

function getProfileDraftBridge() {
  const bridge = window.__unisearchProfileDraft;
  if (!bridge || typeof bridge !== "object") return null;
  if (typeof bridge.get !== "function" || typeof bridge.set !== "function") return null;
  if (typeof bridge.isActive === "function" && !bridge.isActive()) return null;
  return bridge;
}

function loadEditableProfile() {
  const bridge = getProfileDraftBridge();
  if (bridge) {
    return normalizeProfileData(bridge.get());
  }
  return normalizeProfileData(loadProfile());
}

function saveEditableProfile(profile) {
  const bridge = getProfileDraftBridge();
  const next = normalizeProfileData(profile);
  if (bridge) {
    bridge.set(next);
    return;
  }
  saveProfile(next);
}

function normalizeLangEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const code = String(entry.code || entry.lang || "").trim().toLowerCase();
  const kind = normalizeKind(entry.kind);
  if (!code || !kind) return null;

  if (kind === KIND_NATIVE) return { code, kind };

  if (kind === KIND_CEFR) {
    const level = Number(entry.level);
    if (!Number.isInteger(level) || level < 1 || level > 6) return null;
    return { code, kind, level };
  }

  if (kind === KIND_EXAM) {
    const examId = String(entry.exam || entry.examId || "").trim();
    const rawValue = String(entry.raw_value || entry.rawValue || "").trim();
    const displayValue = String(entry.display_value || entry.displayValue || "").trim();
    const details = clonePlainObject(entry.details);
    const score = Number(entry.score);
    if (!examId || (Number.isNaN(score) && !rawValue && !details)) return null;
    const out = { code, kind, exam: examId };
    if (!Number.isNaN(score)) out.score = score;
    if (rawValue) out.raw_value = rawValue;
    if (displayValue) out.display_value = displayValue;
    if (details) out.details = details;
    return out;
  }

  return null;
}

function getCompositeParentLabel(examObj) {
  const raw = String(getBreakdownScheme(examObj)?.parent_score_label || "").trim();
  const normalized = raw.toLowerCase();
  if (normalized === "overall") return t("languages.exam_total_overall", "Overall");
  if (normalized === "total") return t("languages.exam_total_total", "Total");
  return raw || t("languages.exam_total_total", "Total");
}

function formatValuePart(value) {
  const raw = String(value?.display_value || value?.displayValue || value?.raw_value || value?.rawValue || "").trim();
  if (raw) return raw;
  const score = Number(value?.score);
  return Number.isFinite(score) ? String(score) : "";
}

function formatLanguageExamValue(cfg, entry) {
  if (!entry || entry.kind !== KIND_EXAM) return "";
  const examObj = getExam(cfg, entry.code, entry.exam);
  const mode = getExamInputMode(examObj);
  if (mode === "subject_breakdown") {
    const components = Array.isArray(entry?.details?.components) ? entry.details.components : [];
    const parts = [];
    if (Number.isFinite(Number(entry.score))) {
      parts.push(`${getCompositeParentLabel(examObj)} ${entry.score}`);
    }
    components.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const childExam = String(item.exam || item.id || item.exam_id || "").trim();
      const value = formatValuePart(item);
      if (!childExam || !value) return;
      parts.push(`${getExamDisplayName(childExam, { langCode: entry.code })} ${value}`);
    });
    if (parts.length) return parts.join(", ");
  }

  const display = String(entry.display_value || entry.displayValue || entry.raw_value || entry.rawValue || "").trim();
  if (display) return display;

  const score = Number(entry.score);
  return Number.isFinite(score) ? String(score) : "";
}

function formatLanguageValidationToast(code, examId, detailRaw) {
  const examLabel = getExamDisplayName(examId, { langCode: code });
  const detail = String(detailRaw || "").trim();
  if (!detail) {
    return tFormat("languages.error.generic", { exam: examLabel }, `Could not save ${examLabel}`);
  }

  const rangeMatch = detail.match(/Score must be between\s+(.+?)\s+and\s+(.+)$/i);
  if (rangeMatch) {
    return tFormat(
      "languages.error.range",
      { exam: examLabel, min: rangeMatch[1], max: rangeMatch[2] },
      `${examLabel} must be between ${rangeMatch[1]} and ${rangeMatch[2]}`
    );
  }

  const stepMatch = detail.match(/step=?([0-9.]+)/i);
  if (stepMatch) {
    return tFormat(
      "languages.error.step",
      { exam: examLabel, step: stepMatch[1] },
      `${examLabel} must use step ${stepMatch[1]}`
    );
  }

  if (/integer/i.test(detail)) {
    return tFormat(
      "languages.error.integer_required",
      { exam: examLabel },
      `${examLabel} requires an integer score`
    );
  }

  if (/invalid score format/i.test(detail)) {
    return t("languages.error.enter_score", "Enter score");
  }

  return tFormat(
    "languages.error.detail",
    { exam: examLabel, reason: detail },
    `Could not save ${examLabel}: ${detail}`
  );
}

function validateExamScore(examObj, code, rawInput, { required = true } = {}) {
  const normalizedRaw = String(rawInput || "").trim().replaceAll(",", ".");
  if (!normalizedRaw) {
    return required ? { error: t("languages.error.enter_score", "Enter score") } : { empty: true };
  }

  const score = Number(normalizedRaw);
  if (Number.isNaN(score)) {
    return { error: t("languages.error.enter_score", "Enter score") };
  }

  const examLabel = getExamDisplayName(examObj?.id, { langCode: code });
  const examType = String(examObj?.type || "").trim().toLowerCase();
  if (examType === "int" && !Number.isInteger(score)) {
    return {
      error: tFormat(
        "languages.error.integer_required",
        { exam: examLabel },
        `${examLabel} requires an integer score`
      ),
    };
  }

  const min = Number(examObj?.min);
  const max = Number(examObj?.max);
  if (Number.isFinite(min) && Number.isFinite(max) && (score < min || score > max)) {
    return {
      error: tFormat(
        "languages.error.range",
        { exam: examLabel, min, max },
        `${examLabel} must be between ${min} and ${max}`
      ),
    };
  }

  const step = Number(examObj?.step ?? 1);
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    if (!isMultipleOfStep(score, base, step)) {
      return {
        error: tFormat(
          "languages.error.step",
          { exam: examLabel, step },
          `${examLabel} must use step ${step}`
        ),
      };
    }
  }

  return { score, raw: normalizedRaw };
}

function findExistingExamEntry(profile, code, examId) {
  const rows = (Array.isArray(profile?.languages) ? profile.languages : [])
    .map(normalizeLangEntry)
    .filter(Boolean);
  return rows.find((row) => row.code === code && row.kind === KIND_EXAM && row.exam === examId) || null;
}

export function initLanguagesPanel() {
  const boot = () => {
    const cfg = getConfigOrNull();
    if (!cfg) return;

    const langCode = document.getElementById("langCode");
    const langKind = document.getElementById("langKind");
    const langCefr = document.getElementById("langCefr");
    const langExam = document.getElementById("langExam");
    const langExamScore = document.getElementById("langExamScore");
    const cefrContainer = document.getElementById("cefrContainer");
    const examContainer = document.getElementById("examContainer");
    const scoreContainer = document.getElementById("scoreContainer");
    const langExamSpecialContainer = document.getElementById("langExamSpecialContainer");
    const langAddBtn = document.getElementById("langAddBtn");
    const langList = document.getElementById("langList");
    const languagesBlock = document.getElementById("languagesBlock");

    if (
      !langCode || !langKind || !langCefr || !langExam || !langExamScore
      || !langAddBtn || !langList || !languagesBlock
    ) {
      return;
    }

    function findExistingEntryIndex(entries, draft) {
      const list = Array.isArray(entries) ? entries : [];
      const item = draft && typeof draft === "object" ? draft : null;
      if (!item?.code || !item?.kind) return -1;
      if (item.kind === KIND_EXAM) {
        if (!item.exam) return -1;
        return list.findIndex((x) =>
          x.code === item.code && x.kind === item.kind && x.exam === item.exam
        );
      }
      return list.findIndex((x) => x.code === item.code && x.kind === item.kind);
    }

    function getDraftEntryFromUI() {
      const code = String(langCode.value || "").trim().toLowerCase();
      const kind = normalizeKind(langKind.value);
      if (!code || !kind) return null;
      if (kind === KIND_EXAM) {
        const exam = String(langExam.value || "").trim();
        if (!exam) return null;
        return { code, kind, exam };
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
    }

    function populateLangCode() {
      const current = String(langCode.value || "").trim().toLowerCase();
      langCode.innerHTML = "";
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
      langKind.innerHTML = "";
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
      langExam.innerHTML = "";

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
        opt.textContent = getExamDisplayName(examObj.id, { langCode: code });
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

      langList.innerHTML = arr.map((entry, idx) => {
        const langName = escapeHtml(getLangLabel(cfg, entry.code));
        const kindName = escapeHtml(getKindLabel(cfg, entry.kind));

        let meta = "";
        if (entry.kind === KIND_CEFR) {
          meta = ` — ${escapeHtml(CEFR_LABEL[entry.level] || String(entry.level))}`;
        }
        if (entry.kind === KIND_EXAM) {
          const exLabel = escapeHtml(getExamDisplayName(entry.exam, { langCode: entry.code }));
          const valueLabel = escapeHtml(formatLanguageExamValue(cfg, entry));
          meta = valueLabel ? ` — ${exLabel}: ${valueLabel}` : ` — ${exLabel}`;
        }

        return `
          <div class="lang-item">
            <div class="lang-item__main">
              <strong>${langName}</strong>
              <small>${kindName}${meta}</small>
            </div>
            <button class="profile-delete" data-idx="${idx}" type="button">${escapeHtml(t("profile.delete", "Delete"))}</button>
          </div>
        `;
      }).join("");
      markMotionEnter(langList, ".lang-item", { limit: 8, staggerMs: 18 });

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
        langExamSpecialContainer.style.display = "none";
        langExamSpecialContainer.innerHTML = "";
        return;
      }

      const defs = normalizeBreakdownDefs(getBreakdownScheme(examObj).fixed_components);
      if (!defs.length) {
        langExamSpecialContainer.hidden = true;
        langExamSpecialContainer.style.display = "none";
        langExamSpecialContainer.innerHTML = "";
        return;
      }

      const profile = loadEditableProfile();
      const existing = findExistingExamEntry(
        profile,
        String(langCode.value || "").trim().toLowerCase(),
        String(examObj.id || "").trim()
      );
      const existingComponents = new Map(
        (Array.isArray(existing?.details?.components) ? existing.details.components : [])
          .filter((row) => row && typeof row === "object")
          .map((row) => [String(row.exam || row.id || row.exam_id || "").trim(), row])
      );

      langExamSpecialContainer.hidden = false;
      langExamSpecialContainer.style.display = "block";
      langExamSpecialContainer.dataset.examId = String(examObj.id || "");
      langExamSpecialContainer.innerHTML = `
        <div class="profile-exam-special-grid profile-exam-special-grid--breakdown">
          ${defs.map((def) => {
            const childExam = getExam(cfg, String(langCode.value || "").trim().toLowerCase(), def.exam);
            const existingValue = existingComponents.get(def.exam);
            const valueText = escapeHtml(formatValuePart(existingValue));
            return `
              <div class="profile-exam-breakdown-row" data-lang-breakdown-row="${escapeHtml(def.exam)}">
                <div class="profile-exam-breakdown-subject">
                  <span class="mini-label">${escapeHtml(getExamDisplayName(def.exam, { langCode: String(langCode.value || "").trim().toLowerCase() }))}</span>
                  <div class="profile-exam-breakdown-chip">${escapeHtml(getExamDisplayName(def.exam, { langCode: String(langCode.value || "").trim().toLowerCase() }))}</div>
                </div>
                <div class="profile-exam-breakdown-score">
                  <span class="mini-label">${escapeHtml(t("profile.placeholder.score", "Score"))}</span>
                  <input
                    type="text"
                    inputmode="decimal"
                    class="profile-input"
                    value="${valueText}"
                    placeholder="${escapeHtml(t("profile.placeholder.score", "Score"))}"
                    data-lang-breakdown-input="${escapeHtml(def.exam)}"
                    ${childExam?.min !== undefined ? `min="${escapeHtml(String(childExam.min))}"` : ""}
                    ${childExam?.max !== undefined ? `max="${escapeHtml(String(childExam.max))}"` : ""}
                    ${childExam?.step !== undefined ? `step="${escapeHtml(String(childExam.step))}"` : ""}
                  />
                </div>
              </div>
            `;
          }).join("")}
          <div class="profile-exam-special-hint">${escapeHtml(
            t(
              "languages.exam_breakdown_hint",
              "Add section scores if you have them. Overall score remains the main requirement unless a university publishes section minimums."
            )
          )}</div>
        </div>
      `;
    }

    function syncExamUi() {
      const kind = normalizeKind(langKind.value);
      const examObj = selectedExamObject();
      const examMode = getExamInputMode(examObj);
      const usesParentScore = examMode === "number"
        || (examMode === "subject_breakdown" && String(getBreakdownScheme(examObj).total_strategy || "").trim().toLowerCase() === "use_parent_score");

      if (cefrContainer) cefrContainer.style.display = kind === KIND_CEFR ? "block" : "none";
      if (examContainer) examContainer.style.display = kind === KIND_EXAM ? "block" : "none";
      if (scoreContainer) {
        scoreContainer.style.display = kind === KIND_EXAM && !!examObj && usesParentScore ? "block" : "none";
      }

      if (kind === KIND_EXAM && examObj && usesParentScore) {
        setNumericInputLimits(langExamScore, examObj);
        const placeholder = examMode === "subject_breakdown"
          ? tFormat(
            "languages.exam_total_placeholder",
            { label: getCompositeParentLabel(examObj) },
            `${getCompositeParentLabel(examObj)} score`
          )
          : t("profile.placeholder.lang_score", "Score (e.g. 7.5)");
        langExamScore.placeholder = placeholder;
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
          showToast(parsed.error, "error");
          return null;
        }
        if (parsed.empty) continue;
        components.push({ exam: def.exam, score: parsed.score });
      }
      return components.length ? { components } : undefined;
    }

    function resetExamInputs() {
      langExam.value = "";
      langExamScore.value = "";
      if (langExamSpecialContainer) {
        langExamSpecialContainer.innerHTML = "";
        langExamSpecialContainer.hidden = true;
        langExamSpecialContainer.style.display = "none";
      }
      initCustomSelect("langExam");
      syncExamUi();
      refreshLangActionButton();
    }

    function renderForm() {
      populateLangCode();
      populateLangKind();
      populateLangExam();
      renderList();
      initCustomSelect("langCode");
      initCustomSelect("langKind");
      initCustomSelect("langCefr");
      initCustomSelect("langExam");
      syncExamUi();
      refreshLangActionButton();
    }

    populateLangCode();
    populateLangKind();
    populateLangExam();
    initCustomSelect("langCode");
    initCustomSelect("langKind");
    initCustomSelect("langCefr");
    initCustomSelect("langExam");
    syncExamUi();
    renderList();
    refreshLangActionButton();

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

    langExamSpecialContainer?.addEventListener("input", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.value.includes(",")) {
        target.value = target.value.replaceAll(",", ".");
      }
    });

    langAddBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      motionPress(langAddBtn);
      addLanguage();
    });

    const submitLanguageOnEnter = (ev) => {
      if (ev.key !== "Enter") return;
      if (ev.defaultPrevented) return;
      if (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) return;
      if (ev.target instanceof Element && ev.target.closest(".custom-select-wrapper.open")) return;
      ev.preventDefault();
      addLanguage();
    };

    [langCode, langKind, langCefr, langExam, langExamScore].forEach((control) => {
      control.addEventListener("keydown", submitLanguageOnEnter);
    });
    languagesBlock.addEventListener("keydown", submitLanguageOnEnter);

    async function addLanguage() {
      const prof = loadEditableProfile();
      prof.languages = (Array.isArray(prof.languages) ? prof.languages : [])
        .map(normalizeLangEntry)
        .filter(Boolean);

      const code = String(langCode.value || "").trim().toLowerCase();
      const kind = normalizeKind(langKind.value);

      if (!code || !kind) {
        showToast(t("languages.error.choose_language_type", "Choose language and type"), "error");
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

        payload = { ...payload, exam: examId };
        const examMode = getExamInputMode(examObj);
        const usesParentScore = examMode === "number"
          || (examMode === "subject_breakdown" && String(getBreakdownScheme(examObj).total_strategy || "").trim().toLowerCase() === "use_parent_score");

        if (usesParentScore) {
          const parsedTotal = validateExamScore(examObj, code, langExamScore.value, { required: true });
          if (parsedTotal.error) {
            showToast(parsedTotal.error, "error");
            return;
          }
          payload.score = parsedTotal.score;
        }

        if (examMode === "subject_breakdown") {
          const details = readCompositeDetails(examObj);
          if (details === null) return;
          if (details) payload.details = details;
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
        } catch (e) {
          json = {};
        }

        if (!res.ok) {
          const error = new Error("language_validate_failed");
          error.detail = json?.detail || json?.message || json?.error || "";
          throw error;
        }

        const entry = normalizeLangEntry(json?.language);
        if (!entry) throw new Error("Server returned invalid language data");

        const existsIdx = prof.languages.findIndex((row) =>
          row.code === entry.code
          && row.kind === entry.kind
          && (entry.kind !== KIND_EXAM || row.exam === entry.exam)
        );

        const isUpdate = existsIdx >= 0;
        if (isUpdate) prof.languages[existsIdx] = entry;
        else prof.languages.push(entry);

        saveEditableProfile(prof);
        renderList();

        if (entry.kind === KIND_EXAM) {
          const langLabel = getLangLabel(cfg, entry.code);
          const examLabel = getExamDisplayName(entry.exam, { langCode: entry.code });
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
          resetExamInputs();
        } else {
          showToast(
            isUpdate
              ? t("languages.updated", "Language updated")
              : t("languages.added", "Language added"),
            "success"
          );
        }
      } catch (e) {
        showToast(
          formatLanguageValidationToast(code, payload.exam || "", e?.detail || e?.message || ""),
          "error"
        );
      }
    }

    langList.addEventListener("click", (event) => {
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
      animateElementOut(row, () => {
        prof.languages.splice(idx, 1);
        saveEditableProfile(prof);
        renderList();
        showToast(t("languages.removed", "Removed"), "success");
      });
    });

    window.addEventListener("profileModalOpened", renderForm);
    window.addEventListener("languageChanged", renderForm);
  };

  if (!getConfigOrNull()) {
    window.addEventListener("languageConfigLoaded", () => boot(), { once: true });
    return;
  }
  boot();
}
