/* frontend/javascript/pages/universities/compare-specs.js */

import {
  escapeHtml,
  escapeHtmlAttr,
  initials,
  moneyUSD,
  formatPlural,
  getExamDisplayName,
  canonicalizeExamId,
} from "../../utils.js";

import {
  formatUiNumber,
  toFiniteNumber,
  uniLogoSrc,
  renderInlineIcon,
  trTrackDescription,
} from "../_shared.js";

import {
  translateWord,
  humanizeMachineLabel,
} from "../../university-translations.js";

import { getTrackFundingType } from "../../university-detail-helpers.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";

import {
  compareUniversityName,
  compareLocationText,
  compareAidText,
  compareProgramSummary,
  compareProgramTitle,
  compareStudyModeText,
  compareAdmissionOptionEntries,
  compareSelectedAdmissionEntry,
  compareSelectedAdmissionOption,
  compareSelectedAnnualCost,
  compareTrackLabel,
  compareFundingChoiceText,
  compareRequirementsText,
  compareAverageScoreText,
  compareLanguageProofText,
  compareExtraRequirementsText,
  compareSourceText,
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
  compareCostBreakdownNumber,
} from "./compare-helpers.js";

export const compareSlotLabel = (index) => tFormat(
  "universities.compare.pair_slot",
  { number: String(index + 1) },
  `University ${index + 1}`
);

export const formatCompareScoreValue = (value) => {
    const n = toFiniteNumber(value);
    return n !== null ? formatUiNumber(n, { maximumFractionDigits: 2 }) : "";
};

export const compareOptionScoreProfilePreview = (option) => {
    const profile = (option?.score_profile && typeof option.score_profile === "object") ? option.score_profile : null;
    if (!profile) return "";
    const exam = getExamDisplayName(profile.exam_id || (Array.isArray(profile.compatible_exam_ids) ? profile.compatible_exam_ids[0] : ""));
    const median = formatCompareScoreValue(profile.median_raw ?? profile.median_normalized);
    const low = formatCompareScoreValue(profile.p25_raw ?? profile.p25_normalized);
    const high = formatCompareScoreValue(profile.p75_raw ?? profile.p75_normalized);
    if (median && low && high) {
        return tFormat(
            "universities.compare.configure.score_profile_range",
            { exam, median, low, high },
            `${exam} median ${median} (25-75%: ${low}-${high})`
        );
    }
    if (median) {
        return tFormat(
            "universities.compare.configure.score_profile_median",
            { exam, median },
            `${exam} median ${median}`
        );
    }
    return "";
};

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
            const current = `${getExamDisplayName(key)} ${req[key]}`;
            return baseValue !== null && baseValue !== undefined && baseValue !== "" && String(baseValue) !== String(req[key])
                ? tFormat(
                    "universities.compare.configure.funding_delta_from",
                    { value: current, base: String(baseValue) },
                    `${current} (standard ${baseValue})`
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

export const compareBestBadges = (u, metrics) => {
    const badges = [];
    const id = String(u?.id || "");
    if (id && metrics.bestRankId === id) badges.push(t("universities.compare.badge.best_rank", "Higher rank"));
    if (id && metrics.lowestCostId === id) badges.push(t("universities.compare.badge.lowest_cost", "Lower cost"));
    if (id && metrics.highestAcceptanceId === id) badges.push(t("universities.compare.badge.more_accessible", "Higher acceptance"));
    if ((metrics.bestBySpec?.get("aid") || new Set()).has(id)) {
        badges.push(compareAidText(u));
    }
    return badges.slice(0, 3);
};

export const compareCategoryMeta = () => ({
    prestige: {
        title: t("universities.compare.category.prestige.title", "Prestige"),
        subtitle: t("universities.compare.category.prestige.subtitle", "Rank and selectivity signals"),
        icon: "trophy",
    },
    admissions: {
        title: t("universities.compare.category.admissions.title", "Admissions"),
        subtitle: t("universities.compare.category.admissions.subtitle", "Access, requirement profiles, and funding"),
        icon: "academic-cap",
    },
    finance: {
        title: t("universities.compare.category.finance.title", "Finance"),
        subtitle: t("universities.compare.category.finance.subtitle", "Cost and aid flexibility"),
        icon: "banknotes",
    },
    academics: {
        title: t("universities.compare.category.academics.title", "Academics"),
        subtitle: t("universities.compare.category.academics.subtitle", "Program breadth and study options"),
        icon: "book-open",
    },
    outcomes: {
        title: t("universities.compare.category.outcomes.title", "Outcomes"),
        subtitle: t("universities.compare.category.outcomes.subtitle", "Published career outcome signals"),
        icon: "chart-bar",
    },
    data: {
        title: t("universities.compare.category.data.title", "Data confidence"),
        subtitle: t("universities.compare.category.data.subtitle", "Verified facts and sources"),
        icon: "check-badge",
    },
    context: {
        title: t("universities.compare.category.context.title", "Context"),
        subtitle: t("universities.compare.category.context.subtitle", "Scale and campus context"),
        icon: "building-office-2",
    },
});

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
            direction: "lower",
            getter: (u) => {
                const rank = toFiniteNumber(u?.rank);
                return rank !== null && rank > 0 ? rank : null;
            },
            formatter: (value) => `#${formatUiNumber(value, { maximumFractionDigits: 0 })}`,
            sourceKey: "rank",
            reasonMode: "rank",
            allowSinglePublishedAdvantage: true,
            weight: 1.25,
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
            direction: "higher",
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
            direction: "higher",
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
            direction: "higher",
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
            direction: "higher",
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
            key: "acceptance",
            section: "admissions",
            category: "admissions",
            label: t("ranking.acceptance", "Acceptance Rate"),
            type: "number",
            direction: "higher",
            getter: (u) => toFiniteNumber(u?.academics?.acceptance_rate_percent),
            formatter: comparePercentText,
            sourceKey: "acceptance_rate_percent",
            weight: 1.2,
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
            formatter: (value) => moneyUSD(value),
            sourceKey: "tuition_total_cost_year_usd",
            weight: 1.25,
        },
        {
            key: "tuition_fees",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.tuition_fees", "Tuition + fees"),
            type: "number",
            direction: "lower",
            getter: (u) => compareCostBreakdownNumber(u, "tuition"),
            formatter: (value) => moneyUSD(value),
        },
        {
            key: "living_costs",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.living_costs", "Living cost items"),
            type: "number",
            direction: "lower",
            getter: (u) => compareCostBreakdownNumber(u, "living"),
            formatter: (value) => moneyUSD(value),
        },
        {
            key: "aid",
            section: "finance",
            category: "finance",
            label: t("universities.compare.row.aid", "Aid"),
            type: "number",
            direction: "higher",
            getter: compareAidScore,
            formatter: (value, u) => compareAidText(u),
            reasonMode: "aid",
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
            direction: "lower",
            getter: (u) => compareRequirementValue(u, examId),
            formatter: compareScoreText,
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
            direction: "higher",
            getter: (u) => compareAverageScoreValue(u, examId),
            formatter: compareScoreText,
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
            direction: "lower",
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
    if (rows.length === 1 && spec.allowSinglePublishedAdvantage) return new Set([rows[0].id]);
    if (rows.length < 2) return new Set();
    const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
    const best = sorted[0]?.value;
    if (!Number.isFinite(best)) return new Set();
    const bestRows = sorted.filter((row) => Math.abs(row.value - best) <= 0.000001);
    return bestRows.length === 1 ? new Set([bestRows[0].id]) : new Set();
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
    const sub = opts.sub ? `<small>${escapeHtml(opts.sub)}</small>` : "";
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
    return {
        text,
        tone: bestIds.has(String(u?.id || "")) ? "best" : "",
        sub: spec.sourceKey ? compareSourceText(u, spec.sourceKey) : "",
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

export const percentDeltaText = (value, average, inverse = false) => {
    if (!Number.isFinite(value) || !Number.isFinite(average) || average <= 0) return "";
    const delta = inverse ? ((average - value) / average) : ((value - average) / average);
    if (!Number.isFinite(delta) || delta <= 0.005) return "";
    return `${Math.round(delta * 100)}%`;
};

export const compareAdvantageText = (spec, row, baseline) => {
    const name = compareUniversityName(row.university);
    const metric = spec.label;
    const valueText = spec.formatter ? spec.formatter(row.value, row.university) : String(row.value);
    const baselineText = baseline ? (spec.formatter ? spec.formatter(baseline.value, baseline.university) : String(baseline.value)) : "";
    if (spec.reasonMode === "rank") {
        const baselineRank = baseline && Number.isFinite(baseline.value) ? baseline.value : null;
        if (baselineRank !== null) {
            const diff = Math.abs(baselineRank - row.value);
            const baselineName = compareUniversityName(baseline.university);
            if (diff > 0) {
                const positionsWord = formatPlural(
                    diff,
                    [
                        t("universities.compare.reason.position_one", "position"),
                        t("universities.compare.reason.position_few", "positions"),
                        t("universities.compare.reason.position_many", "positions"),
                    ],
                    getCurrentLanguage()
                );
                return tFormat(
                    "universities.compare.reason.rank_vs",
                    {
                        name,
                        metric,
                        value: valueText,
                        baseline: baselineName,
                        baseline_value: baselineText,
                        diff: String(diff),
                        positions: positionsWord,
                    },
                    `Best published rank: ${valueText} (${diff} ${positionsWord} better than ${baselineName} — ${baselineText}).`
                );
            }
        }
        return tFormat(
            "universities.compare.reason.rank",
            { name, metric, value: valueText },
            `Best published rank: ${valueText}.`
        );
    }
    if (spec.reasonMode === "aid") {
        return tFormat(
            "universities.compare.reason.best",
            { name, metric, value: valueText },
            `${metric}: ${valueText}.`
        );
    }
    const delta = baseline ? percentDeltaText(row.value, baseline.value, spec.direction === "lower") : "";
    if (delta) {
        const key = spec.direction === "lower"
            ? "universities.compare.reason.lower_percent"
            : "universities.compare.reason.higher_percent";
        const fallback = spec.direction === "lower"
            ? `${metric}: ${valueText} instead of ${baselineText}.`
            : `${metric}: ${valueText} instead of ${baselineText}.`;
        return tFormat(key, { name, metric, percent: delta, value: valueText, baseline: baselineText }, fallback);
    }
    const key = spec.direction === "lower"
        ? "universities.compare.reason.lowest"
        : "universities.compare.reason.highest";
    const fallback = spec.direction === "lower"
        ? `Lowest ${metric}: ${valueText}.`
        : `Highest ${metric}: ${valueText}.`;
    return tFormat(key, { name, metric, value: valueText }, fallback);
};

export const buildCompareAdvantages = (universities, metrics) => {
    const byUniversity = new Map(universities.map((u) => [String(u?.id || ""), []]));
    (metrics.specs || []).forEach((spec) => {
        if (spec.reason === false || !["higher", "lower"].includes(spec.direction)) return;
        const rows = compareSpecRows(universities, spec);
        if (rows.length === 1 && spec.allowSinglePublishedAdvantage) {
            const target = byUniversity.get(rows[0].id);
            if (!target) return;
            target.push({
                key: spec.key,
                category: spec.category,
                strength: (spec.weight || 1) * 0.12,
                text: compareAdvantageText(spec, rows[0], null),
            });
            return;
        }
        if (rows.length < 2) return;
        const sorted = rows.slice().sort((a, b) => spec.direction === "higher" ? b.value - a.value : a.value - b.value);
        const bestValue = sorted[0]?.value;
        if (!Number.isFinite(bestValue)) return;
        const bestRows = sorted.filter((row) => Math.abs(row.value - bestValue) <= 0.000001);
        if (bestRows.length !== 1) return;
        const best = bestRows[0];
        const baseline = sorted.find((row) => row.id !== best.id) || null;
        const strengthDelta = baseline && Number.isFinite(baseline.value) && baseline.value > 0
            ? Math.abs(best.value - baseline.value) / Math.abs(baseline.value)
            : 0.08;
        const categoryBoost = spec.weight || 1;
        const strength = Math.max(0.02, strengthDelta) * categoryBoost;
        const target = byUniversity.get(best.id);
        if (!target) return;
        target.push({
            key: spec.key,
            category: spec.category,
            strength,
            text: compareAdvantageText(spec, best, baseline),
        });
    });
    byUniversity.forEach((items, id) => {
        byUniversity.set(id, items.sort((a, b) => b.strength - a.strength).slice(0, 6));
    });
    return byUniversity;
};

export const buildCompareKeyDifferencesHtml = (universities, metrics) => {
    const advantages = buildCompareAdvantages(universities, metrics);
    return `
        <section class="compare-analysis-block compare-key-differences" aria-labelledby="compareKeyDifferencesTitle">
            <div class="compare-block-head">
                <div class="compare-block-icon">${renderInlineIcon("sparkles", 20, "compare-block-icon-svg")}</div>
                <div>
                    <h2 id="compareKeyDifferencesTitle">${escapeHtml(t("universities.compare.differences.title", "Key differences"))}</h2>
                    <p>${escapeHtml(t("universities.compare.differences.subtitle", "Shows the clearest published advantages for each selected university."))}</p>
                </div>
            </div>
            <div class="compare-reasons compare-reasons--pair">
                ${universities.map((u, index) => {
                    const id = String(u?.id || "");
                    const items = advantages.get(id) || [];
                    return `
                        <article class="compare-reason-group" data-compare-slot="${index + 1}">
                            <span class="compare-reason-slot">${escapeHtml(compareSlotLabel(index))}</span>
                            <h3>${escapeHtml(tFormat("universities.compare.differences.reasons_for", { name: compareUniversityName(u) }, compareUniversityName(u)))}</h3>
                            ${items.length ? `
                                <ul class="compare-reason-list">
                                    ${items.map((item) => `
                                        <li>
                                            <span class="compare-reason-icon">${renderInlineIcon("check-circle", 18, "compare-reason-icon-svg")}</span>
                                            <span>${escapeHtml(item.text)}</span>
                                        </li>
                                    `).join("")}
                                </ul>
                            ` : `<p class="compare-reason-empty">${escapeHtml(t("universities.compare.differences.no_clear_advantage", "No clear published advantage found across comparable metrics."))}</p>`}
                        </article>
                    `;
                }).join("")}
            </div>
        </section>
    `;
};

export const compareNormalizedScore = (value, min, max, direction) => {
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (Math.abs(max - min) <= 0.000001) return 80;
    const normalized = (value - min) / (max - min);
    const relative = direction === "lower" ? (1 - normalized) : normalized;
    return Math.max(0, Math.min(100, Math.round(60 + relative * 40)));
};

export const buildCompareCategoryScores = (universities, metrics) => {
    const scores = new Map(universities.map((u) => [String(u?.id || ""), new Map()]));
    (metrics.specs || []).forEach((spec) => {
        if (spec.score === false || !["higher", "lower"].includes(spec.direction) || !spec.category) return;
        const rows = compareSpecRows(universities, spec);
        if (rows.length < 2) return;
        const values = rows.map((row) => row.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        rows.forEach((row) => {
            const score = compareNormalizedScore(row.value, min, max, spec.direction);
            if (score === null) return;
            const byCategory = scores.get(row.id);
            if (!byCategory) return;
            const list = byCategory.get(spec.category) || [];
            list.push({ score, weight: spec.weight || 1 });
            byCategory.set(spec.category, list);
        });
    });
    const averaged = new Map();
    scores.forEach((byCategory, id) => {
        const result = new Map();
        byCategory.forEach((items, category) => {
            const weightSum = items.reduce((sum, item) => sum + item.weight, 0);
            const scoreSum = items.reduce((sum, item) => sum + (item.score * item.weight), 0);
            if (weightSum > 0) result.set(category, Math.round(scoreSum / weightSum));
        });
        averaged.set(id, result);
    });
    return averaged;
};

export const buildCompareOverviewHtml = (universities, metrics) => {
    const categoryMeta = compareCategoryMeta();
    const scores = buildCompareCategoryScores(universities, metrics);
    const advantages = buildCompareAdvantages(universities, metrics);
    const categories = Object.keys(categoryMeta).filter((category) => (
        universities.some((u) => scores.get(String(u?.id || ""))?.has(category))
    ));
    if (!categories.length) return "";
    return `
        <section class="compare-analysis-block compare-overview" aria-labelledby="compareOverviewTitle">
            <div class="compare-block-head">
                <div class="compare-block-icon">${renderInlineIcon("clipboard-document-list", 20, "compare-block-icon-svg")}</div>
                <div>
                    <h2 id="compareOverviewTitle">${escapeHtml(t("universities.compare.overview.title", "Overview"))}</h2>
                    <p>${escapeHtml(t("universities.compare.overview.subtitle", "Category breakdown: highlights which university holds the relative advantage based on published data."))}</p>
                </div>
            </div>
            <div class="compare-score-grid">
                ${categories.map((category) => {
                    const meta = categoryMeta[category];
                    const ranked = universities
                        .map((u) => ({
                            university: u,
                            id: String(u?.id || ""),
                            score: scores.get(String(u?.id || ""))?.get(category),
                        }))
                        .filter((row) => Number.isFinite(row.score))
                        .sort((a, b) => b.score - a.score);

                    const hasMultiple = ranked.length >= 2;
                    const isTie = hasMultiple && Math.abs(ranked[0].score - ranked[1].score) <= 3;
                    const winner = !isTie && ranked.length > 0 ? ranked[0].university : null;
                    const winnerId = winner ? String(winner.id || "") : "";
                    const winnerName = winner ? compareUniversityName(winner) : "";

                    let reasonText = "";
                    if (winner) {
                        const reasonItem = (advantages.get(winnerId) || []).find((item) => item.category === category);
                        if (reasonItem && reasonItem.text) {
                            reasonText = reasonItem.text;
                        } else {
                            reasonText = tFormat(
                                "universities.compare.overview.advantage_desc",
                                { name: winnerName, category: meta.title },
                                `${winnerName} holds stronger published indicators in ${meta.title}.`
                            );
                        }
                    } else {
                        reasonText = t("universities.compare.overview.parity_desc", "Equal published indicators in this category.");
                    }

                    const leadBadgeText = winner ? tFormat("universities.compare.overview.advantage_label", { name: winnerName }, `Advantage: ${winnerName}`) : "";

                    return `
                        <article class="compare-score-card">
                            <div class="compare-score-card__head">
                                <div class="compare-score-card__meta">
                                    <span class="compare-score-card-icon-wrap">${renderInlineIcon(meta.icon, 16, "compare-score-card-icon")}</span>
                                    <div>
                                        <h3>${escapeHtml(meta.title)}</h3>
                                        <p>${escapeHtml(meta.subtitle)}</p>
                                    </div>
                                </div>
                                ${winner ? `
                                    <span class="compare-verdict-badge compare-verdict-badge--lead" title="${escapeHtmlAttr(leadBadgeText)}">
                                        <span>${escapeHtml(leadBadgeText)}</span>
                                    </span>
                                ` : `
                                    <span class="compare-verdict-badge compare-verdict-badge--parity">
                                        <span class="compare-verdict-badge-dot" aria-hidden="true"></span>
                                        <span>${escapeHtml(t("universities.compare.overview.parity", "Parity"))}</span>
                                    </span>
                                `}
                            </div>
                            <div class="compare-score-card__body">
                                <p class="compare-score-card__reason">${escapeHtml(reasonText)}</p>
                                <div class="compare-score-participants">
                                    ${universities.map((u) => {
                                        const id = String(u?.id || "");
                                        const isLead = Boolean(winner && id === winnerId);
                                        const logoSrc = uniLogoSrc(id);
                                        const logoSrcFull = uniLogoSrc(id, { forceFull: true });
                                        const uniName = compareUniversityName(u);
                                        let statusLabel = "";
                                        if (winner) {
                                            statusLabel = isLead
                                                ? t("universities.compare.overview.lead_status", "Advantage")
                                                : t("universities.compare.overview.baseline_status", "Baseline");
                                        } else {
                                            statusLabel = t("universities.compare.overview.parity_status", "Equal");
                                        }
                                        return `
                                            <div class="compare-score-participant${isLead ? " is-lead" : ""}">
                                                <div class="compare-score-participant__info">
                                                    <span class="compare-score-participant__logo">
                                                        <img src="${escapeHtmlAttr(logoSrc)}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(uniName))}">
                                                    </span>
                                                    <span class="compare-score-participant__name">${escapeHtml(uniName)}</span>
                                                </div>
                                                <span class="compare-score-participant__status">${escapeHtml(statusLabel)}</span>
                                            </div>
                                        `;
                                    }).join("")}
                                </div>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        </section>
    `;
};

export const buildCompareConclusionHtml = (universities, metrics) => {
    const categoryMeta = compareCategoryMeta();
    const scores = buildCompareCategoryScores(universities, metrics);
    const winners = Object.keys(categoryMeta).map((category) => {
        const rows = universities
            .map((u) => ({ university: u, id: String(u?.id || ""), score: scores.get(String(u?.id || ""))?.get(category) }))
            .filter((row) => Number.isFinite(row.score))
            .sort((a, b) => b.score - a.score);
        if (!rows.length) return null;
        return { category, title: categoryMeta[category].title, university: rows[0].university, score: rows[0].score };
    }).filter(Boolean);
    const unique = [];
    winners.forEach((winner) => {
        if (unique.some((row) => row.category === winner.category && String(row.university?.id || "") === String(winner.university?.id || ""))) return;
        unique.push(winner);
    });
    const selected = unique.slice(0, 3);
    const body = selected.length
        ? tFormat(
            "universities.compare.conclusion.body",
            {
                summary: selected.map((row) => `${row.title}: ${compareUniversityName(row.university)}`).join("; "),
            },
            `Best relative fits by category: ${selected.map((row) => `${row.title}: ${compareUniversityName(row.university)}`).join("; ")}.`
        )
        : t("universities.compare.conclusion.empty", "The selected universities are close on the comparable published metrics. Use the highlighted table rows and official sources before making the final decision.");
    return `
        <section class="compare-analysis-block compare-conclusion" aria-labelledby="compareConclusionTitle">
            <div class="compare-block-head">
                <div class="compare-block-icon">${renderInlineIcon("information-circle", 20, "compare-block-icon-svg")}</div>
                <div>
                    <h2 id="compareConclusionTitle">${escapeHtml(t("universities.compare.conclusion.title", "Conclusion"))}</h2>
                    <p>${escapeHtml(body)}</p>
                </div>
            </div>
        </section>
    `;
};
