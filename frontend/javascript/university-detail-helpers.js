import { EXAM_CONFIG, LANG_CONFIG, canonicalizeExamId, escapeHtml, formatExamValue, getExamDisplayName } from "./utils.js";
import { getCurrentLanguage, t } from "./i18n.js";
import { translateAdmissionText, translateTrackLabel, translateWord } from "./university-translations.js";

export function applyPercentWidths(rootEl) {
  if (typeof rootEl?.querySelectorAll !== "function") return;
  rootEl.querySelectorAll("[data-width-pct]").forEach((node) => {
    const raw = Number(node.getAttribute("data-width-pct"));
    const pct = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
    node.style.setProperty("--fill-width", `${pct}%`);
    node.style.setProperty("--fill-scale", String(pct / 100));
  });
}

function isLanguageExam(examKey) {
  const key = String(examKey || "").toUpperCase();
  return (
    key.includes("IELTS") ||
    key.includes("TOEFL") ||
    key.includes("DET") ||
    key.includes("DUOLINGO") ||
    key.includes("PTE") ||
    key.includes("CAMBRIDGE") ||
    key.includes("TESTDAF") ||
    key.includes("DSH") ||
    key.includes("DELF") ||
    key.includes("DALF") ||
    key.includes("TCF") ||
    key.includes("TEF") ||
    key.includes("NT2") ||
    key.includes("HSK") ||
    key.includes("JLPT") ||
    key.includes("TOPIK")
  );
}

function formatExamScore(examKey, score) {
  const key = String(examKey || "").toUpperCase();
  if (key.includes("JLPT")) return `N${score}`;
  if (key.includes("TOPIK") || key.includes("HSK") || key.includes("TESTDAF") || key.includes("DSH")) {
    return `${translateWord("level_word", "Level")} ${score}`;
  }
  return formatExamValue(examKey, score, {
    context: "requirement",
    locale: getCurrentLanguage(),
  });
}

export function splitExamEntries(obj) {
  const lang = [];
  const acad = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined) continue;
    (isLanguageExam(k) ? lang : acad).push([k, v]);
  }
  return { lang, acad };
}

function getLanguageExamConfig(examId, langCode = "") {
  const target = String(examId || "").trim();
  if (!target) return null;
  const groups = LANG_CONFIG?.language_exams || {};
  const normalizedLang = String(langCode || "").trim().toLowerCase();
  if (normalizedLang && Array.isArray(groups[normalizedLang])) {
    const exact = groups[normalizedLang].find((row) => String(row?.id || "").trim() === target);
    if (exact) return exact;
  }
  for (const arr of Object.values(groups)) {
    if (!Array.isArray(arr)) continue;
    const exact = arr.find((row) => String(row?.id || "").trim() === target);
    if (exact) return exact;
  }
  return null;
}

function getCompositeConfig(examId, opts = {}) {
  const langCfg = getLanguageExamConfig(examId, opts?.langCode || "");
  if (langCfg && typeof langCfg === "object") return langCfg;
  const id = canonicalizeExamId(examId);
  return id ? EXAM_CONFIG?.[id] || null : null;
}

function getCompositeScheme(examId, opts = {}) {
  const scheme = getCompositeConfig(examId, opts)?.breakdown_scheme;
  return scheme && typeof scheme === "object" && !Array.isArray(scheme) ? scheme : null;
}

function normalizeCompositeDefs(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((row) => {
      if (typeof row === "string") {
        const exam = String(row || "").trim();
        return exam ? { exam, label: getExamDisplayName(exam) } : null;
      }
      if (!row || typeof row !== "object") return null;
      const exam = String(row.exam || row.id || row.exam_id || "").trim();
      if (!exam) return null;
      return { exam, label: String(row.label || "").trim() || getExamDisplayName(exam) };
    })
    .filter(Boolean);
}

function findParentBreakdownExam(entries, getId, target) {
  for (const entry of entries) {
    const scheme = entry?.scheme;
    if (!scheme || typeof scheme !== "object") continue;
    const defs = [
      ...normalizeCompositeDefs(scheme.fixed_components),
      ...normalizeCompositeDefs(scheme.selectable_components),
      ...normalizeCompositeDefs(scheme.extra_scores),
    ];
    if (defs.some((row) => String(row.exam || "").trim() === target)) return getId(entry);
  }
  return "";
}

function getCompositeParentExam(examId, opts = {}) {
  const target = String(examId || "").trim();
  if (!target) return "";
  const academicParent = findParentBreakdownExam(
    Object.entries(EXAM_CONFIG || {}).map(([parentId, cfg]) => ({ parentId, scheme: cfg?.breakdown_scheme })),
    (entry) => String(entry.parentId || "").trim(),
    target
  );
  if (academicParent) return academicParent;

  const groups = LANG_CONFIG?.language_exams || {};
  const langCode = String(opts?.langCode || "").trim().toLowerCase();
  const lists = langCode && Array.isArray(groups[langCode])
    ? [groups[langCode]]
    : Object.values(groups).filter((row) => Array.isArray(row));
  for (const arr of lists) {
    const langParent = findParentBreakdownExam(
      arr.map((cfg) => ({ id: cfg?.id, scheme: cfg?.breakdown_scheme })),
      (entry) => String(entry.id || "").trim(),
      target
    );
    if (langParent) return langParent;
  }

  return "";
}

function localizeCompositeLabel(label) {
  const norm = String(label || "").trim().toLowerCase();
  if (norm === "overall") return t("exam.component.overall", "Overall");
  if (norm === "total") return t("exam.component.total", "Total");
  if (norm === "listening") return t("exam.component.listening", "Listening");
  if (norm === "reading") return t("exam.component.reading", "Reading");
  if (norm === "writing") return t("exam.component.writing", "Writing");
  if (norm === "speaking") return t("exam.component.speaking", "Speaking");
  return label;
}

function compositeChildLabel(parentExamId, childExamId, opts = {}) {
  const localized = getExamDisplayName(childExamId, opts);
  if (localized) {
    const rawExamId = String(childExamId || "").trim().toLowerCase();
    if (rawExamId.includes("listening")) return t("exam.component.listening", localized);
    if (rawExamId.includes("reading")) return t("exam.component.reading", localized);
    if (rawExamId.includes("writing")) return t("exam.component.writing", localized);
    if (rawExamId.includes("speaking")) return t("exam.component.speaking", localized);
    return localized;
  }
  const scheme = getCompositeScheme(parentExamId, opts);
  const defs = [
    ...normalizeCompositeDefs(scheme?.fixed_components),
    ...normalizeCompositeDefs(scheme?.selectable_components),
    ...normalizeCompositeDefs(scheme?.extra_scores),
  ];
  const found = defs.find((row) => String(row.exam || "").trim() === String(childExamId || "").trim());
  if (found?.label) return localizeCompositeLabel(found.label);
  return localizeCompositeLabel(String(childExamId || "").trim());
}

function compositeEntryOrder(parentExamId, examId, opts = {}) {
  if (!parentExamId || parentExamId === examId) return -1;
  const scheme = getCompositeScheme(parentExamId, opts);
  const order = [
    ...normalizeCompositeDefs(scheme?.fixed_components),
    ...normalizeCompositeDefs(scheme?.selectable_components),
    ...normalizeCompositeDefs(scheme?.extra_scores),
  ].map((row) => String(row.exam || "").trim());
  const idx = order.indexOf(String(examId || "").trim());
  return idx >= 0 ? idx : 10_000;
}

export function renderGroupedExamPairRows(pairs, opts = {}) {
  const list = Array.isArray(pairs) ? pairs : [];
  if (!list.length) return "";

  const groups = [];
  const groupMap = new Map();

  list.forEach(([exam, score], originalIndex) => {
    const examId = String(exam || "").trim();
    if (!examId) return;
    const parentExamId = getCompositeParentExam(examId, opts) || examId;
    const groupId = parentExamId || examId;
    if (!groupMap.has(groupId)) {
      const group = {
        exam: groupId,
        entries: [],
        firstIndex: originalIndex,
      };
      groupMap.set(groupId, group);
      groups.push(group);
    }
    groupMap.get(groupId).entries.push({ exam: examId, score, originalIndex });
  });

  return groups
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((group) => {
      const parentExamId = group.exam;
      const parentLabel = getExamDisplayName(parentExamId, opts);
      const hasCompositeChildren = group.entries.some((row) => row.exam !== parentExamId);
      const sortedEntries = group.entries.toSorted((a, b) => {
        const left = compositeEntryOrder(parentExamId, a.exam, opts);
        const right = compositeEntryOrder(parentExamId, b.exam, opts);
        if (left !== right) return left - right;
        return a.originalIndex - b.originalIndex;
      });

      if (!hasCompositeChildren && sortedEntries.length === 1 && sortedEntries[0].exam === parentExamId) {
        const item = sortedEntries[0];
        return `<div><strong>${escapeHtml(getExamDisplayName(item.exam, opts))}:</strong> ${escapeHtml(formatExamScore(item.exam, item.score))}</div>`;
      }

      const scheme = getCompositeScheme(parentExamId, opts);
      const totalLabelRaw = String(scheme?.parent_score_label || "").trim() || translateWord("total_per_year", "Total").split("/")[0].trim() || "Total";
      const totalLabel = localizeCompositeLabel(totalLabelRaw);
      return `
        <div class="track-exam-entry-group">
          <div class="track-exam-entry-group-title"><strong>${escapeHtml(parentLabel)}</strong></div>
          <div class="track-exam-entry-group-list">
            ${sortedEntries.map((item) => {
              const label = item.exam === parentExamId
                ? totalLabel
                : compositeChildLabel(parentExamId, item.exam, opts);
              return `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(formatExamScore(item.exam, item.score))}</div>`;
            }).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function examGroupToneClass(tone) {
  if (tone === "info") return "track-exam-group--info";
  if (tone === "success") return "track-exam-group--success";
  return "track-exam-group--neutral";
}

export function renderExamGroup(title, pairs, tone = "neutral") {
  if (!pairs.length) return "";
  const toneClass = examGroupToneClass(tone);
  return `
      <div class="track-exam-group ${toneClass}">
      <div class="track-exam-group-title">
          ${title}
      </div>
      <div class="track-exam-group-list">
          ${renderGroupedExamPairRows(pairs)}
      </div>
      </div>
  `;
}

export function admissionChoiceKey(category, profile, funding = null) {
  const parts = [
    String(category?.id || "").trim(),
    String(profile?.id || "").trim(),
    String(funding?.id || "").trim(),
  ].filter(Boolean);
  return parts.join("::");
}

function admissionFundingOptions(category, profile) {
  const profileOptions = Array.isArray(profile?.funding_options)
    ? profile.funding_options.filter(isPlainObject)
    : [];
  if (profileOptions.length) return profileOptions;
  const categoryOptions = Array.isArray(category?.funding_options)
    ? category.funding_options.filter(isPlainObject)
    : [];
  return categoryOptions;
}

export function getGrantsFromCategories(categories) {
  const choices = getAdmissionChoicesFromCategories(categories);
  const grants = [];
  const seenIds = new Set();
  choices.forEach(choice => {
    if (choice.funding_type === "grant" && choice.funding_program) {
      if (!seenIds.has(choice.funding_program)) {
        seenIds.add(choice.funding_program);
        grants.push({
          id: choice.id,
          name: choice.funding_program,
          source: choice.funding_source,
          description: choice.funding_description || choice.description,
          track_badge: choice.track_badge || "Grant"
        });
      }
    }
  });
  return grants;
}

export function getAdmissionChoicesFromCategories(categories) {
  if (!Array.isArray(categories)) return [];
  const choices = [];
  categories.forEach((category) => {
    if (!isPlainObject(category)) return;
    const profiles = Array.isArray(category.requirement_profiles)
      ? category.requirement_profiles.filter(isPlainObject)
      : [];
    const effectiveProfiles = profiles.length
      ? profiles
      : [{ id: "general", label: category.label || "General requirements" }];

    effectiveProfiles.forEach((profile) => {
      const options = admissionFundingOptions(category, profile);
      const effectiveOptions = options.length ? options : [null];
      effectiveOptions.forEach((funding, fundingIdx) => {
        const baseRequirements = mergeTrackVariantDict(category.requirements, profile.requirements) || {};
        const fundingRequirements = isPlainObject(funding?.requirements) ? { ...funding.requirements } : {};
        const mergedRequirements = mergeTrackVariantDict(
          baseRequirements,
          fundingRequirements,
        );
        const scoreProfile = funding?.score_profile || profile.score_profile || category.score_profile;
        const key = admissionChoiceKey(category, profile, funding);
        const choice = {
          ...category,
          ...profile,
          ...funding,
          id: key || String(profile.id || category.id || `choice:${fundingIdx}`),
          choice_key: key,
          category_id: String(category.id || "").trim(),
          category_label: category.label,
          requirement_profile_id: String(profile.id || "").trim(),
          requirement_profile_label: profile.label,
          funding_option_id: String(funding?.id || "").trim(),
          requirements: mergedRequirements || {},
          base_requirements: baseRequirements,
          funding_requirements: fundingRequirements,
          stats_avg: filterStatsAvgForRequirements(
            mergeTrackVariantDict(mergeTrackVariantDict(category.stats_avg, profile.stats_avg), funding?.stats_avg),
            mergedRequirements,
          ) || {},
          finance_override: mergeTrackVariantDict(
            mergeTrackVariantDict(category.finance_override, profile.finance_override),
            funding?.finance_override,
          ) || null,
          published_admission: mergeTrackVariantDict(
            category.published_admission,
            profile.published_admission,
          ) || null,
          language_requirements: funding?.language_requirements || profile.language_requirements || category.language_requirements || [],
          language_requirements_mode: funding?.language_requirements_mode || profile.language_requirements_mode || category.language_requirements_mode,
          extra_requirements: funding?.extra_requirements || profile.extra_requirements || category.extra_requirements || [],
          scholarships: profile.scholarships || category.scholarships || [],
          applicable_majors: profile.applicable_majors || category.applicable_majors || [],
          scope: profile.scope || category.scope || "general",
          program_ids: profile.program_ids || category.program_ids || [],
          program_names: profile.program_names || category.program_names || [],
          __funding_option_index: fundingIdx,
          __is_funding_option: Boolean(funding),
        };
        if (isPlainObject(scoreProfile)) {
          choice.score_profile = { ...scoreProfile };
        }
        choices.push(choice);
      });
    });
  });
  return choices;
}

export function chanceNoDataHelpNote(uniChance) {
  if (uniChance && String(uniChance.scoreMeaning || "").trim() !== "published_requirements_met_percent") {
    return t("admission.requirements_fit.unavailable_method", "Requirements fit score is unavailable because its meaning could not be confirmed.");
  }
  const reason = String(uniChance?.reason || "").trim().toLowerCase();
  if (reason === "funding_selection_separate") return t("university.admissions.catalog.reason.funding_selection_separate");
  if (reason === "no_published_requirements") return t("admission.requirements_fit.no_published_requirements", "This route has no measurable published minimums, so a requirements fit percentage cannot be calculated. Review the official application requirements.");
  if (reason === "unassessed_minimums") return t("admission.requirements_fit.unassessed_minimums", "Published minimums cannot be assessed with the available profile fields, so no requirements fit percentage is calculated.");
  if (reason === "requirements_not_reviewed") return t("admission.requirements_fit.requirements_not_reviewed", "Published academic and language minimums have not yet been reviewed for this route. Check the official program page before applying.");
  if (reason === "applicability_unknown") return t("admission.requirements_fit.applicability_unknown", "The published requirements could not be matched to this program, applicant route, and entry cycle. Confirm the applicable route on the official page.");
  if (reason === "no_choices") return t("admission.requirements_fit.no_applicable_path", "No assessed path matches this context. Review the selected route and entry cycle against the official requirements.");
  if (reason === "requirements_not_met") {
    return t(
      "admission.chance.requirements_not_met",
      "Your current results do not meet a required minimum for this admission choice."
    );
  }
  if (reason === "missing_evidence") {
    return t(
      "admission.chance.missing_evidence",
      "Add the required exam scores or language evidence to check this route."
    );
  }
  if (reason === "missing_exam_score") {
    return t(
      "admission.chance.need_exam_data_track",
      "Add the required exam data to see a fit score for this requirement profile."
    );
  }
  return t(
    "admission.requirements_fit.insufficient_data",
    "There is not enough applicable requirements or profile evidence to calculate this fit score."
  );
}

export function renderTrackFundingBadge(track) {
  const rawType = String(track?.funding_type || "").trim().toLowerCase();
  const badgeRaw = String(track?.track_badge || "").trim();
  if (!rawType && !badgeRaw) return "";
  const isGrant = rawType === "grant" || /grant|scholar/i.test(badgeRaw);
  const fallback = isGrant ? translateWord("filter_grant", "Grant") : translateWord("filter_paid", "Paid");
  const translatedBadge = badgeRaw ? translateAdmissionText(badgeRaw, badgeRaw) : "";
  const text = badgeRaw ? translateTrackLabel(translatedBadge, translatedBadge) : fallback;
  const cls = isGrant ? "track-funding-badge--grant" : "track-funding-badge--paid";
  return `<span class="track-funding-badge ${cls}">${escapeHtml(text)}</span>`;
}

export function getTrackFundingType(track) {
  const rawType = String(track?.funding_type || "").trim().toLowerCase();
  if (rawType === "grant" || rawType === "paid") return rawType;
  const badgeRaw = String(track?.track_badge || "").trim().toLowerCase();
  return /grant|scholar/.test(badgeRaw) ? "grant" : "paid";
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeTrackVariantDict(baseValue, variantValue) {
  const baseObj = isPlainObject(baseValue) ? baseValue : null;
  const variantObj = isPlainObject(variantValue) ? variantValue : null;

  if (baseObj && variantObj) return { ...baseObj, ...variantObj };
  if (variantObj) return { ...variantObj };
  if (baseObj) return { ...baseObj };
  if (variantValue !== undefined && variantValue !== null) return variantValue;
  if (baseValue !== undefined && baseValue !== null) return baseValue;
  return null;
}

function filterStatsAvgForRequirements(statsAvg, requirements) {
  const statsObj = isPlainObject(statsAvg) ? statsAvg : null;
  const reqObj = isPlainObject(requirements) ? requirements : null;
  if (!statsObj) return statsAvg;
  if (!reqObj || !Object.keys(reqObj).length) return { ...statsObj };

  const allowed = new Set(
    Object.keys(reqObj)
      .filter((key) => !isLanguageExam(key))
      .map((key) => canonicalizeExamId(key))
      .filter(Boolean)
  );
  if (!allowed.size) return { ...statsObj };

  const filtered = {};
  for (const [key, value] of Object.entries(statsObj)) {
    const canonical = canonicalizeExamId(key);
    if (canonical && allowed.has(canonical)) filtered[key] = value;
  }
  return filtered;
}
