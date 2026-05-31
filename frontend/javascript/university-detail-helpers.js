import { EXAM_CONFIG, LANG_CONFIG, aiName, canonicalizeExamId, escapeHtml, escapeHtmlAttr, formatExamValue, getExamDisplayName } from "./utils.js";
import { getCurrentLanguage, t } from "./i18n.js";
import { heroIcon } from "./icons.js";
import { translateAdmissionText, translateTrackLabel, translateUnknownField, translateUnknownWord, translateWord } from "./university-translations.js";

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

function compositeChildLabel(parentExamId, childExamId, opts = {}) {
  const localized = getExamDisplayName(childExamId, opts);
  if (localized) return localized;
  const scheme = getCompositeScheme(parentExamId, opts);
  const defs = [
    ...normalizeCompositeDefs(scheme?.fixed_components),
    ...normalizeCompositeDefs(scheme?.selectable_components),
    ...normalizeCompositeDefs(scheme?.extra_scores),
  ];
  const found = defs.find((row) => String(row.exam || "").trim() === String(childExamId || "").trim());
  if (found?.label) return found.label;
  return String(childExamId || "").trim();
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
      const totalLabel = String(scheme?.parent_score_label || "").trim() || translateWord("total_per_year", "Total").split("/")[0].trim() || "Total";
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

function cefrLabel(id) {
  const n = Number(id);
  if (n === 1) return "A1";
  if (n === 2) return "A2";
  if (n === 3) return "B1";
  if (n === 4) return "B2";
  if (n === 5) return "C1";
  if (n === 6) return "C2";
  return String(id);
}

export function renderLanguageRequirements(track) {
  const list = Array.isArray(track?.language_requirements) ? track.language_requirements : [];
  if (!list.length) {
    return `
      <div class="track-lang-rules">
        <div class="track-lang-rules-title">
          ${escapeHtml(translateWord("language_track_rules", "LANGUAGE TRACK RULES"))}
        </div>
        <div class="track-muted-italic">${escapeHtml(translateUnknownWord("placeholder.field.language_requirements", "Language requirements"))}</div>
      </div>
    `;
  }

  const mode = String(track?.language_requirements_mode || "all").toLowerCase() === "any" ? "any" : "all";
  const modeText = mode === "any"
    ? translateWord("lang_mode_any", "Any one language proof is enough")
    : translateWord("lang_mode_all", "All listed language proofs are required");

  return `
      <div class="track-lang-rules">
        <div class="track-lang-rules-title">
          ${escapeHtml(translateWord("language_track_rules", "LANGUAGE TRACK RULES"))}
        </div>
        <div class="track-lang-rules-mode">${escapeHtml(modeText)}</div>
        <div class="track-lang-rules-list">
          ${list.map((lr) => {
            const code = String(lr?.code || "").toUpperCase();
            const nativeOk = !!lr?.accept_native;
            const minCefr = lr?.min_cefr != null ? cefrLabel(lr.min_cefr) : null;
            const recCefr = lr?.recommended_cefr != null ? cefrLabel(lr.recommended_cefr) : null;
            const reqPairs = Object.entries(lr?.requirements || {});
            const avgPairs = Object.entries(lr?.stats_avg || {});

            return `
              <div class="track-lang-rule-card">
                <div class="track-lang-rule-head">
                  <span class="track-lang-rule-code">
                    ${escapeHtml(code || "LANG")}
                  </span>
                  ${nativeOk ? `<span class="track-lang-rule-native">${escapeHtml(translateWord("native_accepted", "Native accepted"))}</span>` : ""}
                </div>
                ${(minCefr || recCefr) ? `
                  <div class="track-lang-rule-cefr">
                    ${minCefr ? `<span><strong>${escapeHtml(translateWord("min_cefr", "Min CEFR"))}:</strong> ${escapeHtml(minCefr)}</span>` : ""}
                    ${(minCefr && recCefr) ? `<span> • </span>` : ""}
                    ${recCefr ? `<span><strong>${escapeHtml(translateWord("recommended", "Recommended"))}:</strong> ${escapeHtml(recCefr)}</span>` : ""}
                  </div>
                ` : ""}
                ${reqPairs.length ? `
                  <div class="track-lang-rule-requirements">
                    <strong>${escapeHtml(translateWord("exam_minimums", "Exam minimums"))}:</strong>
                    ${renderGroupedExamPairRows(reqPairs, { langCode: lr?.code })}
                  </div>
                ` : `
                  <div class="track-lang-rule-requirements">
                    <strong>${escapeHtml(translateWord("exam_minimums", "Exam minimums"))}:</strong>
                    <div class="track-muted-italic">${escapeHtml(translateUnknownField(translateWord("exam_minimums", "Exam minimums"), "Exam minimums"))}</div>
                  </div>
                `}
                <div class="track-lang-rule-average">
                  <strong>${escapeHtml(translateWord("real_average_admitted", "Average admitted"))}:</strong>
                  ${avgPairs.length
                    ? renderGroupedExamPairRows(avgPairs, { langCode: lr?.code })
                    : `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`}
                </div>
              </div>
            `;
          }).join("")}
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
  if (value >= 80) return { cls: "chance-high", label: translateWord("high_chance", "High chance") };
  if (value >= 60) return { cls: "chance-good", label: translateWord("good_chance", "Good chance") };
  if (value >= 40) return { cls: "chance-medium", label: translateWord("moderate_chance", "Moderate chance") };
  return { cls: "chance-low", label: translateWord("low_chance", "Low chance") };
}

function parseChanceValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function chanceModelShort(model) {
  const raw = String(model || "").trim().toLowerCase();
  if (raw === "estimated_fallback") {
    return t("admission.chance_method.estimated_short", "Estimated");
  }
  if (raw === "official_score_profile") {
    return t("admission.chance_method.profile_short", "Profile-based");
  }
  return "";
}

function chanceModelDetail(model) {
  const raw = String(model || "").trim().toLowerCase();
  if (raw === "estimated_fallback") {
    return t(
      "admission.chance_method.estimated_detail",
      "Estimated from published minimums, averages where available, language rules, selectivity, and affordability. Lower confidence than admitted-score profiles."
    );
  }
  if (raw === "official_score_profile") {
    return t(
      "admission.chance_method.profile_detail",
      "Based on admitted-score profiles plus your language, affordability, and feasibility context."
    );
  }
  return "";
}

function chanceAccuracyNote(model) {
  const raw = String(model || "").trim().toLowerCase();
  if (raw === "estimated_fallback") {
    return t("admission.chance_accuracy.low", "Low confidence");
  }
  return "";
}

function chanceNoDataHelpNote(uniChance) {
  const reason = String(uniChance?.reason || "").trim().toLowerCase();
  if (reason !== "missing_exam_score") return "";
  return t(
    "admission.chance.need_exam_data_track",
    "Need exam data to see the chance for this requirement profile."
  );
}

export function renderUniChanceSummary(uniChance) {
  if (!uniChance) {
    const chanceTitle = translateWord("admission_probability_title", "Admission Probability");
    return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(chanceTitle)}</div>
            <div class="chance-sub">${escapeHtml(translateUnknownField(chanceTitle, "Admission probability"))}</div>
          </div>
          <div class="chance-percent chance-low">?</div>
        </div>
        <div class="chance-meter"><div class="chance-fill chance-low" data-width-pct="0"></div></div>
        <div class="chance-foot">${escapeHtml(translateUnknownWord("placeholder.field.best_choice", "Best choice"))}</div>
      </div>
    `;
  }
  const chanceRaw = parseChanceValue(uniChance?.overallChance);
  if (chanceRaw === null) {
    const noDataTitle = t("common.no_data", "No data");
    const noDataLabel = String(
      uniChance?.label || translateUnknownWord("placeholder.field.admission_probability", "Admission probability")
    ).trim() || translateUnknownWord("placeholder.field.admission_probability", "Admission probability");
    const helpNote = chanceNoDataHelpNote(uniChance) || (noDataLabel !== noDataTitle ? noDataLabel : "");
    return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(translateWord("admission_probability_title", "Admission Probability"))}</div>
            <div class="chance-sub">${escapeHtml(noDataTitle)}</div>
          </div>
          <div class="chance-percent chance-low">?</div>
        </div>
        <div class="chance-meter"><div class="chance-fill chance-low" data-width-pct="0"></div></div>
        ${helpNote ? `<div class="chance-inline-note">${escapeHtml(helpNote)}</div>` : ""}
        <div class="chance-foot">${escapeHtml(translateUnknownWord("placeholder.field.admission_probability", "Admission probability"))}</div>
      </div>
    `;
  }
  const chance = chanceRaw;
  const tone = chanceTone(chance);
  const chanceModel = String(uniChance?.chanceModel || "").trim();
  const chanceSub = chanceModelDetail(chanceModel)
    || translateWord("admission_probability_sub", "Estimated from your profile, minimum requirements, language rules, selectivity, and affordability context.");
  const chanceMethodShort = chanceModelShort(chanceModel);
  const chanceAccuracy = chanceAccuracyNote(chanceModel);
  const chancePercentClass = chanceAccuracy ? "chance-low-confidence" : tone.cls;
  const activeChoiceRaw = String(uniChance.bestChoiceLabel || "").trim();
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
  return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(translateWord("admission_probability_title", "Admission Probability"))}</div>
            <div class="chance-sub">${escapeHtml(chanceSub)}</div>
          </div>
          <div class="chance-percent-wrap">
            <div class="chance-percent ${chancePercentClass}">${chance}%</div>
            ${chanceAccuracy ? `<div class="chance-percent-note">${escapeHtml(chanceAccuracy)}</div>` : ""}
          </div>
        </div>
        <div class="chance-meter"><div class="chance-fill ${tone.cls}" data-width-pct="${chance}"></div></div>
        <div class="chance-foot">${escapeHtml(choiceLabelTitle)}: <strong>${escapeHtml(activeChoiceLabel)}</strong>${recommendationFoot} • ${escapeHtml(tone.label)}${chanceMethodShort ? ` • ${escapeHtml(chanceMethodShort)}` : ""}</div>
      </div>
  `;
}

export function renderTrackChanceChip(trackChance) {
  const badgesHtml = renderTrackChanceBadges(trackChance?.badges);

  let chipHtml = "";
  if (!trackChance) {
    chipHtml = `<div class="chance-track-chip">${escapeHtml(translateUnknownWord("placeholder.field.admission_probability", "Admission probability"))}</div>`;
  } else {
    const chance = parseChanceValue(trackChance?.chancePercent);
    if (chance === null) {
      const noDataLabel = String(
        trackChance?.label || translateUnknownWord("placeholder.field.admission_probability", "Admission probability")
      ).trim() || translateUnknownWord("placeholder.field.admission_probability", "Admission probability");
      chipHtml = `<div class="chance-track-chip">${escapeHtml(noDataLabel)}</div>`;
    } else {
      const tone = chanceTone(chance);
      chipHtml = `<div class="chance-track-chip ${tone.cls}">${escapeHtml(aiName("chance"))} ${chance}%</div>`;
    }
  }

  return `${badgesHtml}${chipHtml}`;
}

export function renderTrackFactors(trackChance) {
  const factors = Array.isArray(trackChance?.factors) ? trackChance.factors : [];
  const factorChips = factors.map(renderTrackFactorChip).filter(Boolean);
  if (!factorChips.length) return "";

  return `
    <div class="track-factors-badges" aria-label="${escapeHtmlAttr(t("admission.chance.factors_label", "Why this estimate changed"))}">
      <span class="track-factors-label">${escapeHtml(t("admission.chance.factors_label", "Why this estimate changed"))}</span>
      ${factorChips.join("")}
    </div>
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
    return `
      <span class="admission-chance-badge ${config.cls}" title="${escapeHtmlAttr(config.note)}" aria-label="${escapeHtmlAttr(`${config.label}. ${config.note}`)}">
        ${heroIcon(config.icon, "ui-icon ui-icon--14 admission-chance-badge__icon")}
        <span>${escapeHtml(config.label)}</span>
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
  "missing_evidence",
  "conditional_requirements",
  "requirements_gap",
  "academic_strength",
  "academic_gap",
  "language_strength",
  "language_gap",
  "affordability_fit",
  "affordability_gap",
  "scholarship_support",
  "high_selectivity",
  "accessibility_signal",
  "insufficient_data",
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
  const title = `${text}. ${t("admission.chance.factor_hint", "Planning signal only; not an exact causal contribution.")}`;
  return `
    <span class="track-factor-chip ${tone.cls}" title="${escapeHtmlAttr(title)}">
      ${heroIcon(tone.icon, "ui-icon ui-icon--14 track-factor-chip__icon")}
      <span>${escapeHtml(text)}</span>
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
