import {
  canonicalizeExamId,
  escapeHtml,
  getExamConfig,
  getExamDisplayName,
  getExamInputMode,
  getExamLevelBands,
  showToast,
} from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";

export const parseAlevelGrades = (rawValue) => {
    const compact = String(rawValue || "")
        .trim()
        .toUpperCase()
        .replaceAll(" ", "")
        .replaceAll("★", "*")
        .replaceAll("в˜…", "*")
        .replace(/[,;/|+\-]+/g, "");
    if (!compact) return [];
    const tokens = compact.match(/A\*|[ABCDEU]/g) || [];
    return tokens.join("") === compact ? tokens : [];
};

export const breakdownSchemeFor = (examId) => {
    const scheme = getExamConfig(examId)?.breakdown_scheme;
    return scheme && typeof scheme === "object" && !Array.isArray(scheme) ? scheme : {};
};

export const normalizeBreakdownDefinitions = (items, { defaultRequired = false } = {}) => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            if (typeof item === "string") {
                const exam = canonicalizeExamId(item);
                if (!exam) return null;
                return { exam, label: getExamDisplayName(exam, { locale: getCurrentLanguage() }), required: defaultRequired };
            }
            if (!item || typeof item !== "object") return null;
            const exam = canonicalizeExamId(item.exam || item.id || item.exam_id || "");
            if (!exam) return null;
            return {
                exam,
                label: String(getExamDisplayName(exam, { locale: getCurrentLanguage() }) || item.label || exam).trim(),
                required: item.required === undefined ? defaultRequired : !!item.required,
            };
        })
        .filter(Boolean);
};

export const normalizeBreakdownRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => {
            if (!row || typeof row !== "object") return null;
            const exam = canonicalizeExamId(row.exam || row.id || row.exam_id || "");
            if (!exam) return null;
            const rawValue = String(row.raw_value || row.rawValue || row.display_value || row.displayValue || "").trim();
            const details = row.details && typeof row.details === "object" && !Array.isArray(row.details)
                ? JSON.parse(JSON.stringify(row.details))
                : null;
            const score = row?.score === null || row?.score === undefined || row?.score === ""
                ? null
                : Number(row.score);
            return {
                exam,
                score: Number.isFinite(score) ? score : null,
                raw_value: rawValue,
                details,
            };
        })
        .filter(Boolean);
};

export const buildBreakdownState = (examId, source = null) => {
    const scheme = breakdownSchemeFor(examId);
    const fixed = normalizeBreakdownDefinitions(scheme.fixed_components, { defaultRequired: true });
    const selectable = normalizeBreakdownDefinitions(scheme.selectable_components, { defaultRequired: false });
    const extraScores = normalizeBreakdownDefinitions(scheme.extra_scores, { defaultRequired: false });
    const scoreValue = Number(source?.score);
    return {
        totalScore: Number.isFinite(scoreValue) ? scoreValue : null,
        components: normalizeBreakdownRows(source?.details?.components),
        extraScores: normalizeBreakdownRows(source?.details?.extra_scores),
        fixed,
        selectable,
        extraDefinitions: extraScores,
    };
};

export const gradeOptionsForExam = (examId) => {
    const gradeScheme = getExamConfig(examId)?.grade_scheme || {};
    return Array.isArray(gradeScheme.grades) && gradeScheme.grades.length
        ? gradeScheme.grades
        : ["A*", "A", "B", "C", "D", "E", "U"];
};

export const renderBreakdownValueControl = ({ parentExamId, examId, slotKey, valueState, isExtra = false }) => {
    const cfg = getExamConfig(examId);
    const mode = getExamInputMode(examId);
    const rawValue = String(valueState?.raw_value || "").trim();
    const numericScore = Number(valueState?.score);
    const valueText = Number.isFinite(numericScore) ? String(numericScore) : rawValue;
    const dataAttrs = `data-breakdown-slot="${escapeHtml(slotKey)}" data-breakdown-parent="${escapeHtml(parentExamId)}"`;

    if (mode === "band_select") {
        const bands = getExamLevelBands(examId);
        return `
            <select class="profile-input profile-input--select" ${dataAttrs} data-breakdown-value="band">
                <option value="" ${rawValue ? "" : "selected"}>${escapeHtml(t("profile.exam_band_placeholder", "Select level"))}</option>
                ${bands.map((band) => {
                    const shortLabel = String(band?.short_label || "").trim();
                    const selected = shortLabel && shortLabel === rawValue ? "selected" : "";
                    return `<option value="${escapeHtml(shortLabel)}" ${selected}>${escapeHtml(shortLabel)}</option>`;
                }).join("")}
            </select>
        `;
    }

    if (mode === "grade_combo") {
        const selectedGrade = String(
            valueState?.details?.grades?.[0]
            || rawValue
            || ""
        ).trim();
        const gradeOptions = gradeOptionsForExam(examId);
        return `
            <select class="profile-input profile-input--select" ${dataAttrs} data-breakdown-value="grade">
                <option value="" ${selectedGrade ? "" : "selected"}>${escapeHtml(t("profile.exam_grade_placeholder", "Select grade"))}</option>
                ${gradeOptions.map((grade) => {
                    const selected = selectedGrade === grade ? "selected" : "";
                    return `<option value="${escapeHtml(grade)}" ${selected}>${escapeHtml(grade)}</option>`;
                }).join("")}
            </select>
        `;
    }

    if (mode === "flag") {
        const rawFlag = valueState?.score;
        const normalizedFlag = rawFlag === 0 ? "0" : (rawFlag === 1 ? "1" : "");
        return `
            <select class="profile-input profile-input--select" ${dataAttrs} data-breakdown-value="flag">
                <option value="" ${normalizedFlag ? "" : "selected"}>${escapeHtml(t("profile.exam_status_placeholder", "Select status"))}</option>
                <option value="1" ${normalizedFlag === "1" ? "selected" : ""}>${escapeHtml(t("profile.exam_status_pass", "Pass"))}</option>
                <option value="0" ${normalizedFlag === "0" ? "selected" : ""}>${escapeHtml(t("profile.exam_status_fail", "Not passed"))}</option>
            </select>
        `;
    }

    const min = cfg?.min !== undefined ? `min="${escapeHtml(String(cfg.min))}"` : "";
    const max = cfg?.max !== undefined ? `max="${escapeHtml(String(cfg.max))}"` : "";
    const step = cfg?.step !== undefined ? `step="${escapeHtml(String(cfg.step))}"` : `step="${isExtra ? "0.01" : "1"}"`;
    const placeholder = isExtra
        ? t("profile.placeholder.score", "Score")
        : t("profile.placeholder.score", "Score");
    return `
        <input
            type="number"
            class="profile-input"
            value="${escapeHtml(valueText)}"
            placeholder="${escapeHtml(placeholder)}"
            ${min}
            ${max}
            ${step}
            ${dataAttrs}
            data-breakdown-value="number"
        >
    `;
};

export const readBreakdownFieldPayload = (container, examId) => {
    const mode = getExamInputMode(examId);
    if (!container) return null;

    if (mode === "band_select") {
        const raw = String(container.querySelector("[data-breakdown-value='band']")?.value || "").trim();
        if (!raw) return null;
        return { raw_value: raw };
    }

    if (mode === "grade_combo") {
        const raw = String(container.querySelector("[data-breakdown-value='grade']")?.value || "").trim();
        if (!raw) return null;
        return { raw_value: raw };
    }

    if (mode === "flag") {
        const raw = String(container.querySelector("[data-breakdown-value='flag']")?.value || "").trim();
        if (raw !== "0" && raw !== "1") return null;
        return { score: raw === "1" ? 1 : 0 };
    }

    const raw = String(container.querySelector("[data-breakdown-value='number']")?.value || "").trim();
    if (!raw) return null;
    const score = Number(raw);
    if (!Number.isFinite(score)) return { invalid: true, raw };
    return { score, raw_input_score: raw };
};

export function readSubjectBreakdownDraft(examId, container, options = {}) {
    const selected = canonicalizeExamId(examId);
    const silent = options?.silent === true;
    const findExistingExamEntry = typeof options?.findExistingExamEntry === "function"
        ? options.findExistingExamEntry
        : () => null;
    const fallbackState = buildBreakdownState(selected, findExistingExamEntry(selected));
    if (!container || container.dataset?.breakdownExam !== selected) {
        return fallbackState;
    }

    const state = {
        ...fallbackState,
        totalScore: fallbackState.totalScore,
        components: [],
        extraScores: [],
    };

    const fixedRows = Array.from(container.querySelectorAll("[data-breakdown-fixed-row]"));
    for (const row of fixedRows) {
        const exam = canonicalizeExamId(row.getAttribute("data-breakdown-exam"));
        const payload = readBreakdownFieldPayload(row, exam);
        if (!payload) {
            if (silent) {
                state.components.push({ exam, score: null });
                continue;
            }
            const label = String(row.getAttribute("data-breakdown-label") || getExamDisplayName(exam, { locale: getCurrentLanguage() })).trim();
            if (!silent) showToast(tFormat("profile.exam_component_required", { subject: label }, `Enter a score for ${label}`), "error");
            return null;
        }
        if (payload.invalid) {
            if (!silent) showToast(t("profile.exam_invalid_score", "Invalid score format"), "error");
            return null;
        }
        state.components.push({
            exam,
            ...(payload.score !== undefined ? { score: payload.score } : {}),
            ...(payload.raw_value ? { raw_value: payload.raw_value } : {}),
            ...(payload.details ? { details: payload.details } : {}),
        });
    }

    const selectableRows = Array.from(container.querySelectorAll("[data-breakdown-selectable-row]"));
    for (const row of selectableRows) {
        const exam = canonicalizeExamId(row.querySelector("[data-breakdown-subject-select]")?.value || "");
        if (!exam) continue;
        const payload = readBreakdownFieldPayload(row, exam);
        if (!payload) {
            if (silent) {
                state.components.push({ exam, score: null });
                continue;
            }
            const label = getExamDisplayName(exam, { locale: getCurrentLanguage() });
            if (!silent) showToast(tFormat("profile.exam_component_required", { subject: label }, `Enter a score for ${label}`), "error");
            return null;
        }
        if (payload.invalid) {
            if (!silent) showToast(t("profile.exam_invalid_score", "Invalid score format"), "error");
            return null;
        }
        state.components.push({
            exam,
            ...(payload.score !== undefined ? { score: payload.score } : {}),
            ...(payload.raw_value ? { raw_value: payload.raw_value } : {}),
            ...(payload.details ? { details: payload.details } : {}),
        });
    }

    const extraRows = Array.from(container.querySelectorAll("[data-breakdown-extra-row]"));
    for (const row of extraRows) {
        const exam = canonicalizeExamId(row.getAttribute("data-breakdown-exam"));
        const payload = readBreakdownFieldPayload(row, exam);
        if (!payload) continue;
        if (payload.invalid) {
            if (!silent) showToast(t("profile.exam_invalid_score", "Invalid score format"), "error");
            return null;
        }
        state.extraScores.push({
            exam,
            ...(payload.score !== undefined ? { score: payload.score } : {}),
            ...(payload.raw_value ? { raw_value: payload.raw_value } : {}),
            ...(payload.details ? { details: payload.details } : {}),
        });
    }

    return state;
}

export function renderSpecialExamInput(examId, container, { findExistingExamEntry = () => null } = {}) {
    if (!container) return false;

    const cfg = getExamConfig(examId);
    const mode = getExamInputMode(examId);
    const existing = findExistingExamEntry(examId);
    if (mode !== "subject_breakdown") delete container.dataset.breakdownExam;

    if (mode === "band_select") {
        const selectedBand = String(
            existing?.raw_value
            || existing?.rawValue
            || existing?.display_value
            || existing?.displayValue
            || ""
        ).trim();
        const bands = getExamLevelBands(examId);
        container.innerHTML = `
            <div class="profile-exam-special-field profile-exam-special-field--inline">
                <span class="mini-label mini-label--hidden">${escapeHtml(t("profile.exam_band_label", "Level"))}</span>
                <select id="examBandSelect" class="profile-input profile-input--select">
                    <option value="" disabled ${selectedBand ? "" : "selected"}>${escapeHtml(t("profile.exam_band_placeholder", "Select level"))}</option>
                    ${bands.map((band) => {
                        const shortLabel = String(band?.short_label || "").trim();
                        const selected = shortLabel && shortLabel === selectedBand ? "selected" : "";
                        return `<option value="${escapeHtml(shortLabel)}" ${selected}>${escapeHtml(shortLabel)}</option>`;
                    }).join("")}
                </select>
            </div>
        `;
        return true;
    }

    if (mode === "grade_combo") {
        const gradeScheme = cfg?.grade_scheme || {};
        const minCount = Math.max(1, Number(gradeScheme?.subject_count_min) || 3);
        const maxCount = Math.max(minCount, Number(gradeScheme?.subject_count_max) || minCount);
        const bestOf = Math.max(1, Number(gradeScheme?.best_of) || minCount);
        const gradeOptions = Array.isArray(gradeScheme?.grades) && gradeScheme.grades.length
            ? gradeScheme.grades
            : ["A*", "A", "B", "C", "D", "E", "U"];
        const existingGrades = Array.isArray(existing?.details?.grades) && existing.details.grades.length
            ? existing.details.grades.map((grade) => String(grade || "").trim())
            : parseAlevelGrades(existing?.raw_value || existing?.rawValue || existing?.display_value || existing?.displayValue || "");

        container.innerHTML = `
            <div class="profile-exam-special-grid profile-exam-special-grid--grades">
                ${Array.from({ length: maxCount }).map((_, idx) => {
                    const selectedGrade = String(existingGrades[idx] || "").trim();
                    const isOptional = idx >= minCount;
                    const label = isOptional
                        ? t("profile.exam_grade_optional", "Optional 4th subject")
                        : tFormat("profile.exam_grade_slot", { index: idx + 1 }, `Subject ${idx + 1}`);
                    return `
                        <div class="profile-exam-special-field">
                            <span class="mini-label">${escapeHtml(label)}</span>
                            <select class="profile-input profile-input--select" data-grade-slot="${idx}">
                                <option value="" ${selectedGrade ? "" : "selected"}>${escapeHtml(t("profile.exam_grade_placeholder", "Select grade"))}</option>
                                ${gradeOptions.map((grade) => {
                                    const selected = selectedGrade === grade ? "selected" : "";
                                    return `<option value="${escapeHtml(grade)}" ${selected}>${escapeHtml(grade)}</option>`;
                                }).join("")}
                            </select>
                        </div>
                    `;
                }).join("")}
                <div class="profile-exam-special-hint">${escapeHtml(
                    tFormat(
                        "profile.exam_alevel_hint",
                        { min: minCount, max: maxCount, best: bestOf },
                        `Enter ${minCount}-${maxCount} grades. UniSearch uses your best ${bestOf} grades.`
                    )
                )}</div>
            </div>
        `;
        return true;
    }

    if (mode === "subject_breakdown") {
        const selected = canonicalizeExamId(examId);
        const isCurrent = container?.dataset?.breakdownExam === selected;
        const liveState = isCurrent ? readSubjectBreakdownDraft(selected, container, { silent: true, findExistingExamEntry }) : null;
        const state = liveState || buildBreakdownState(selected, findExistingExamEntry(selected));
        const scheme = breakdownSchemeFor(examId);
        const selectableMax = Math.max(0, Number(scheme?.selectable_count_max) || state.selectable.length || 0);
        const selectableMin = Math.max(0, Number(scheme?.selectable_count_min) || 0);
        const usedSelectable = state.components.filter((row) =>
            state.selectable.some((item) => item.exam === row.exam)
        );
        const extraScores = state.extraDefinitions.map((def) => {
            const existingRow = state.extraScores.find((row) => row.exam === def.exam) || null;
            return { ...def, row: existingRow };
        });

        const selectableRows = Array.from({ length: selectableMax }).map((_, idx) => {
            const current = usedSelectable[idx] || null;
            const selectedExam = canonicalizeExamId(current?.exam || "");
            const optionList = state.selectable.filter((item) =>
                !item.exam || item.exam === selectedExam || !usedSelectable.some((row, rowIdx) => rowIdx !== idx && row.exam === item.exam)
            );
            const rowExam = selectedExam || "";
            const label = idx < selectableMin
                ? tFormat("profile.exam_subject_slot", { index: idx + 1 }, `Subject ${idx + 1}`)
                : tFormat("profile.exam_subject_optional_slot", { index: idx + 1 }, `Optional subject ${idx + 1}`);
            return `
                <div class="profile-exam-breakdown-row" data-breakdown-selectable-row="${idx}">
                    <div class="profile-exam-breakdown-subject">
                        <span class="mini-label">${escapeHtml(label)}</span>
                        <select class="profile-input profile-input--select" data-breakdown-subject-select="${idx}">
                            <option value="" ${selectedExam ? "" : "selected"}>${escapeHtml(t("profile.exam_subject_placeholder", "Select subject"))}</option>
                            ${optionList.map((item) => {
                                const selected = item.exam === selectedExam ? "selected" : "";
                                return `<option value="${escapeHtml(item.exam)}" ${selected}>${escapeHtml(item.label)}</option>`;
                            }).join("")}
                        </select>
                    </div>
                    <div class="profile-exam-breakdown-score">
                        <span class="mini-label">${escapeHtml(t("profile.placeholder.score", "Score"))}</span>
                        ${rowExam
                            ? renderBreakdownValueControl({ parentExamId: examId, examId: rowExam, slotKey: `selectable-${idx}`, valueState: current })
                            : `<div class="profile-exam-breakdown-empty">${escapeHtml(t("profile.exam_subject_choose_first", "Choose a subject first"))}</div>`}
                    </div>
                </div>
            `;
        }).join("");

        container.dataset.breakdownExam = canonicalizeExamId(examId);
        container.innerHTML = `
            <div class="profile-exam-special-grid profile-exam-special-grid--breakdown">
                ${state.fixed.map((item) => {
                    const current = state.components.find((row) => row.exam === item.exam) || null;
                    return `
                        <div class="profile-exam-breakdown-row" data-breakdown-fixed-row="${escapeHtml(item.exam)}" data-breakdown-exam="${escapeHtml(item.exam)}" data-breakdown-label="${escapeHtml(item.label)}">
                            <div class="profile-exam-breakdown-subject">
                                <span class="mini-label">${escapeHtml(item.label)}</span>
                                <div class="profile-exam-breakdown-chip">${escapeHtml(item.label)}</div>
                            </div>
                            <div class="profile-exam-breakdown-score">
                                <span class="mini-label">${escapeHtml(t("profile.placeholder.score", "Score"))}</span>
                                ${renderBreakdownValueControl({ parentExamId: examId, examId: item.exam, slotKey: `fixed-${item.exam}`, valueState: current })}
                            </div>
                        </div>
                    `;
                }).join("")}
                ${selectableRows}
                ${extraScores.map((item) => `
                    <div class="profile-exam-breakdown-row" data-breakdown-extra-row="${escapeHtml(item.exam)}" data-breakdown-exam="${escapeHtml(item.exam)}">
                        <div class="profile-exam-breakdown-subject">
                            <span class="mini-label">${escapeHtml(item.label)}</span>
                            <div class="profile-exam-breakdown-chip">${escapeHtml(item.label)}</div>
                        </div>
                        <div class="profile-exam-breakdown-score">
                            <span class="mini-label">${escapeHtml(t("profile.placeholder.score", "Score"))}</span>
                            ${renderBreakdownValueControl({ parentExamId: examId, examId: item.exam, slotKey: `extra-${item.exam}`, valueState: item.row, isExtra: true })}
                        </div>
                    </div>
                `).join("")}
                <div class="profile-exam-special-hint">${escapeHtml(
                    tFormat(
                        "profile.exam_breakdown_hint",
                        { min: selectableMin, max: selectableMax || 0 },
                        selectableMax
                            ? `Enter scores by subject. Required subjects stay fixed, and you can choose ${selectableMin}-${selectableMax} extra subjects where needed.`
                            : "Enter scores by subject."
                    )
                )}</div>
            </div>
        `;
        return true;
    }

    container.innerHTML = "";
    return false;
}
