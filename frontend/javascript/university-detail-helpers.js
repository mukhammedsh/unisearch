import { EXAM_CONFIG, LANG_CONFIG, aiName, canonicalizeExamId, escapeHtml, escapeHtmlAttr, formatExamValue, getExamDisplayName } from "./utils.js";
import { getCurrentLanguage, t } from "./i18n.js";
import { heroIcon } from "./icons.js";
import { translateAdmissionText, translateTrackLabel, translateUnknownWord, translateWord } from "./university-translations.js";

export function mapMarkerLogoHtml(logoUrl) {
  const safeLogoUrl = escapeHtml(logoUrl);
  return `<div class="map-marker-container"><img class="marker-img-inner" src="${safeLogoUrl}" alt="" loading="lazy" decoding="async" data-parent-error-class="no-logo" data-remove-on-error="1"></div>`;
}

export function clusterMarkerLogoHtml(logoUrl, extraCount) {
  const count = Number.isFinite(Number(extraCount)) ? Number(extraCount) : 0;
  return `<div class="cluster-node-fix">${mapMarkerLogoHtml(logoUrl)}<div class="cluster-badge">+${count}</div></div>`;
}

export function applyPercentWidths(rootEl) {
  if (!rootEl) return;
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

function getCompositeParentExam(examId, opts = {}) {
  const target = String(examId || "").trim();
  if (!target) return "";
  const academicEntries = Object.entries(EXAM_CONFIG || {});
  for (const [parentId, cfg] of academicEntries) {
    const scheme = cfg?.breakdown_scheme;
    if (!scheme || typeof scheme !== "object") continue;
    const defs = [
      ...normalizeCompositeDefs(scheme.fixed_components),
      ...normalizeCompositeDefs(scheme.selectable_components),
      ...normalizeCompositeDefs(scheme.extra_scores),
    ];
    if (defs.some((row) => String(row.exam || "").trim() === target)) return String(parentId || "").trim();
  }

  const groups = LANG_CONFIG?.language_exams || {};
  const langCode = String(opts?.langCode || "").trim().toLowerCase();
  const lists = langCode && Array.isArray(groups[langCode])
    ? [groups[langCode]]
    : Object.values(groups).filter((row) => Array.isArray(row));
  for (const arr of lists) {
    for (const cfg of arr) {
      const scheme = cfg?.breakdown_scheme;
      if (!scheme || typeof scheme !== "object") continue;
      const defs = [
        ...normalizeCompositeDefs(scheme.fixed_components),
        ...normalizeCompositeDefs(scheme.selectable_components),
        ...normalizeCompositeDefs(scheme.extra_scores),
      ];
      if (defs.some((row) => String(row.exam || "").trim() === target)) return String(cfg?.id || "").trim();
    }
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
      const sortedEntries = group.entries.slice().sort((a, b) => {
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

function examGroupToneClass(color) {
  if (color === "#2563eb") return "track-exam-group--info";
  if (color === "#047857") return "track-exam-group--success";
  return "track-exam-group--neutral";
}

export function renderExamGroup(title, pairs, color) {
  if (!pairs.length) return "";
  const toneClass = examGroupToneClass(color);
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
          ...(funding || {}),
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

export function chanceTone(chance) {
  const value = Number(chance) || 0;
  if (value >= 80) return { cls: "chance-high", label: t("admission.requirements_fit.strong", "Strong fit") };
  if (value >= 60) return { cls: "chance-good", label: t("admission.requirements_fit.good", "Good fit") };
  if (value >= 40) return { cls: "chance-medium", label: t("admission.requirements_fit.partial", "Partial fit") };
  return { cls: "chance-low", label: t("admission.requirements_fit.low", "Low fit") };
}

function parseChanceValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function chanceNoDataHelpNote(uniChance) {
  if (uniChance && String(uniChance.scoreMeaning || "").trim() !== "published_requirements_met_percent") {
    return t("admission.requirements_fit.unavailable_method", "Requirements fit score is unavailable because its meaning could not be confirmed.");
  }
  const reason = String(uniChance?.reason || "").trim().toLowerCase();
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

export function renderUniChanceSummary(uniChance) {
  const chanceTitle = t("admission.requirements_fit.title", "Fit to published requirements");
  const chanceDescription = t(
    "admission.requirements_fit.description",
    "Share of evaluable published academic and language minimum checks met. This score is not an admission probability."
  );
  if (!uniChance) {
    return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(chanceTitle)}</div>
            <div class="chance-sub">${escapeHtml(chanceDescription)}</div>
          </div>
          <div class="chance-percent-wrap">
            <div class="chance-percent chance-low">?</div>
          </div>
        </div>
        <div class="chance-meter"><div class="chance-fill chance-low" data-width-pct="0"></div></div>
        <div class="chance-inline-note">${escapeHtml(chanceNoDataHelpNote(null))}</div>
        <div class="chance-foot">${escapeHtml(translateUnknownWord("placeholder.field.best_choice", "Best choice"))}</div>
      </div>
    `;
  }
  const scoreMeaning = String(uniChance?.scoreMeaning || "").trim();
  const chanceRaw = scoreMeaning === "published_requirements_met_percent"
    ? parseChanceValue(uniChance?.overallChance)
    : null;
  const activeChoiceRaw = uniChance.reason === "no_choices" ? "" : String(uniChance.bestChoiceLabel || "").trim();
  const activeChoiceLabel = activeChoiceRaw
    ? translateTrackLabel(activeChoiceRaw, activeChoiceRaw)
    : translateUnknownWord("placeholder.field.best_choice", "Best choice");
  const recommendedChoiceRaw = String(uniChance.recommendedChoiceLabel || uniChance.bestChoiceLabel || "").trim();
  const recommendedChoiceLabel = recommendedChoiceRaw
    ? translateTrackLabel(recommendedChoiceRaw, recommendedChoiceRaw)
    : translateUnknownWord("placeholder.field.best_choice", "Best choice");
  const bestKey = String(uniChance?.bestChoiceKey || "").trim();
  const recommendedKey = String(uniChance?.recommendedChoiceKey || "").trim();
  const selectedByUser = Boolean(
    uniChance?.selectedByUser
    && bestKey
    && bestKey !== recommendedKey
  );
  const choiceLabelTitle = selectedByUser
    ? t("admission.choice.selected", "Selected choice")
    : translateWord("best_choice", "Best choice");
  const recommendationFoot = selectedByUser && recommendedChoiceLabel && recommendedChoiceLabel !== activeChoiceLabel
    ? ` • ${escapeHtml(t("admission.choice.recommended", "Recommended"))}: <strong>${escapeHtml(recommendedChoiceLabel)}</strong>`
    : "";

  if (chanceRaw === null) {
    const noDataTitle = t("common.no_data", "No data");
    const helpNote = chanceNoDataHelpNote(uniChance);
    const footContent = activeChoiceRaw
      ? `${escapeHtml(choiceLabelTitle)}: <strong>${escapeHtml(activeChoiceLabel)}</strong>${recommendationFoot}`
      : escapeHtml(t("admission.requirements_fit.title", "Fit to published requirements"));
    return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(chanceTitle)}</div>
            <div class="chance-sub">${escapeHtml(noDataTitle)}</div>
          </div>
          <div class="chance-percent-wrap">
            <div class="chance-percent chance-low">?</div>
          </div>
        </div>
        <div class="chance-meter"><div class="chance-fill chance-low" data-width-pct="0"></div></div>
        ${helpNote ? `<div class="chance-inline-note">${escapeHtml(helpNote)}</div>` : ""}
        <div class="chance-foot">${footContent}</div>
      </div>
    `;
  }
  const chance = chanceRaw;
  const tone = chanceTone(chance);
  return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(chanceTitle)}</div>
            <div class="chance-sub">${escapeHtml(chanceDescription)}</div>
          </div>
          <div class="chance-percent-wrap">
            <div class="chance-percent ${tone.cls}">${chance}%</div>
          </div>
        </div>
        <div class="chance-meter"><div class="chance-fill ${tone.cls}" data-width-pct="${chance}"></div></div>
        <div class="chance-foot">${escapeHtml(choiceLabelTitle)}: <strong>${escapeHtml(activeChoiceLabel)}</strong>${recommendationFoot} • ${escapeHtml(tone.label)}</div>
      </div>
  `;
}

export function renderTrackChanceChip(trackChance) {
  const badgesHtml = renderTrackChanceBadges(trackChance?.badges);

  let chipHtml = "";
  if (!trackChance) {
    chipHtml = `<div class="chance-track-chip">${escapeHtml(chanceNoDataHelpNote(null))}</div>`;
  } else {
    const scoreMeaning = String(trackChance?.scoreMeaning || "").trim();
    const chance = scoreMeaning === "published_requirements_met_percent"
      ? parseChanceValue(trackChance?.chancePercent)
      : null;
    if (chance === null) {
      const noDataLabel = String(
        chanceNoDataHelpNote(trackChance)
        || t("admission.requirements_fit.title", "Fit to published requirements")
      ).trim() || t("admission.requirements_fit.title", "Fit to published requirements");
      chipHtml = `<div class="chance-track-chip">${escapeHtml(noDataLabel)}</div>`;
    } else {
      const tone = chanceTone(chance);
      chipHtml = `<div class="chance-track-chip ${tone.cls}">${escapeHtml(t("admission.requirements_fit.short", "Requirements fit"))} ${chance}%</div>`;
    }
  }

  return `${badgesHtml}${chipHtml}`;
}

export function renderTrackFactors(trackChance) {
  if (String(trackChance?.scoreMeaning || "").trim() !== "published_requirements_met_percent") return "";
  if (trackChance?.reason === "no_published_requirements") return "";
  const requirementFactorKeys = ["applicability_unknown", "missing_evidence", "insufficient_data", "requirements_met", "requirements_gap"];
  const factors = Array.isArray(trackChance?.factors)
    ? trackChance.factors.filter((factor) => requirementFactorKeys.includes(String(factor?.key || "")))
    : [];
  const factorChips = factors.map(renderTrackFactorChip).filter(Boolean);
  if (!factorChips.length) return "";

  return `
    <div class="track-factors-badges" aria-label="${escapeHtmlAttr(t("admission.chance.factors_label", "Why this estimate changed"))}">
      <span class="track-factors-label">${escapeHtml(t("admission.chance.factors_label", "Why this estimate changed"))}</span>
      ${factorChips.join("")}
    </div>
  `;
}

export function renderRequirementChecks(trackChance) {
  const checks = Array.isArray(trackChance?.details?.checks) ? trackChance.details.checks : [];
  if (!checks.length) return "";
  const statusKeys = {
    met: "admission.requirements_fit.check.met",
    unmet: "admission.requirements_fit.check.unmet",
    missing: "admission.requirements_fit.check.missing",
    unassessed: "admission.requirements_fit.check.unassessed",
  };
  const examAlternatives = t("admission.requirements_fit.check.or", "or");
  const hasOptionalLanguageAlternatives = checks.some((check) => check?.mode === "any");
  return `
    <section class="admission-check-assessments" aria-label="${escapeHtmlAttr(t("admission.requirements_fit.checks_title", "Published requirement checks"))}">
      <h4>${escapeHtml(t("admission.requirements_fit.checks_title", "Published requirement checks"))}</h4>
      ${hasOptionalLanguageAlternatives ? `<p>${escapeHtml(t("admission.requirements_fit.check.language_any_note", "For language rules that allow alternatives, meeting one listed option satisfies that rule."))}</p>` : ""}
      <ul>
        ${checks.map((check) => {
          const exam = String(check?.examId || check?.exam || "").trim();
          if (!exam) return "";
          const examIds = exam.split(/\s+or\s+/i).map((value) => value.trim()).filter(Boolean);
          const label = examIds.map((id) => getExamDisplayName(id, { locale: getCurrentLanguage() }) || id).join(` ${examAlternatives} `);
          const minimum = check.minimum == null ? "" : formatExamValue(exam, check.minimum, { context: "requirement", locale: getCurrentLanguage() });
          const provided = check.provided == null ? "" : (typeof check.provided === "string" && examIds.includes(check.provided)
            ? getExamDisplayName(check.provided, { locale: getCurrentLanguage() })
            : formatExamValue(exam, check.provided, { context: "profile", locale: getCurrentLanguage() }));
          const status = String(check.status || "").trim().toLowerCase();
          const statusLabel = t(
            !minimum && status === "met" ? "admission.requirements_fit.check.evidence_recorded" : (statusKeys[status] || "admission.requirements_fit.check.unassessed"),
            !minimum && status === "met" ? "Evidence recorded" : "Cannot assess",
          );
          const requirementLabel = minimum
            ? `${t("admission.requirements_fit.check.minimum", "Minimum")}: ${minimum}`
            : `${t(examIds.length > 1 ? "admission.requirements_fit.check.required_exam" : "admission.requirements_fit.check.required_evidence", examIds.length > 1 ? "Required exam evidence" : "Required evidence")}`;
          return `<li class="admission-check-assessments__row admission-check-assessments__row--${escapeHtmlAttr(status)}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(requirementLabel)}${check.condition ? `; ${escapeHtml(translateAdmissionText(check.condition, check.condition))}` : ""}</span><span>${escapeHtml(t("admission.requirements_fit.check.profile", "Your profile"))}: ${escapeHtml(provided || (status === "unassessed" ? t("admission.requirements_fit.check.profile_unassessed", "This profile cannot establish the required evidence or exemption.") : t("admission.requirements_fit.check.not_provided", "Not provided")))}</span><span class="admission-check-assessments__status">${escapeHtml(statusLabel)}</span></li>`;
        }).join("")}
      </ul>
    </section>
  `;
}

function normalizeTrackBadgeKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  if (key === "missing_curriculum" || key === "foundation_required") return "foundation_required";
  if (key === "need_aware_penalty" || key === "need_aware") return "need_aware";
  if (key === "need_blind") return "need_blind";
  return "";
}

function trackBadgeConfig(value) {
  const key = normalizeTrackBadgeKey(value);
  if (key === "foundation_required") {
    return {
      cls: "admission-chance-badge--warn",
      icon: "exclamation-triangle",
      label: t("admission.chance.badge.foundation_required", "Foundation may be required"),
      note: t("admission.chance.badge.foundation_required_note", "Direct bachelor entry may require A-Levels, IB, AP, SAT, or a foundation route."),
    };
  }
  if (key === "need_aware") {
    return {
      cls: "admission-chance-badge--warn",
      icon: "exclamation-triangle",
      label: t("admission.chance.badge.need_aware", "Need-aware aid"),
      note: t("admission.chance.badge.need_aware_note", "Requesting significant financial aid can affect admission at this institution."),
    };
  }
  if (key === "need_blind") {
    return {
      cls: "admission-chance-badge--neutral",
      icon: "information-circle",
      label: t("admission.chance.badge.need_blind", "Need-blind review"),
      note: t("admission.chance.badge.need_blind_note", "Financial need is not expected to lower the admission review in this estimate."),
    };
  }
  return null;
}

function renderTrackChanceBadges(badges) {
  if (!Array.isArray(badges) || !badges.length) return "";
  const rendered = badges.map((badge) => {
    const config = trackBadgeConfig(badge);
    if (!config) return "";
    const note = String(config.note || "").trim();
    const label = String(config.label || "").trim();
    const innerBadgeHtml = `
      ${heroIcon(config.icon, "ui-icon ui-icon--14 admission-chance-badge__icon")}
      <span>${escapeHtml(label)}</span>
    `;
    if (!note) {
      return `
        <span class="admission-chance-badge ${config.cls}" aria-label="${escapeHtmlAttr(label)}">
          ${innerBadgeHtml}
        </span>
      `;
    }
    return `
      <span class="ui-tooltip-wrap admission-chance-badge-wrap">
        <button type="button" class="ui-tooltip-trigger admission-chance-badge ${config.cls}" aria-label="${escapeHtmlAttr(`${label}: ${note}`)}" aria-expanded="false">
          ${innerBadgeHtml}
        </button>
        <span class="ui-tooltip-bubble admission-chance-tooltip__content" role="tooltip">
          <strong class="ui-tooltip-title">${escapeHtml(label)}</strong>
          <span class="ui-tooltip-text">${escapeHtml(note)}</span>
        </span>
      </span>
    `;
  }).filter(Boolean);
  return rendered.join("");
}

function factorTone(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "positive") return { cls: "factor-positive", icon: "check-circle" };
  if (normalized === "negative") return { cls: "factor-negative", icon: "exclamation-triangle" };
  return { cls: "factor-neutral", icon: "information-circle" };
}

const TRACK_FACTOR_I18N_KEYS = new Set([
  "applicability_unknown",
  "missing_evidence",
  "insufficient_data",
  "requirements_met",
  "requirements_gap",
]);

function normalizeTrackFactorKey(value) {
  return String(value || "").trim().toLowerCase();
}

function localizedTrackFactorText(factor) {
  const key = normalizeTrackFactorKey(factor?.key);
  const labelFallback = String(factor?.label || "").trim();
  const messageFallback = String(factor?.message || factor?.impact_text || "").trim();
  if (!TRACK_FACTOR_I18N_KEYS.has(key)) {
    return { label: labelFallback, message: messageFallback };
  }
  return {
    label: t(`admission.chance.factor.${key}.label`, labelFallback),
    message: t(`admission.chance.factor.${key}.message`, messageFallback),
  };
}

function renderTrackFactorChip(factor) {
  if (!factor || typeof factor !== "object" || Array.isArray(factor)) return "";
  const { label, message } = localizedTrackFactorText(factor);
  if (!label && !message) return "";

  const tone = factorTone(factor.status);
  const text = label && message ? `${label}: ${message}` : (label || message);
  const hint = t("admission.chance.factor_hint", "Planning signal only; not an exact causal contribution.");
  const ariaLabel = `${text}. ${hint}`;
  return `
    <span class="ui-tooltip-wrap track-factor-chip-wrap">
      <button type="button" class="ui-tooltip-trigger track-factor-chip ${tone.cls}" aria-label="${escapeHtmlAttr(ariaLabel)}" aria-expanded="false">
        ${heroIcon(tone.icon, "ui-icon ui-icon--14 track-factor-chip__icon")}
        <span>${escapeHtml(text)}</span>
      </button>
      <span class="ui-tooltip-bubble track-factor-tooltip__content" role="tooltip">
        <strong class="ui-tooltip-title">${escapeHtml(label || text)}</strong>
        ${label && message ? `<span class="ui-tooltip-text">${escapeHtml(message)}</span>` : ""}
        <span class="ui-tooltip-text ui-tooltip-text--subtle">${escapeHtml(hint)}</span>
      </span>
    </span>
  `;
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

function isPlainObject(value) {
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
