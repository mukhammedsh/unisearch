import {
  API_BASE,
  EXAM_CONFIG,
  canonicalizeExamId,
  escapeHtml,
  escapeHtmlAttr,
  formatExamValue,
  getExamConfig,
  getExamDisplayName,
  getExamInputMode,
  motionPress,
  showToast,
} from "../../utils.js";
import { enterNewRows, readRowKeys, setRevealed } from "../../utils/motion-reveal.js";
import { profileExamIdentity } from "../../utils/persistence.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import {
  breakdownAllowsTotalOnly,
  breakdownSchemeFor,
  readSubjectBreakdownDraft as readSubjectBreakdownDraftFromModule,
  renderSpecialExamInput as renderSpecialExamInputFromModule,
} from "./exam-breakdowns.js";
import {
  ensureProfileShape,
  formatExamValidationToast,
  hasPartialDateInput,
  reportInvalidDate,
  setFieldInvalid,
} from "./profile-utils.js";
import { initCommonSelects, refreshSaveState } from "./profile-form-fields.js";

// English tests offered in the exam list as shortcuts to the Languages editor, which holds their section scores.
const ENGLISH_TEST_SHORTCUTS = ["IELTS", "TOEFL_iBT_0_120", "DET", "PTE"];
export const LANGUAGE_EXAM_PREFIX = "language:";

export const findExistingExamEntry = (examId, els, state) => {
    const selected = canonicalizeExamId(examId);
    const takenOn = String(els.examTakenOnInput?.value || "").trim();
    if (!selected || !Array.isArray(state.profile.exams)) return null;
    return state.profile.exams.find((row) => canonicalizeExamId(row?.exam ?? row?.id ?? "") === selected
        && String(row?.taken_on || "") === takenOn) || null;
};

export const examDraftControls = (els) => [els.examScoreInput, els.examTakenOnInput,
    ...Array.from(els.examSpecialInputContainer?.querySelectorAll("input, select") || [])].filter(Boolean);

const readSubjectBreakdownDraft = (examId, els, state, options = {}) =>
    readSubjectBreakdownDraftFromModule(examId, els.examSpecialInputContainer, {
        ...options,
        findExistingExamEntry: (id) => findExistingExamEntry(id, els, state),
    });

export const renderSpecialExamInput = (examId, els, state) =>
    renderSpecialExamInputFromModule(examId, els.examSpecialInputContainer, {
        findExistingExamEntry: (id) => findExistingExamEntry(id, els, state),
    });

export const syncExamScoreInputState = (els, state) => {
    if (!els.examScoreInput) return;

    const selectedExam = canonicalizeExamId(els.examNameSelect?.value);
    const mode = getExamInputMode(selectedExam);
    const cfg = getExamConfig(selectedExam);
    const breakdownScheme = breakdownSchemeFor(selectedExam);
    const examForm = els.examScoreInput.closest(".profile-exam-form");
    const existing = findExistingExamEntry(selectedExam, els, state);
    const usesCompositeParentScore = mode === "subject_breakdown"
        && String(breakdownScheme?.total_strategy || "").trim().toLowerCase() === "use_parent_score";
    const usesTotalOnlyInput = mode === "subject_breakdown" && breakdownAllowsTotalOnly(selectedExam);
    const usesNumberInput = mode === "number" || usesCompositeParentScore || usesTotalOnlyInput;
    const usesSpecialInput = mode === "band_select" || mode === "grade_combo" || mode === "subject_breakdown";

    els.examScoreInput.hidden = !usesNumberInput;
    const scoreField = els.examScoreInput.closest(".profile-exam-score-wrap");
    if (scoreField) scoreField.hidden = !usesNumberInput;
    els.examScoreInput.disabled = !usesNumberInput;
    els.examScoreInput.setAttribute("aria-hidden", usesNumberInput ? "false" : "true");

    if (els.examSpecialInputContainer) {
        els.examSpecialInputContainer.hidden = !usesSpecialInput;
        els.examSpecialInputContainer.style.display = usesSpecialInput ? "" : "none";
        els.examSpecialInputContainer.setAttribute("aria-hidden", usesSpecialInput ? "false" : "true");
        renderSpecialExamInput(selectedExam, els, state);
    }

    if (examForm) {
        examForm.classList.toggle("profile-exam-form--no-score", !usesNumberInput && !usesSpecialInput);
        examForm.classList.toggle("profile-exam-form--with-special", usesSpecialInput);
        examForm.classList.toggle("profile-exam-form--grades", mode === "grade_combo");
        examForm.classList.toggle("profile-exam-form--band", mode === "band_select");
        examForm.classList.toggle("profile-exam-form--breakdown", mode === "subject_breakdown");
    }

    if (!usesNumberInput) {
        els.examScoreInput.value = "";
        return;
    }

    els.examScoreInput.placeholder = usesCompositeParentScore || usesTotalOnlyInput
        ? t("profile.exam_total_placeholder", "Overall total")
        : t("profile.placeholder.score", "Score");
    if (existing && Number.isFinite(Number(existing?.score))) {
        els.examScoreInput.value = String(existing.score);
    } else {
        els.examScoreInput.value = "";
    }

    if (cfg) {
        if (cfg.min !== undefined) els.examScoreInput.min = String(cfg.min);
        else els.examScoreInput.removeAttribute("min");
        if (cfg.max !== undefined) els.examScoreInput.max = String(cfg.max);
        else els.examScoreInput.removeAttribute("max");
        if (cfg.step !== undefined) els.examScoreInput.step = String(cfg.step);
        else els.examScoreInput.step = cfg.type === "float" ? "any" : "1";
        return;
    }

    els.examScoreInput.removeAttribute("min");
    els.examScoreInput.removeAttribute("max");
    els.examScoreInput.step = "0.1";
};

export const readSelectedExamPayload = (examId, els, state) => {
    const mode = getExamInputMode(examId);
    if (mode === "flag") {
        return { score: 1 };
    }

    if (mode === "band_select") {
        const bandSelect = els.examSpecialInputContainer?.querySelector("#examBandSelect");
        const band = String(bandSelect?.value || "").trim();
        if (!band) {
            showToast(t("profile.exam_band_required", "Select a level"), "error");
            return null;
        }
        return {
            raw_value: band,
            details: { band },
        };
    }

    if (mode === "grade_combo") {
        const cfg = getExamConfig(examId);
        const gradeScheme = cfg?.grade_scheme || {};
        const minCount = Math.max(1, Number(gradeScheme?.subject_count_min) || 3);
        const gradeSelects = Array.from(els.examSpecialInputContainer?.querySelectorAll("[data-grade-slot]") || []);
        const grades = gradeSelects.map((node) => String(node?.value || "").trim());
        const requiredGrades = grades.slice(0, minCount);
        if (requiredGrades.some((grade) => !grade)) {
            showToast(
                tFormat(
                    "profile.exam_grade_required",
                    { exam: getExamDisplayName(examId, { locale: getCurrentLanguage() }), count: minCount },
                    `Choose ${minCount} grades for ${getExamDisplayName(examId, { locale: getCurrentLanguage() })}`
                ),
                "error"
            );
            return null;
        }

        const normalizedGrades = grades.filter(Boolean);
        const rawValue = normalizedGrades.join("");
        return {
            raw_value: rawValue,
            details: { grades: normalizedGrades },
        };
    }

    if (mode === "subject_breakdown") {
        const scheme = breakdownSchemeFor(examId);
        const draft = readSubjectBreakdownDraft(examId, els, state);
        if (!draft) return null;

        if (breakdownAllowsTotalOnly(examId) && !draft.components.length) {
            const rawScore = String(els.examScoreInput?.value || "").trim();
            const score = Number(rawScore);
            if (!rawScore || Number.isNaN(score)) {
                showToast(t("profile.exam_total_or_sections_required", "Enter the overall score or the score for each section."), "error");
                return null;
            }
            return { score, raw_input_score: rawScore };
        }

        const selectableMin = Math.max(0, Number(scheme?.selectable_count_min) || 0);
        const selectableSet = new Set(draft.selectable.map((item) => item.exam));
        const selectedOptionalCount = draft.components.filter((row) => selectableSet.has(row.exam)).length;
        if (selectedOptionalCount < selectableMin) {
            showToast(
                tFormat(
                    "profile.exam_subject_required_count",
                    { count: selectableMin, exam: getExamDisplayName(examId, { locale: getCurrentLanguage() }) },
                    `Choose at least ${selectableMin} subjects for ${getExamDisplayName(examId, { locale: getCurrentLanguage() })}`
                ),
                "error"
            );
            return null;
        }

        const payload = {
            details: {
                components: draft.components,
                ...(draft.extraScores.length ? { extra_scores: draft.extraScores } : {}),
            },
        };

        if (scheme.total_strategy === "components_only" && !draft.components.length) {
            showToast(t("profile.exam_section_required", "Add at least one reported section score."), "error");
            return null;
        }

        if (String(scheme?.total_strategy || "").trim().toLowerCase() === "use_parent_score") {
            const rawScore = String(els.examScoreInput?.value || "").trim();
            const canDeriveTotal = scheme.auto_total_strategy === "sum" && draft.fixed.length > 0
                && draft.fixed.every(({ exam }) => draft.components.some((row) => row.exam === exam && Number.isFinite(row.score)));
            if (!rawScore && canDeriveTotal) return payload;
            const score = Number(rawScore);
            if (!rawScore || Number.isNaN(score)) {
                showToast(t("profile.exam_invalid_score", "Invalid score format"), "error");
                return null;
            }
            payload.score = score;
            payload.raw_input_score = rawScore;
        }

        return payload;
    }

    const rawScore = String(els.examScoreInput?.value || "").trim();
    const score = Number.parseFloat(rawScore);
    return { score, raw_input_score: rawScore };
};

export const refreshExamActionButton = (els, state) => {
    if (!els.addExamBtn || !els.examNameSelect) return;
    const selected = canonicalizeExamId(els.examNameSelect.value);
    if (els.clearExamDraftBtn) els.clearExamDraftBtn.hidden = !selected;
    const takenOn = String(els.examTakenOnInput?.value || "").trim();
    const hasExisting = !!selected && Array.isArray(state.profile.exams)
        && state.profile.exams.some((e) => canonicalizeExamId(e.exam ?? e.id ?? "") === selected && String(e.taken_on || "") === takenOn);
    const key = hasExisting ? "profile.edit" : "profile.add";
    const fallback = hasExisting ? "Edit" : "Add";
    els.addExamBtn.setAttribute("data-i18n", key);
    els.addExamBtn.textContent = t(key, fallback);
};

export const populateExamSelect = (els, state) => {
    if (!els.examNameSelect) return;
    const selectedExam = els.examNameSelect.value;
    els.examNameSelect.innerHTML = `<option value="" disabled selected>${escapeHtml(t("profile.option.select_exam", "Select Exam"))}</option>`;

    const seen = new Set();
    Object.keys(EXAM_CONFIG).forEach((examKey) => {
        const cfg = EXAM_CONFIG?.[examKey];
        if (cfg?.hidden) return;
        const normalized = canonicalizeExamId(examKey);
        const key = String(normalized || examKey).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!key || key === "GPA") return;
        if (seen.has(key)) return;
        seen.add(key);

        const opt = document.createElement("option");
        opt.value = normalized || examKey;
        opt.textContent = getExamDisplayName(normalized || examKey, { locale: getCurrentLanguage() });
        els.examNameSelect.appendChild(opt);
    });
    // English tests are entered under Languages, but applicants look for them here: these entries open that editor.
    ENGLISH_TEST_SHORTCUTS.forEach((examId) => {
        const opt = document.createElement("option");
        opt.value = `${LANGUAGE_EXAM_PREFIX}${examId}`;
        opt.textContent = tFormat("profile.exam_option.language", { exam: getExamDisplayName(examId, { langCode: "en", locale: getCurrentLanguage() }) });
        els.examNameSelect.appendChild(opt);
    });

    els.examNameSelect.value = selectedExam;
    initCommonSelects(["examNameSelect"]);
    syncExamScoreInputState(els, state);
    refreshExamActionButton(els, state);
};

export const renderProfileData = (els, state) => {
    if (!Array.isArray(state.profile.exams)) state.profile.exams = [];
    if (els.examList) {
        const previousKeys = readRowKeys(els.examList);
        els.examList.innerHTML = state.profile.exams.map((ex, i) => {
            const value = formatExamValue(ex.exam, ex, { context: "profile", locale: getCurrentLanguage() });
            // The key lets a re-render animate only rows that are new or changed.
            const rowKey = JSON.stringify([ex.exam, value, ex.taken_on || ""]);
            return `
            <div class="profile-exam-item" data-row-key="${escapeHtmlAttr(rowKey)}">
                <div class="profile-exam-meta">
                    <span class="profile-exam-name">${escapeHtml(getExamDisplayName(ex.exam, { locale: getCurrentLanguage() }))}</span>
                    <span class="profile-exam-score">${escapeHtml([value, ex.taken_on].filter(Boolean).join(" · "))}</span>
                </div>
                <div class="profile-list-actions">
                    <button type="button" data-edit-idx="${i}" class="profile-button-subtle">${escapeHtml(t("profile.edit", "Edit"))}</button>
                    <button type="button" data-idx="${i}" class="profile-delete">${escapeHtml(t("profile.delete", "Delete"))}</button>
                </div>
            </div>
        `;
        }).join("");
        enterNewRows(els.examList, ".profile-exam-item", previousKeys);
    }
    refreshExamActionButton(els, state);
};

const showExamScoreError = (inputEl, message) => {
    setFieldInvalid(inputEl, true, message);
    inputEl?.focus();
    showToast(message, "error");
};

export const handleAddExam = async (els, state) => {
    if (!els.addExamBtn || !els.examNameSelect || state.examValidationPending) return;
    motionPress(els.addExamBtn);
    const name = canonicalizeExamId(els.examNameSelect.value);
    const takenOn = String(els.examTakenOnInput?.value || "").trim();
    const mode = getExamInputMode(name);
    if (mode === "subject_breakdown") {
        const invalid = [...els.examSpecialInputContainer.querySelectorAll("[data-breakdown-value]")]
            .find(input => input.validity && !input.validity.valid);
        if (invalid) {
            const exam = invalid.dataset.breakdownExamValue;
            const cfg = getExamConfig(exam);
            const detail = invalid.validity.rangeOverflow || invalid.validity.rangeUnderflow
                ? `Score must be between ${cfg.min} and ${cfg.max}`
                : invalid.validity.stepMismatch ? `step=${cfg.step}` : "invalid score format";
            showExamScoreError(invalid, formatExamValidationToast(exam, detail, getExamConfig));
            return;
        }
    }
    const selectedPayload = readSelectedExamPayload(name, els, state);
    const score = Number(selectedPayload?.score);
    const compositeUsesParentScore = mode === "subject_breakdown" && selectedPayload?.score !== undefined
        && (breakdownAllowsTotalOnly(name)
            || String(breakdownSchemeFor(name)?.total_strategy || "").trim().toLowerCase() === "use_parent_score");

    const cfg = getExamConfig(name);
    if (cfg) {
        const min = (cfg.min !== undefined) ? Number(cfg.min) : null;
        const max = (cfg.max !== undefined) ? Number(cfg.max) : null;
        const step = (cfg.step !== undefined) ? Number(cfg.step) : null;
        const usesNumberInput = mode === "number" || compositeUsesParentScore;

        if (usesNumberInput && Number.isFinite(min) && score < min) {
            showExamScoreError(els.examScoreInput, tFormat("profile.exam_score_min", { exam: name, min }, `Min for ${name} is ${min}`));
            return;
        }
        if (usesNumberInput && Number.isFinite(max) && score > max) {
            showExamScoreError(els.examScoreInput, tFormat("profile.exam_score_max", { exam: name, max }, `Max for ${name} is ${max}`));
            return;
        }

        if (usesNumberInput && Number.isFinite(step) && step > 0) {
            const base = Number.isFinite(min) ? min : 0;
            const k = (score - base) / step;
            const diff = Math.abs(k - Math.round(k));
            if (diff > 1e-9) {
                showExamScoreError(els.examScoreInput, tFormat("profile.exam_score_step", { exam: name, step }, `${name} score must use step ${step}`));
                return;
            }
        }
    }

    if (!name) {
        showToast(t("profile.exam_select_required", "Please select an exam"), "error");
        return;
    }
    if (hasPartialDateInput(els.examTakenOnInput)
        || (takenOn && (takenOn > new Date().toISOString().slice(0, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)))) {
        reportInvalidDate(els.examTakenOnInput);
        return;
    }
    if (!selectedPayload) {
        return;
    }
    if ((mode === "number" || compositeUsesParentScore) && Number.isNaN(score)) {
        showExamScoreError(els.examScoreInput, t("profile.exam_invalid_score", "Invalid score format"));
        return;
    }

    if ((mode === "number" || compositeUsesParentScore) && cfg?.type === "int" && !Number.isInteger(score)) {
        showExamScoreError(els.examScoreInput, tFormat("profile.exam_integer_required", { exam: name }, `${name} score must be an integer (e.g. 1400)`));
        return;
    }

    if ((mode === "number" || compositeUsesParentScore) && name === "IELTS" && (score % 0.5 !== 0)) {
        showExamScoreError(els.examScoreInput, t("profile.exam_ielts_step", "IELTS score must end with .0 or .5"));
        return;
    }

    const submittedDraftRevision = state.examDraftRevision;
    const submittedResetRevision = state.editorResetRevision;
    state.examValidationPending = true;
    els.addExamBtn.disabled = true;
    if (els.clearExamDraftBtn) els.clearExamDraftBtn.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/exams/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                exam: name,
                ...(takenOn ? { taken_on: takenOn } : {}),
                ...(selectedPayload.score !== undefined && Number.isFinite(Number(selectedPayload.score)) ? { score: selectedPayload.score } : {}),
                ...(selectedPayload.raw_value ? { raw_value: selectedPayload.raw_value } : {}),
                ...(selectedPayload.details ? { details: selectedPayload.details } : {}),
            }),
        });
        let json = {};
        try {
            json = await res.json();
        } catch {
            json = {};
        }
        if (!res.ok) {
            const rawDetail = json && (json.detail || json.message || json.error);
            const code = String(
                typeof rawDetail === "string" && rawDetail.trim()
                    ? rawDetail
                    : (Array.isArray(rawDetail) ? "validation_error" : `http_${res.status}`)
            )
                .trim()
                .replace(/\s+/g, "_")
                .slice(0, 64);
            const err = new Error("exam_validate_failed");
            err.code = code || "unknown";
            err.detail = rawDetail;
            throw err;
        }

        if (state.disposed || submittedResetRevision !== state.editorResetRevision) return;
        const examId = canonicalizeExamId(json.exam ?? json.id ?? name);
        const examLabel = getExamDisplayName(examId || name, { locale: getCurrentLanguage() });
        const savedValue = formatExamValue(examId || name, json, { context: "profile", locale: getCurrentLanguage() });
        if (!Array.isArray(state.profile.exams)) state.profile.exams = [];
        const existingIndex = state.profile.exams.findIndex((e) =>
            canonicalizeExamId(e.exam ?? e.id ?? "") === examId
            && String(e.taken_on || "") === takenOn
        );

        const examRecord = {
            exam: examId,
            ...(json.taken_on ? { taken_on: json.taken_on } : {}),
            score: json.score,
            ...(json.raw_value ? { raw_value: json.raw_value } : {}),
            ...(json.display_value ? { display_value: json.display_value } : {}),
            ...(json.details ? { details: json.details } : {}),
        };

        if (existingIndex !== -1) {
            state.profile.exams[existingIndex] = {
                ...state.profile.exams[existingIndex],
                ...examRecord,
            };
            showToast(
                (mode !== "number")
                    ? tFormat("profile.exam_updated_value", { exam: examLabel, value: savedValue || examLabel }, `Updated ${examLabel}: ${savedValue || examLabel}`)
                    : tFormat("profile.exam_updated", { exam: examLabel, score: json.score }, `Updated ${examLabel} to ${json.score}`),
                "success"
            );
        } else {
            state.profile.exams.push(examRecord);
            showToast(
                savedValue
                    ? tFormat("profile.exam_added_value", { exam: examLabel, value: savedValue }, `Added ${examLabel}: ${savedValue}`)
                    : tFormat("profile.exam_added", { exam: examLabel }, `Added ${examLabel}`),
                "success"
            );
        }

        state.profile = ensureProfileShape(state.profile);
        refreshSaveState(els, state);
        renderProfileData(els, state);

        if (state.examDraftRevision === submittedDraftRevision) {
            state.examEditorDirty = false;
            setFieldInvalid(els.examScoreInput, false);
            els.examScoreInput.value = "";
            if (els.examTakenOnInput) els.examTakenOnInput.value = "";
            els.examNameSelect.value = "";
            syncExamScoreInputState(els, state);
            initCommonSelects(["examNameSelect"]);
        }
        refreshExamActionButton(els, state);
        refreshSaveState(els, state);
    } catch (e) {
        if (!state.disposed && submittedResetRevision === state.editorResetRevision && state.examDraftRevision === submittedDraftRevision) {
            showExamScoreError(els.examScoreInput, formatExamValidationToast(name, e?.detail || e?.message || e?.code || e?.name || "", getExamConfig));
        }
    } finally {
        state.examValidationPending = false;
        els.addExamBtn.disabled = false;
        if (els.clearExamDraftBtn) els.clearExamDraftBtn.disabled = false;
    }
};

export const handleExamListClick = (e, els, state) => {
    const editBtn = e.target instanceof Element ? e.target.closest("button[data-edit-idx]") : null;
    if (editBtn) {
        motionPress(editBtn);
        const idx = Number(editBtn.dataset.editIdx);
        const entry = state.profile.exams?.[idx];
        if (!entry) return;
        state.examEditorDirty = false;
        els.examNameSelect.value = canonicalizeExamId(entry.exam ?? entry.id ?? "");
        if (els.examTakenOnInput) els.examTakenOnInput.value = String(entry.taken_on || "");
        if (els.examSpecialInputContainer) delete els.examSpecialInputContainer.dataset.breakdownExam;
        initCommonSelects(["examNameSelect"]);
        syncExamScoreInputState(els, state);
        refreshExamActionButton(els, state);
        els.examScoreInput?.focus();
        return;
    }
    const btn = e.target instanceof Element ? e.target.closest("button[data-idx]") : null;
    if (!btn) return;
    motionPress(btn);
    const idx = Number(btn.dataset.idx);
    if (!Number.isFinite(idx)) return;
    if (!Array.isArray(state.profile.exams)) state.profile.exams = [];

    const row = btn.closest(".profile-exam-item");
    // Resolve the entry now by identity, not by object or index: another row may be removed, and the
    // profile normalized (new exam objects), while this one collapses.
    const entry = state.profile.exams[idx];
    if (!entry || !row) return;
    const identity = profileExamIdentity(entry);
    setRevealed(row, false, { onHidden: () => {
        const at = state.profile.exams.findIndex((exam) => profileExamIdentity(exam) === identity);
        if (at < 0) return;
        state.profile.exams.splice(at, 1);
        state.profile = ensureProfileShape(state.profile);
        refreshSaveState(els, state);
        renderProfileData(els, state);
        showToast(t("profile.exam_removed", "Exam removed"), "success");
    } });
};
