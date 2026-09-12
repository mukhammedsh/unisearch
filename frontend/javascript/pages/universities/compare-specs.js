/* frontend/javascript/pages/universities/compare-specs.js */

import {
  escapeHtml,
  escapeHtmlAttr,
  moneyUSD,
  getExamDisplayName,
  canonicalizeExamId,
  formatExamValue,
} from "../../utils.js";

import {
  formatUiNumber,
  toFiniteNumber,
  renderInlineIcon,
  trTrackDescription,
} from "../_shared.js";

import {
  translateWord,
  humanizeMachineLabel,
} from "../../university-translations.js";

import { getTrackFundingType } from "../../university-detail-helpers.js";
import { t, tFormat } from "../../i18n.js";

import {
  compareUniversityName,
  compareLocationText,
  compareRankText,
  compareAidText,
  compareAidPolicyText,
  comparePublishedAdmission,
  compareProgramSummary,
  compareProgramTitle,
  compareStudyModeText,
  compareUndergraduateStructureText,
  compareAdmissionOptionEntries,
  compareSelectedAdmissionEntry,
  compareSelectedAdmissionOption,
  compareSelectedAnnualCost,
  compareSelectedCostContext,
  compareCostContextText,
  compareTrackLabel,
  compareFundingChoiceText,
  compareRequirementsText,
  compareAverageScoreText,
  compareLanguageProofText,
  compareExtraRequirementsText,
  compareSourceMeta,
  compareDataConfidenceText,
  compareCountText,
  comparePercentText,
  compareScoreText,
  compareCampusAreaText,
  compareBachelorProgramCount,
  compareLanguageCount,
  compareStudyFormatCount,
  compareMajorTagCount,
  compareAidScore,
  compareCostBreakdownText,
  formatCompareCostRange,
} from "./compare-helpers.js";

export const compareSlotLabel = (index) => tFormat(
  "universities.compare.pair_slot",
  { number: String(index + 1) },
  `University ${index + 1}`
);

export const compareOptionFundingDeltaPreview = (entry, entries) => {
    const option = entry?.option || {};
    if (getTrackFundingType(option) !== "grant") return "";
    const sameRoute = (candidate) => (
        String(candidate?.option?.category_id || "") === String(option?.category_id || "")
        && String(candidate?.option?.requirement_profile_id || "") === String(option?.requirement_profile_id || "")
    );
    const paidBaseline = (Array.isArray(entries) ? entries : [])
        .find((candidate) => candidate?.key !== entry?.key && sameRoute(candidate) && getTrackFundingType(candidate.option) === "paid");
    const baseline = (paidBaseline?.option?.requirements && typeof paidBaseline.option.requirements === "object")
        ? paidBaseline.option.requirements
        : ((option?.base_requirements && typeof option.base_requirements === "object") ? option.base_requirements : {});
    const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
    const fundingReq = (option?.funding_requirements && typeof option.funding_requirements === "object") ? option.funding_requirements : {};
    const keys = Object.keys(req).filter((key) => {
        if (Object.prototype.hasOwnProperty.call(fundingReq, key)) return true;
        return baseline[key] !== undefined && String(baseline[key]) !== String(req[key]);
    });
    const rows = keys
        .filter((key) => req[key] !== null && req[key] !== undefined && req[key] !== "")
        .map((key) => {
            const baseValue = baseline[key];
            const currentVal = formatExamValue(key, req[key]);
            const current = `${getExamDisplayName(key)} ${currentVal}`;
            const formattedBase = formatExamValue(key, baseValue);
            return baseValue !== null && baseValue !== undefined && baseValue !== "" && String(baseValue) !== String(req[key])
                ? tFormat(
                    "universities.compare.configure.funding_delta_from",
                    { value: current, base: formattedBase },
                    `${current} (standard ${formattedBase})`
                )
                : current;
        });
    return rows.length
        ? rows.slice(0, 3).join(", ")
        : t("universities.compare.configure.no_funding_delta", "No separate funding-specific score cutoff in the data");
};

export const compareFundingRequirementsText = (u) => {
    const entry = compareSelectedAdmissionEntry(u);
    if (!entry) return t("common.na", "N/A");
    const entries = compareAdmissionOptionEntries(u);
    const delta = compareOptionFundingDeltaPreview(entry, entries);
    if (delta) return delta;

    const option = entry.option || {};
    const fundingProgram = String(option?.funding_program || "").trim();
    const fundingSource = String(option?.funding_source || "").trim();
    const parts = [];
    if (fundingProgram) parts.push(trTrackDescription(String(u?.id || ""), option.id, fundingProgram));
    if (fundingSource) parts.push(trTrackDescription(String(u?.id || ""), option.id, fundingSource));
    return parts.length ? parts.join(" - ") : t("common.na", "N/A");
};



export const compareTrackRequirementValues = (u, examId) => {
    const option = compareSelectedAdmissionOption(u);
    const values = [];
    const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
    Object.entries(req || {}).forEach(([key, value]) => {
        if (canonicalizeExamId(key) !== canonicalizeExamId(examId)) return;
        const n = toFiniteNumber(value);
        if (n !== null) values.push(n);
    });
    return values;
};

export const compareSelectedRequirementKeys = (u) => {
    const option = compareSelectedAdmissionOption(u);
    const req = (option?.requirements && typeof option.requirements === "object") ? option.requirements : {};
    return Object.keys(req).filter((key) => compareRequirementValue(u, key) !== null);
};

export const compareSelectedAverageKeys = (u) => {
    const option = compareSelectedAdmissionOption(u);
    const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
    const keys = Object.keys(stats).filter((key) => compareAverageScoreValue(u, key) !== null);
    const scoreProfile = (option?.score_profile && typeof option.score_profile === "object") ? option.score_profile : null;
    const profileExam = String(scoreProfile?.exam_id || "").trim();
    if (profileExam && compareAverageScoreValue(u, profileExam) !== null) keys.push(profileExam);
    return Array.from(new Set(keys));
};

export const compareSelectedLanguageRequirementKeys = (u) => {
    const option = compareSelectedAdmissionOption(u);
    const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
    const keys = [];
    requirements.forEach((entry) => {
        const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
        Object.keys(req).forEach((key) => {
            if (compareLanguageRequirementValue(u, key) !== null) keys.push(key);
        });
    });
    return keys;
};

export const compareRequirementValue = (u, examId) => {
    const values = compareTrackRequirementValues(u, examId);
    return values.length ? Math.min(...values) : null;
};

export const compareAverageScoreValue = (u, examId) => {
    const option = compareSelectedAdmissionOption(u);
    const stats = (option?.stats_avg && typeof option.stats_avg === "object") ? option.stats_avg : {};
    const values = [];
    Object.entries(stats).forEach(([key, value]) => {
        if (canonicalizeExamId(key) !== canonicalizeExamId(examId)) return;
        const n = toFiniteNumber(value);
        if (n !== null) values.push(n);
    });
    if (values.length) return Math.max(...values);
    const scoreProfile = (option?.score_profile && typeof option.score_profile === "object") ? option.score_profile : null;
    const compatible = Array.isArray(scoreProfile?.compatible_exam_ids) ? scoreProfile.compatible_exam_ids : [];
    const profileExams = [scoreProfile?.exam_id, ...compatible].map(canonicalizeExamId).filter(Boolean);
    if (profileExams.includes(canonicalizeExamId(examId))) {
        return toFiniteNumber(scoreProfile?.median_raw ?? scoreProfile?.median_normalized);
    }
    return null;
};

export const compareLanguageRequirementValue = (u, examId) => {
    const option = compareSelectedAdmissionOption(u);
    const requirements = Array.isArray(option?.language_requirements) ? option.language_requirements : [];
    const values = [];
    requirements.forEach((entry) => {
        const req = (entry?.requirements && typeof entry.requirements === "object") ? entry.requirements : {};
        Object.entries(req).forEach(([key, value]) => {
            if (canonicalizeExamId(key) !== canonicalizeExamId(examId)) return;
            const n = toFiniteNumber(value);
            if (n !== null) values.push(n);
        });
    });
    return values.length ? Math.min(...values) : null;
};

export const collectCompareExamKeys = (universities, getter) => {
    const byKey = new Map();
    universities.forEach((u) => {
        const entries = getter(u);
        const seen = new Set();
        entries.forEach((key) => {
            const clean = canonicalizeExamId(key);
            if (!clean || seen.has(clean)) return;
            seen.add(clean);
            byKey.set(clean, (byKey.get(clean) || 0) + 1);
        });
    });
    return Array.from(byKey.entries())
        .map(([key]) => key)
        .slice(0, 8);
};

export const compareSpecSections = () => ({
    overview: t("universities.compare.section.overview", "Overview"),
    programs: t("universities.compare.section.programs", "Programs"),
    admissions: t("universities.compare.section.admissions", "Admissions"),
    finance: t("universities.compare.section.finance", "Finance"),
    outcomes: t("universities.compare.section.outcomes", "Outcomes"),
    data: t("universities.compare.section.data", "Data confidence"),
    context: t("universities.compare.section.context", "Context"),
});

export const buildCompareSpecs = (universities) => {
    const specs = [
        {
            key: "location",
            section: "overview",
            category: "context",
            label: t("universities.compare.row.location", "Location"),
            type: "text",
            direction: "neutral",
            getter: compareLocationText,
        },
        {
            key: "rank",
            section: "overview",
            category: "prestige",
            label: translateWord("global_rank", "Global Rank"),
            type: "number",
            direction: "neutral",
            getter: (u) => {
                const rank = toFiniteNumber(u?.rank);
                return rank !== null && rank > 0 ? rank : null;
            },
            formatter: (value) => `#${formatUiNumber(value, { maximumFractionDigits: 0 })}`,
            sourceKey: "rank",
            score: false,
            reason: false,
        },
        {
            key: "student_count",
            section: "overview",
            category: "context",
            label: t("universities.compare.row.student_count", "Students"),
            type: "number",
            direction: "neutral",
            getter: (u) => toFiniteNumber(u?.student_count),
            formatter: compareCountText,
            sourceKey: "student_count",
            score: false,
            reason: false,
        },
        {
            key: "program_count",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.program_count", "Bachelor programs"),
            type: "number",
            direction: "neutral",
            getter: compareBachelorProgramCount,
            formatter: compareCountText,
            reason: false,
        },
        {
            key: "major_tags",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.major_tags", "Academic fields"),
            type: "number",
            direction: "neutral",
            getter: compareMajorTagCount,
            formatter: compareCountText,
            reason: false,
        },
        {
            key: "study_formats",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.study_formats", "Study formats"),
            type: "number",
            direction: "neutral",
            getter: compareStudyFormatCount,
            formatter: compareCountText,
            reason: false,
        },
        {
            key: "program_languages",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.language", "Program language"),
            type: "number",
            direction: "neutral",
            getter: compareLanguageCount,
            formatter: compareCountText,
            reason: false,
        },
        {
            key: "programs",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.programs", "Programs shown"),
            type: "text",
            direction: "neutral",
            getter: compareProgramSummary,
            titleGetter: compareProgramTitle,
            score: false,
            reason: false,
        },
        {
            key: "study_mode",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.study_mode", "Study mode"),
            type: "text",
            direction: "neutral",
            getter: compareStudyModeText,
            score: false,
            reason: false,
        },
        {
            key: "undergraduate_structure",
            section: "programs",
            category: "academics",
            label: t("universities.compare.row.undergraduate_structure", "Undergraduate structure"),
            type: "text",
            direction: "neutral",
            getter: compareUndergraduateStructureText,
            score: false,
            reason: false,
        },
        {
            key: "acceptance",
            section: "admissions",
            category: "admissions",
            label: t("universities.compare.row.published_selectivity", "Published admission rate"),
            type: "number",
            direction: "neutral",
            getter: (u) => comparePublishedAdmission(u).value,
            formatter: comparePercentText,
            sourceGetter: comparePublishedAdmission,
            score: false,
            reason: false,
        },
        {
            key: "selected_route",
            section: "admissions",
            category: "admissions",
            label: t("universities.compare.row.selected_route", "Selected route"),
            type: "text",
            direction: "neutral",
            getter: compareTrackLabel,
            score: false,
            reason: false,
        },
        {
            key: "funding_choice",
            section: "admissions",
            category: "finance",
            label: t("universities.compare.row.funding_choice", "Selected funding"),
            type: "text",
            direction: "neutral",
            getter: compareFundingChoiceText,
            score: false,
            reason: false,
        },
        {
            key: "requirements",
            section: "admissions",
            category: "admissions",
            label: t("universities.compare.row.academic_minimums", "Academic minimums"),
            type: "text",
            direction: "neutral",
            getter: compareRequirementsText,
            score: false,
            reason: false,
        },
        {
            key: "avg_scores",
            section: "admissions",
            category: "prestige",
            label: t("universities.compare.row.avg_scores", "Admitted score context"),
            type: "text",
            direction: "neutral",
            getter: compareAverageScoreText,
            score: false,
            reason: false,
        },
        {
            key: "funding_requirements",
            section: "admissions",
            category: "finance",
            label: t("universities.compare.row.funding_requirements", "Funding-specific requirements"),
            type: "text",
            direction: "neutral",
            getter: compareFundingRequirementsText,
            score: false,
            reason: false,
        },
        {
            key: "language_proof",
            section: "admissions",
            category: "admissions",
            label: t("universities.compare.row.language_proof", "Language proof"),
            type: "text",
            direction: "neutral",
            getter: compareLanguageProofText,
            score: false,
            reason: false,
        },
        {
            key: "extra_requirements",
            section: "admissions",
            category: "admissions",
            label: t("universities.compare.row.application_materials", "Documents / interview / portfolio"),
            type: "text",
            direction: "neutral",
            getter: compareExtraRequirementsText,
            score: false,
            reason: false,
        },
        {
            key: "total_cost",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.total_cost", "Total / year"),
            type: "number",
            direction: "lower",
            getter: compareSelectedAnnualCost,
            formatter: (_value, u) => formatCompareCostRange(compareSelectedCostContext(u)),
            sourceGetter: compareSelectedCostContext,
            materiality: 0.1,
            comparable: (rows) => compareCostContextsComparable(
                rows.map((row) => compareSelectedCostContext(row.university))
            ),
        },
        {
            key: "tuition_fees",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.tuition_fees", "Tuition + fees"),
            type: "text",
            direction: "neutral",
            getter: (u) => compareCostBreakdownText(u, "tuition"),
        },
        {
            key: "living_costs",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.living_costs", "Living cost items"),
            type: "text",
            direction: "neutral",
            getter: (u) => compareCostBreakdownText(u, "living"),
        },
        {
            key: "aid",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.aid", "Aid"),
            type: "number",
            direction: "neutral",
            getter: compareAidScore,
            formatter: (value, u) => compareAidText(u),
            score: false,
            reason: false,
        },
        {
            key: "salary",
            section: "outcomes",
            category: "outcomes",
            label: t("universities.compare.row.salary", "Early career salary"),
            type: "number",
            direction: "higher",
            getter: (u) => toFiniteNumber(u?.outcomes?.average_early_career_salary_usd),
            formatter: (value) => moneyUSD(value),
            sourceKey: "average_early_career_salary_usd",
            weight: 1.1,
            materiality: 0.1,
            comparable: (rows) => rows.every((row) => {
                const source = compareSourceMeta(row.university, "average_early_career_salary_usd");
                return Boolean(String(source?.url || "").trim() && String(source?.verifiedAt || "").trim());
            }),
        },
        {
            key: "data_quality",
            section: "data",
            category: "data",
            label: t("universities.compare.row.data_quality", "Verified data"),
            type: "text",
            direction: "neutral",
            getter: compareDataConfidenceText,
            score: false,
            reason: false,
        },
        {
            key: "campus_area",
            section: "context",
            category: "context",
            label: t("universities.compare.row.campus_area", "Campus area"),
            type: "number",
            direction: "neutral",
            getter: (u) => toFiniteNumber(u?.student_life?.campus_area_m2),
            formatter: compareCampusAreaText,
            score: false,
            reason: false,
        },
    ];

    const requirementKeys = collectCompareExamKeys(universities, compareSelectedRequirementKeys);
    requirementKeys.forEach((examId) => {
        specs.push({
            key: `req_${examId}`,
            section: "admissions",
            category: "admissions",
            label: tFormat("universities.compare.row.exam_requirement", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} requirement`),
            type: "number",
            direction: "neutral",
            getter: (u) => compareRequirementValue(u, examId),
            formatter: (value) => (canonicalizeExamId(examId) === "GPA" ? formatExamValue("GPA", value) : compareScoreText(value)),
        });
    });

    const averageScoreKeys = collectCompareExamKeys(universities, compareSelectedAverageKeys);
    averageScoreKeys.forEach((examId) => {
        specs.push({
            key: `avg_${examId}`,
            section: "admissions",
            category: "prestige",
            label: tFormat("universities.compare.row.exam_average", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} admitted score`),
            type: "number",
            direction: "neutral",
            getter: (u) => compareAverageScoreValue(u, examId),
            formatter: (value) => (canonicalizeExamId(examId) === "GPA" ? formatExamValue("GPA", value) : compareScoreText(value)),
        });
    });

    const languageRequirementKeys = collectCompareExamKeys(universities, compareSelectedLanguageRequirementKeys);
    languageRequirementKeys.forEach((examId) => {
        specs.push({
            key: `lang_${examId}`,
            section: "admissions",
            category: "admissions",
            label: tFormat("universities.compare.row.language_exam_requirement", { exam: getExamDisplayName(examId) }, `${getExamDisplayName(examId)} language minimum`),
            type: "number",
            direction: "neutral",
            getter: (u) => compareLanguageRequirementValue(u, examId),
            formatter: compareScoreText,
        });
    });

    return specs.filter((spec) => {
        const values = universities.map((u) => compareSpecRawValue(spec, u));
        if (spec.type === "text") {
            return values.some((value) => String(value || "").trim() && String(value || "").trim() !== t("common.na", "N/A"));
        }
        return values.some((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
    }).map((spec, index) => ({ ...spec, order: index }));
};

export const compareSpecRawValue = (spec, u) => {
    try {
        const value = spec.getter(u);
        if (spec.type === "number") return toFiniteNumber(value);
        if (spec.type === "boolean") return !!value;
        return value;
    } catch (e) {
        return spec.type === "number" ? null : "";
    }
};

export const compareSpecRows = (universities, spec) => universities
    .map((u) => ({
        university: u,
        id: String(u?.id || ""),
        value: compareSpecRawValue(spec, u),
    }))
    .filter((row) => row.id && row.value !== null && row.value !== undefined && row.value !== "" && (spec.type !== "number" || Number.isFinite(row.value)));

export const compareBestIdsForSpec = (universities, spec) => {
    if (spec.reason === false || spec.score === false) return new Set();
    if (!["higher", "lower"].includes(spec.direction)) return new Set();
    const rows = compareSpecRows(universities, spec);
    if (rows.length < 2) return new Set();
    if (typeof spec.comparable === "function" && !spec.comparable(rows)) return new Set();
    const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
    const best = sorted[0]?.value;
    if (!Number.isFinite(best)) return new Set();
    const bestRows = sorted.filter((row) => Math.abs(row.value - best) <= 0.000001);
    if (bestRows.length !== 1) return new Set();
    const baseline = sorted.find((row) => row.id !== bestRows[0].id);
    const materiality = Number(spec.materiality || 0);
    if (baseline && materiality > 0) {
        const denominator = Math.max(Math.abs(Number(baseline.value)), 0.000001);
        const relativeDifference = Math.abs(Number(best) - Number(baseline.value)) / denominator;
        if (relativeDifference < materiality) return new Set();
    }
    return new Set([bestRows[0].id]);
};

export const compareMetrics = (universities) => {
    const specs = buildCompareSpecs(universities);
    const bestBySpec = new Map(specs.map((spec) => [spec.key, compareBestIdsForSpec(universities, spec)]));
    const firstBestId = (key) => Array.from(bestBySpec.get(key) || [])[0] || "";
    return {
        specs,
        bestBySpec,
        bestRankId: firstBestId("rank"),
        lowestCostId: firstBestId("total_cost"),
        highestAcceptanceId: firstBestId("acceptance"),
    };
};

export const compareCell = (text, opts = {}) => {
    const tone = opts.tone ? ` compare-cell--${opts.tone}` : "";
    const sub = opts.subHtml || (opts.sub ? `<small>${escapeHtml(opts.sub)}</small>` : "");
    const titleAttr = opts.title ? ` title="${escapeHtmlAttr(opts.title)}"` : "";
    return `<td class="compare-cell${tone}"${titleAttr}><span>${escapeHtml(text || t("common.na", "N/A"))}</span>${sub}</td>`;
};

export const compareSectionRow = (label, kind, universities, renderValue) => `
    <tr class="compare-table__section-row" data-section="${escapeHtmlAttr(kind)}">
        <td colspan="${universities.length + 1}">${escapeHtml(label)}</td>
    </tr>
`;

export const compareDataRow = (label, universities, renderValue, section = "") => {
    const renderedCells = universities.map((u) => {
        const value = renderValue(u);
        if (value && typeof value === "object") return value;
        return { text: String(value || ""), tone: "", sub: "", title: "" };
    });
    const isIdentical = renderedCells.length > 1 && renderedCells.every((c) => (
        String(c.text || "").trim().toLowerCase() === String(renderedCells[0]?.text || "").trim().toLowerCase()
    ));
    const identicalClass = isIdentical ? " compare-row--identical" : "";
    const sectionAttr = section ? ` data-row-section="${escapeHtmlAttr(section)}"` : "";
    return `
        <tr class="compare-table__row${identicalClass}"${sectionAttr}>
            <td>${escapeHtml(label)}</td>
            ${renderedCells.map((c) => compareCell(c.text, c)).join("")}
        </tr>
    `;
};

export const compareSpecValue = (spec, u, metrics) => {
    const raw = compareSpecRawValue(spec, u);
    const text = raw === null || raw === undefined || raw === ""
        ? t("common.na", "N/A")
        : (spec.formatter ? spec.formatter(raw, u) : String(raw));
    const bestIds = metrics.bestBySpec?.get(spec.key) || new Set();
    const sourceMeta = spec.sourceGetter
        ? spec.sourceGetter(u)
        : (spec.sourceKey ? compareSourceMeta(u, spec.sourceKey) : null);
    const sourceLabel = String(sourceMeta?.source || sourceMeta?.text || "").trim();
    const sourceUrl = String(sourceMeta?.sourceUrl || sourceMeta?.url || "").trim();
    const verifiedAt = String(sourceMeta?.verifiedAt || "").trim();
    const sourceParts = [sourceLabel, verifiedAt].filter(Boolean);
    const sourceText = sourceParts.join(" · ");
    const sourceHtml = sourceText
        ? `<small>${sourceUrl
            ? `<a class="compare-source-link" href="${escapeHtmlAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceText)}</a>`
            : escapeHtml(sourceText)}</small>`
        : "";
    return {
        text,
        tone: bestIds.has(String(u?.id || "")) ? "best" : "",
        sub: "",
        subHtml: sourceHtml,
        title: spec.titleGetter ? spec.titleGetter(u) : "",
    };
};

export const compareRowsHtml = (universities, metrics) => {
    const sections = compareSpecSections();
    const sectionOrder = ["overview", "programs", "admissions", "finance", "outcomes", "data", "context"];
    const orderedSpecs = (metrics.specs || []).slice().sort((a, b) => {
        const left = sectionOrder.includes(a.section) ? sectionOrder.indexOf(a.section) : sectionOrder.length;
        const right = sectionOrder.includes(b.section) ? sectionOrder.indexOf(b.section) : sectionOrder.length;
        if (left !== right) return left - right;
        return (a.order || 0) - (b.order || 0);
    });
    let currentSection = "";
    return orderedSpecs.map((spec) => {
        const sectionHtml = spec.section !== currentSection
            ? compareSectionRow(sections[spec.section] || humanizeMachineLabel(spec.section, spec.section), spec.section, universities)
            : "";
        currentSection = spec.section;
        return `${sectionHtml}${compareDataRow(spec.label, universities, (u) => compareSpecValue(spec, u, metrics), spec.section)}`;
    }).join("");
};

export const compareCostContextsComparable = (contexts) => {
    if (!Array.isArray(contexts) || contexts.length < 2) return false;
    const valid = contexts.every((context) => (
        Number.isFinite(Number(context?.min))
        && String(context?.academicYear || "").trim()
        && String(context?.feeStatus || "").trim()
    ));
    if (!valid) return false;
    const first = contexts[0];
    return contexts.every((context) => (
        String(context.academicYear).trim().toLowerCase() === String(first.academicYear).trim().toLowerCase()
        && String(context.feeStatus).trim().toLowerCase() === String(first.feeStatus).trim().toLowerCase()
    ));
};

export const comparePublishedAdmissionsComparable = (rows) => {
    if (!Array.isArray(rows) || rows.length < 2) return false;
    const valid = rows.every((row) => (
        Number.isFinite(Number(row?.value))
        && String(row?.scope || "").trim()
        && String(row?.audience || "").trim()
        && String(row?.cycle || "").trim()
    ));
    if (!valid) return false;
    const first = rows[0];
    return rows.every((row) => (
        String(row.scope).trim().toLowerCase() === String(first.scope).trim().toLowerCase()
        && String(row.audience).trim().toLowerCase() === String(first.audience).trim().toLowerCase()
        && String(row.cycle).trim().toLowerCase() === String(first.cycle).trim().toLowerCase()
    ));
};

const compareDecisionStatusLabel = (status) => {
    const labels = {
        advantage: t("universities.compare.status.advantage", "Comparable advantage"),
        tradeoff: t("universities.compare.status.tradeoff", "Trade-off"),
        parity: t("universities.compare.status.parity", "No clear leader"),
        incomparable: t("universities.compare.status.incomparable", "Not directly comparable"),
        missing: t("universities.compare.status.missing", "Data missing"),
    };
    return labels[status] || labels.missing;
};

const compareDecisionSource = (meta) => {
    const source = String(meta?.source || meta?.text || "").trim();
    const sourceUrl = String(meta?.sourceUrl || meta?.source_url || "").trim();
    const verifiedAt = String(meta?.verifiedAt || meta?.verified_at || "").trim();
    if (!source && !verifiedAt) return null;
    return { source, sourceUrl, verifiedAt };
};

const compareDecisionFact = (label, value, source = null) => ({ label, value, source });

const selectedChanceForUniversity = (university, context = {}) => {
    const id = String(university?.id || "");
    const universityChance = context?.chances?.get?.(id) || null;
    const selection = context?.choices?.get?.(id) || null;
    const selectedKey = String(selection?.choiceKey || selection?.choice_key || selection || "").trim();
    const choices = Array.isArray(universityChance?.choices) ? universityChance.choices : [];
    return choices.find((choice) => String(choice?.choiceKey || "") === selectedKey)
        || choices[0]
        || universityChance;
};

const compareChanceFactText = (chance) => {
    const value = toFiniteNumber(chance?.chancePercent ?? chance?.overallChance);
    if (value !== null && chance?.chanceAvailable !== false) {
        const confidence = String(chance?.confidence || chance?.confidenceLevel || "").trim().toLowerCase();
        const confidenceLabels = {
            high: t("universities.compare.confidence.high", "high confidence"),
            medium: t("universities.compare.confidence.medium", "medium confidence"),
            low: t("universities.compare.confidence.low", "low confidence"),
        };
        const confidenceText = confidenceLabels[confidence] || t("universities.compare.confidence.estimated", "estimated");
        return `${comparePercentText(value)} · ${confidenceText}`;
    }
    const reason = String(chance?.reason || "").trim().toLowerCase();
    if (reason === "requirements_not_met") {
        return t("admission.chance.requirements_not_met", "A required minimum is not met");
    }
    return t("universities.compare.profile_missing", "Add the required profile evidence");
};

const compareAdmissionTheme = (universities, context) => {
    const published = universities.map((university) => comparePublishedAdmission(university, context?.choices));
    const publishedAvailable = published.every((row) => Number.isFinite(Number(row?.value)));
    const comparable = comparePublishedAdmissionsComparable(published);
    const status = !publishedAvailable ? "missing" : (comparable ? "parity" : "incomparable");
    const summary = !publishedAvailable
        ? t("universities.compare.admissions.missing", "Published admission data is incomplete, so no selectivity comparison is made.")
        : (comparable
            ? t("universities.compare.admissions.comparable", "Published rates describe selectivity, not your personal probability of admission.")
            : t("universities.compare.admissions.incomparable", "The published rates use different course or institution scopes, audiences, or cycles."));

    return {
        key: "admissions",
        icon: "academic-cap",
        title: t("universities.compare.admissions.title", "Admission and requirements fit"),
        status,
        summary,
        universities: universities.map((university, index) => {
            const chance = selectedChanceForUniversity(university, context);
            const admission = published[index];
            const scopeKey = admission.scope === "program"
                ? "universities.compare.scope.program"
                : "universities.compare.scope.institution";
            const scopeFallback = admission.scope === "program" ? "course-specific" : "institution-wide";
            const publishedValue = Number.isFinite(Number(admission.value))
                ? `${comparePercentText(admission.value)} · ${t(scopeKey, scopeFallback)}${admission.cycle ? ` · ${admission.cycle}` : ""}`
                : t("common.na", "N/A");
            return {
                id: String(university?.id || ""),
                name: compareUniversityName(university),
                facts: [
                    compareDecisionFact(t("universities.compare.personal_estimate", "Personal estimate"), compareChanceFactText(chance)),
                    compareDecisionFact(
                        t("universities.compare.published_rate", "Published selectivity"),
                        publishedValue,
                        compareDecisionSource(admission)
                    ),
                    compareDecisionFact(t("universities.compare.requirements_fit", "Requirements"), compareRequirementsText(university, context?.choices)),
                ],
            };
        }),
    };
};

const compareFinanceTheme = (universities, context) => {
    const costs = universities.map((university) => compareSelectedCostContext(university, context?.choices));
    const available = costs.every((cost) => Number.isFinite(Number(cost?.min)));
    const comparable = available && compareCostContextsComparable(costs);
    let status = "missing";
    let summary = t("universities.compare.finance.missing", "Comparable cost data is missing; unknown values are not treated as zero.");
    if (available && !comparable) {
        status = "incomparable";
        summary = t("universities.compare.finance.incomparable", "Sticker costs use different academic years or fee statuses, so they are shown without a winner.");
    } else if (comparable) {
        status = "tradeoff";
        summary = t("universities.compare.finance.tradeoff", "Compare the published sticker cost with each university's aid policy; neither alone is the final net price.");
    }
    return {
        key: "finance",
        icon: "banknotes",
        title: t("universities.compare.finance.title", "Cost and financial aid"),
        status,
        summary,
        universities: universities.map((university, index) => {
            const cost = costs[index];
            const contextText = compareCostContextText(cost);
            const aid = university?.finance?.financial_aid || {};
            return {
                id: String(university?.id || ""),
                name: compareUniversityName(university),
                facts: [
                    compareDecisionFact(t("universities.compare.sticker_cost", "Sticker cost"), formatCompareCostRange(cost), compareDecisionSource(cost)),
                    compareDecisionFact(t("universities.compare.cost_context", "Cost context"), contextText),
                    compareDecisionFact(
                        t("universities.compare.aid_policy", "Aid policy"),
                        compareAidPolicyText(university),
                        compareDecisionSource(aid)
                    ),
                ],
            };
        }),
    };
};

const compareAcademicsTheme = (universities) => {
    const structures = universities.map((university) => university?.academics?.undergraduate_structure || {});
    const hasStructures = structures.some((structure) => Object.keys(structure).length > 0);
    const ranks = universities.map((university) => toFiniteNumber(university?.rank)).filter((value) => value !== null);
    const closeRanks = ranks.length === universities.length && Math.max(...ranks) - Math.min(...ranks) <= 3;
    return {
        key: "academics",
        icon: "book-open",
        title: t("universities.compare.academics.title", "Program and learning model"),
        status: hasStructures ? "tradeoff" : (closeRanks ? "parity" : "missing"),
        summary: hasStructures
            ? t("universities.compare.academics.tradeoff", "These are different undergraduate models and preference trade-offs, not proof that one offers higher academic quality.")
            : t("universities.compare.academics.parity", "A small rank difference is informational and does not establish a prestige or quality winner."),
        universities: universities.map((university, index) => ({
            id: String(university?.id || ""),
            name: compareUniversityName(university),
            facts: [
                compareDecisionFact(
                    t("universities.compare.published_rank", "Published rank"),
                    compareRankText(university),
                    compareDecisionSource(compareSourceMeta(university, "rank"))
                ),
                compareDecisionFact(
                    t("universities.compare.learning_model", "Learning model"),
                    compareUndergraduateStructureText(university),
                    compareDecisionSource(structures[index])
                ),
            ],
        })),
    };
};

const compareOutcomesTheme = (universities) => {
    const rows = universities.map((university) => ({
        university,
        salary: (() => {
            const source = compareSourceMeta(university, "average_early_career_salary_usd");
            return String(source?.url || "").trim() && String(source?.verifiedAt || "").trim()
                ? toFiniteNumber(university?.outcomes?.average_early_career_salary_usd)
                : null;
        })(),
    }));
    const complete = rows.every((row) => row.salary !== null);
    return {
        key: "outcomes",
        icon: "chart-bar",
        title: t("universities.compare.outcomes.title", "Graduate outcomes"),
        status: complete ? "tradeoff" : "missing",
        summary: complete
            ? t("universities.compare.outcomes.available", "Published salary is shown as context; ROI requires comparable verified cost and outcome data.")
            : t("universities.compare.outcomes.missing", "Verified comparable salary or ROI data is incomplete, so no outcome winner is selected."),
        universities: rows.map((row) => ({
            id: String(row.university?.id || ""),
            name: compareUniversityName(row.university),
            facts: [compareDecisionFact(
                t("universities.compare.verified_salary", "Verified early-career salary"),
                row.salary === null ? t("common.na", "N/A") : moneyUSD(row.salary),
                compareDecisionSource(compareSourceMeta(row.university, "average_early_career_salary_usd"))
            )],
        })),
    };
};

export const buildCompareDecisionSignals = (universities, context = {}) => [
    compareAdmissionTheme(universities, context),
    compareFinanceTheme(universities, context),
    compareAcademicsTheme(universities),
    compareOutcomesTheme(universities),
];

const compareDecisionSourceHtml = (source) => {
    if (!source) return "";
    const text = [source.source, source.verifiedAt].filter(Boolean).join(" · ");
    if (!text) return "";
    const body = source.sourceUrl
        ? `<a href="${escapeHtmlAttr(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
        : escapeHtml(text);
    return `<span class="compare-decision-source">${body}</span>`;
};

export const buildCompareDecisionSupportHtml = (universities, context = {}) => {
    const themes = buildCompareDecisionSignals(universities, context);
    return `
        <section class="compare-analysis-block compare-decision-support" aria-labelledby="compareDecisionTitle">
            <div class="compare-block-head">
                <div class="compare-block-icon">${renderInlineIcon("sparkles", 20, "compare-block-icon-svg")}</div>
                <div>
                    <h2 id="compareDecisionTitle">${escapeHtml(t("universities.compare.decision.title", "What matters for your choice"))}</h2>
                    <p>${escapeHtml(t("universities.compare.decision.subtitle", "Independent signals explain fit and trade-offs without declaring one university universally better."))}</p>
                </div>
            </div>
            <div class="compare-decision-list">
                ${themes.map((theme) => `
                    <article class="compare-decision-theme" data-theme-key="${escapeHtmlAttr(theme.key)}" data-status="${escapeHtmlAttr(theme.status)}">
                        <header class="compare-decision-theme__head">
                            <span class="compare-decision-theme__icon">${renderInlineIcon(theme.icon, 18, "compare-decision-theme__icon-svg")}</span>
                            <div>
                                <h3>${escapeHtml(theme.title)}</h3>
                                <p>${escapeHtml(theme.summary)}</p>
                            </div>
                            <span class="compare-decision-status compare-decision-status--${escapeHtmlAttr(theme.status)}">${escapeHtml(compareDecisionStatusLabel(theme.status))}</span>
                        </header>
                        <div class="compare-decision-pair">
                            ${theme.universities.map((row, index) => `
                                <section class="compare-decision-side" data-compare-slot="${index + 1}">
                                    <span class="compare-decision-side__slot">${escapeHtml(compareSlotLabel(index))}</span>
                                    <h4>${escapeHtml(row.name)}</h4>
                                    <dl>
                                        ${row.facts.map((fact) => `
                                            <div class="compare-decision-fact">
                                                <dt>${escapeHtml(fact.label)}</dt>
                                                <dd>${escapeHtml(fact.value || t("common.na", "N/A"))}${compareDecisionSourceHtml(fact.source)}</dd>
                                            </div>
                                        `).join("")}
                                    </dl>
                                </section>
                            `).join("")}
                        </div>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
};

