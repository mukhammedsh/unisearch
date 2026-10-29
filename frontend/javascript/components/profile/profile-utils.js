import {
  canonicalizeExamId,
  getExamDisplayName,
  normalizeProfileData,
  showToast,
} from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { convert, getPreferredCurrency, niceStep } from "../../currency.js";

export const getBudgetCurrency = () => (typeof getPreferredCurrency === "function" ? getPreferredCurrency() : "USD") || "USD";

export const getMaxBudgetForCurrency = (currencyCode) => {
    const code = currencyCode || getBudgetCurrency();
    const converted = convert(1000000, "USD", code);
    return Math.max(1, Math.round(converted));
};

export const getLowBudgetGrantThreshold = (currencyCode) => {
    const code = currencyCode || getBudgetCurrency();
    const converted = convert(1000, "USD", code);
    return Math.max(1, Math.round(converted));
};

export const getBudgetPlaceholderValue = (currencyCode) => {
    const code = currencyCode || getBudgetCurrency();
    const converted = convert(20000, "USD", code);
    const step = niceStep(converted / 10);
    const rounded = Math.round(converted / step) * step;
    return Math.max(1, rounded);
};

export const normalizeFundingType = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    return (raw === "grant" || raw === "paid") ? raw : "any";
};

export const cloneProfile = (value) => JSON.parse(JSON.stringify(value && typeof value === "object" ? value : {}));

export const GPA_MAX_CHARS = 4;

export const normalizeGpaRaw = (value) => String(value ?? "").trim().replace(/,/g, ".");

export const normalizeAmountRaw = (value) => String(value ?? "").replace(/\s+/g, "");

export const enforceGpaMaxLength = (gpaInput) => {
    if (!gpaInput) return;
    const raw = String(gpaInput.value ?? "");
    const normalized = normalizeGpaRaw(raw);
    if (normalized.length > GPA_MAX_CHARS) {
        gpaInput.value = normalized.slice(0, GPA_MAX_CHARS);
    } else if (raw.includes(",")) {
        gpaInput.value = normalized;
    }
};

export const setFieldInvalid = (el, isInvalid = true, message = "") => {
    if (!el) return;
    const errorId = el.id ? `${el.id}Error` : "";
    const existingError = errorId ? document.getElementById(errorId) : null;
    const describedBy = String(el.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);

    if (isInvalid) {
        el.classList.add("is-invalid");
        el.setAttribute("aria-invalid", "true");
        if (errorId && message) {
            const error = existingError || document.createElement("p");
            error.id = errorId;
            error.className = "profile-field-error";
            error.setAttribute("role", "alert");
            error.textContent = message;
            if (!existingError) {
                const targetWrapper = el.closest(".profile-budget, .profile-exam-score-wrap, .lang-control-item") || el;
                targetWrapper.insertAdjacentElement("afterend", error);
            }
            if (!describedBy.includes(errorId)) {
                el.setAttribute("aria-describedby", [...describedBy, errorId].join(" "));
            }
        }
    } else {
        el.classList.remove("is-invalid");
        el.removeAttribute("aria-invalid");
        existingError?.remove();
        if (errorId && describedBy.includes(errorId)) {
            const remaining = describedBy.filter((id) => id !== errorId);
            if (remaining.length) el.setAttribute("aria-describedby", remaining.join(" "));
            else el.removeAttribute("aria-describedby");
        }
    }
};

export const reportInvalidDate = (input) => {
    input?.focus();
    showToast(t("profile.evidence.error.dates", "Check the dates for this evidence."), "error");
};

export const ensureProfileShape = (raw) => {
    return normalizeProfileData(raw);
};

export const stableProfileSignature = (raw) => {
    const p = ensureProfileShape(raw);
    const exams = (Array.isArray(p.exams) ? p.exams : [])
        .map((row) => {
            const exam = String(row?.exam || row?.id || "").trim();
            const score = Number(row?.score);
            const rawValue = String(row?.raw_value || row?.rawValue || "").trim();
            const displayValue = String(row?.display_value || row?.displayValue || "").trim();
            const details = row?.details && typeof row.details === "object" && !Array.isArray(row.details)
                ? row.details
                : null;
            if (!exam || (!Number.isFinite(score) && !rawValue && !details)) return null;
            const out = { exam: canonicalizeExamId(exam) };
            if (Number.isFinite(score)) out.score = score;
            if (rawValue) out.raw_value = rawValue;
            if (displayValue) out.display_value = displayValue;
            if (details) out.details = details;
            if (row?.taken_on) out.taken_on = String(row.taken_on);
            return out;
        })
        .filter(Boolean)
        .sort((a, b) => String(a.exam).localeCompare(String(b.exam)));

    const languages = (Array.isArray(p.languages) ? p.languages : [])
        .map((row) => {
            const code = String(row?.code || row?.lang || "").trim().toLowerCase();
            const kind = String(row?.kind || "").trim().toLowerCase();
            if (!code || !kind) return null;
            if (kind === "native") return { code, kind, taken_on: String(row?.taken_on || "") };
            if (kind === "cefr") {
                const level = Number(row?.level);
                if (!Number.isInteger(level)) return null;
                return { code, kind, level, taken_on: String(row?.taken_on || "") };
            }
            if (kind === "exam") {
                const exam = String(row?.exam || row?.examId || "").trim();
                const score = Number(row?.score);
                if (!exam || !Number.isFinite(score)) return null;
                return { code, kind, exam, score, taken_on: String(row?.taken_on || "") };
            }
            return null;
        })
        .filter(Boolean)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return JSON.stringify({
        budget: String(p.budget ?? "").trim(),
        budgetCurrency: String(p.budgetCurrency || "USD").toUpperCase(),
        familyIncomeAmount: String(p.familyIncomeAmount ?? "").trim(),
        familyIncomeCurrency: String(p.familyIncomeCurrency || "USD").toUpperCase(),
        gpa: String(p.gpa ?? "").trim(),
        gpaScale: Number(p.gpaScale) === 5 ? 5 : 4,
        major: String(p.major || "").trim(),
        interests: String(p.interests || "").trim(),
        studyMode: String(p.studyMode || "Any").trim() || "Any",
        fundingType: normalizeFundingType(p.fundingType),
        citizenships: (Array.isArray(p.citizenships) ? p.citizenships : []).map((c) => String(c || "").trim()).filter(Boolean),
        studyLevel: String(p.studyLevel || "Any").trim() || "Any",
        countryOfEducation: String(p.countryOfEducation || "").trim(),
        countryOfEducationOther: String(p.countryOfEducationOther || "").trim(),
        educationCredential: String(p.educationCredential || "").trim(),
        educationCredentialOther: String(p.educationCredentialOther || "").trim(),
        applicantRoute: String(p.applicantRoute || "").trim(),
        intendedEntryCycle: String(p.intendedEntryCycle || "").trim(),
        currentResidenceCountry: String(p.currentResidenceCountry || "").trim(),
        currentResidenceOther: String(p.currentResidenceOther || "").trim(),
        feeStatusContext: String(p.feeStatusContext || "unknown").trim() || "unknown",
        exams,
        languages,
        languageEvidence: Array.isArray(p.languageEvidence) ? p.languageEvidence : [],
        institutionalEvidence: Array.isArray(p.institutionalEvidence) ? p.institutionalEvidence : [],
    });
};

export const formatExamValidationToast = (examId, detailRaw, examConfigFor) => {
    const examLabel = getExamDisplayName(examId, { locale: getCurrentLanguage() });
    let detail = "";
    if (typeof detailRaw === "string") {
        detail = detailRaw.trim();
    } else if (Array.isArray(detailRaw) && detailRaw.length > 0) {
        const first = detailRaw[0];
        detail = String((typeof first === "object" && first !== null) ? (first.msg || first.message || first.detail || "") : first).trim();
    } else if (typeof detailRaw === "object" && detailRaw !== null) {
        detail = String(detailRaw.msg || detailRaw.message || detailRaw.detail || "").trim();
    }
    detail = detail.replace(/^Value error,\s*/i, "").trim();
    if (!detail) {
        return tFormat("profile.exam_error_generic", { exam: examLabel }, `Could not save ${examLabel}`);
    }

    const rangeMatch = detail.match(/Score must be between\s+([0-9.]+)\s+and\s+([0-9.]+)$/i);
    if (rangeMatch) {
        return tFormat(
            "profile.exam_error_range",
            { exam: examLabel, min: rangeMatch[1], max: rangeMatch[2] },
            `${examLabel} must be between ${rangeMatch[1]} and ${rangeMatch[2]}`
        );
    }

    const stepMatch = detail.match(/step=?([0-9.]+)/i);
    if (stepMatch) {
        return tFormat(
            "profile.exam_error_step",
            { exam: examLabel, step: stepMatch[1] },
            `${examLabel} must use step ${stepMatch[1]}`
        );
    }

    const subjectNameFrom = (rawValue) => {
        const normalized = canonicalizeExamId(rawValue);
        if (normalized && typeof examConfigFor === "function" && examConfigFor(normalized)) {
            return getExamDisplayName(normalized, { locale: getCurrentLanguage() });
        }
        return String(rawValue || "").trim();
    };

    const missingComponentPrefix = "requires component";
    const missingComponent = detail.toLowerCase().startsWith(missingComponentPrefix)
        ? detail.slice(missingComponentPrefix.length).trim()
        : "";
    if (missingComponent) {
        const subject = subjectNameFrom(missingComponent);
        return tFormat(
            "profile.exam_error_missing_subject",
            { exam: examLabel, subject },
            `Add ${subject} to ${examLabel}`
        );
    }

    const minSubjects = detail.match(/requires at least\s+(\d+)\s+selected subjects/i);
    if (minSubjects) {
        return tFormat(
            "profile.exam_error_too_few_subjects",
            { exam: examLabel, count: minSubjects[1] },
            `${examLabel} requires at least ${minSubjects[1]} subjects`
        );
    }

    const maxSubjects = detail.match(/supports at most\s+(\d+)\s+selected subjects/i);
    if (maxSubjects) {
        return tFormat(
            "profile.exam_error_too_many_subjects",
            { exam: examLabel, count: maxSubjects[1] },
            `${examLabel} supports at most ${maxSubjects[1]} subjects`
        );
    }

    const notAllowedPrefixes = ["does not support component", "does not support extra score"];
    const notAllowedPrefix = notAllowedPrefixes.find((prefix) => detail.toLowerCase().startsWith(prefix));
    const notAllowed = notAllowedPrefix ? detail.slice(notAllowedPrefix.length).trim() : "";
    if (notAllowed) {
        const subject = subjectNameFrom(notAllowed);
        return tFormat(
            "profile.exam_error_subject_not_allowed",
            { exam: examLabel, subject },
            `${subject} is not allowed for ${examLabel}`
        );
    }

    if (/requires at least one subject score/i.test(detail)) {
        return tFormat(
            "profile.exam_error_missing_subject",
            { exam: examLabel, subject: t("profile.exam_subject_placeholder", "subject") },
            `Add at least one subject for ${examLabel}`
        );
    }

    if (/invalid score format/i.test(detail)) {
        return t("profile.exam_invalid_score", "Invalid score format");
    }

    return tFormat(
        "profile.exam_error_detail",
        { exam: examLabel, reason: detail },
        `Could not save ${examLabel}: ${detail}`
    );
};
