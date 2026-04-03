import { aiName, escapeHtml, formatExamValue, getExamDisplayName, loadProfile } from "./utils.js";
import { getCurrentLanguage, t } from "./i18n.js";
import { translateAdmissionText, translateTrackLabel, translateUnknownField, translateUnknownWord, translateWord } from "./university-translations.js";

const MAP_MARKER_IMG_ONERROR = "if(this.parentNode){this.parentNode.classList.add('no-logo');}this.remove();";

export function mapMarkerLogoHtml(logoUrl) {
  const safeLogoUrl = escapeHtml(logoUrl);
  return `<div class="map-marker-container"><img class="marker-img-inner" src="${safeLogoUrl}" alt="" loading="lazy" decoding="async" onerror="${MAP_MARKER_IMG_ONERROR}"></div>`;
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
          ${pairs.map(([exam, score]) => `
          <div><strong>${escapeHtml(getExamDisplayName(exam))}:</strong> ${escapeHtml(formatExamScore(exam, score))}</div>
          `).join("")}
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
                    ${reqPairs.map(([k, v]) => `<div>${escapeHtml(getExamDisplayName(k, { langCode: lr?.code }))} ≥ ${escapeHtml(String(v))}</div>`).join("")}
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
                    ? avgPairs.map(([k, v]) => `<div>${escapeHtml(getExamDisplayName(k, { langCode: lr?.code }))}: ${escapeHtml(String(v))}</div>`).join("")
                    : `<div class="track-muted-italic">${escapeHtml(translateWord("average_admitted_unavailable", "No verified average admitted data published."))}</div>`}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
  `;
}

export function trackLookupKey(track, idx) {
  const id = String(track?.id || "").trim();
  if (id) return id;
  const label = String(track?.label || "").trim();
  if (label) return `label:${label}`;
  return `track:${idx}`;
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
    if (getCurrentLanguage() === "rus") return "Низкая точность";
    return t("admission.chance_accuracy.low", "Low confidence");
  }
  return "";
}

function chanceNoDataHelpNote(uniChance) {
  const reason = String(uniChance?.reason || "").trim().toLowerCase();
  if (reason !== "missing_exam_score") return "";
  return t(
    "admission.chance.need_exam_data_track",
    "Need exam data to see the chance for this track."
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
        <div class="chance-foot">${escapeHtml(translateUnknownWord("placeholder.field.best_track", "Best track"))}</div>
      </div>
    `;
  }
  const chanceRaw = parseChanceValue(uniChance?.overallChance);
  if (chanceRaw === null) {
    const noDataLabel = String(
      uniChance?.label || translateUnknownWord("placeholder.field.admission_probability", "Admission probability")
    ).trim() || translateUnknownWord("placeholder.field.admission_probability", "Admission probability");
    const helpNote = chanceNoDataHelpNote(uniChance);
    return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(translateWord("admission_probability_title", "Admission Probability"))}</div>
            <div class="chance-sub">${escapeHtml(noDataLabel)}</div>
          </div>
          <div class="chance-percent chance-low">?</div>
        </div>
        <div class="chance-meter"><div class="chance-fill chance-low" data-width-pct="0"></div></div>
        ${helpNote ? `<div class="chance-inline-note">${escapeHtml(helpNote)}</div>` : ""}
        <div class="chance-foot">${escapeHtml(noDataLabel)}</div>
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
  const activeTrackRaw = String(uniChance.bestTrackLabel || "").trim();
  const activeTrackLabel = activeTrackRaw
    ? translateTrackLabel(activeTrackRaw, activeTrackRaw)
    : translateUnknownWord("placeholder.field.best_track", "Best track");
  const recommendedTrackRaw = String(uniChance.recommendedTrackLabel || uniChance.bestTrackLabel || "").trim();
  const recommendedTrackLabel = recommendedTrackRaw
    ? translateTrackLabel(recommendedTrackRaw, recommendedTrackRaw)
    : translateUnknownWord("placeholder.field.best_track", "Best track");
  const selectedByUser = Boolean(
    uniChance?.selectedByUser
    && String(uniChance?.bestTrackKey || "").trim()
    && String(uniChance?.bestTrackKey || "").trim() !== String(uniChance?.recommendedTrackKey || "").trim()
  );
  const trackLabelTitle = selectedByUser
    ? t("admission.track.selected", "Selected track")
    : translateWord("best_track", "Best track");
  const recommendationFoot = selectedByUser && recommendedTrackLabel && recommendedTrackLabel !== activeTrackLabel
    ? ` • ${escapeHtml(t("admission.track.recommended", "Recommended"))}: <strong>${escapeHtml(recommendedTrackLabel)}</strong>`
    : "";
  return `
      <div class="chance-panel">
        <div class="chance-head">
          <div>
            <div class="chance-title">${escapeHtml(aiName("chance"))} ${escapeHtml(t("common.ai_short", "AI"))} - ${escapeHtml(translateWord("admission_probability_title", "Admission Probability"))}</div>
            <div class="chance-sub">${escapeHtml(chanceSub)}</div>
          </div>
          <div class="chance-percent-wrap">
            <div class="chance-percent ${tone.cls}">${chance}%</div>
            ${chanceAccuracy ? `<div class="chance-percent-note">${escapeHtml(chanceAccuracy)}</div>` : ""}
          </div>
        </div>
        <div class="chance-meter"><div class="chance-fill ${tone.cls}" data-width-pct="${chance}"></div></div>
        <div class="chance-foot">${escapeHtml(trackLabelTitle)}: <strong>${escapeHtml(activeTrackLabel)}</strong>${recommendationFoot} • ${escapeHtml(tone.label)}${chanceMethodShort ? ` • ${escapeHtml(chanceMethodShort)}` : ""}</div>
      </div>
  `;
}

export function renderTrackChanceChip(trackChance) {
  if (!trackChance) {
    return `<div class="chance-track-chip">${escapeHtml(translateUnknownWord("placeholder.field.admission_probability", "Admission probability"))}</div>`;
  }
  const chance = parseChanceValue(trackChance?.chancePercent);
  if (chance === null) {
    const noDataLabel = String(
      trackChance?.label || translateUnknownWord("placeholder.field.admission_probability", "Admission probability")
    ).trim() || translateUnknownWord("placeholder.field.admission_probability", "Admission probability");
    return `<div class="chance-track-chip">${escapeHtml(noDataLabel)}</div>`;
  }
  const tone = chanceTone(chance);
  const chanceModel = String(trackChance?.chanceModel || "").trim().toLowerCase();
  const suffix = chanceModel === "estimated_fallback"
    ? ` • ${escapeHtml(chanceModelShort(chanceModel))}`
    : "";
  return `<div class="chance-track-chip ${tone.cls}">${escapeHtml(aiName("chance"))} ${chance}%${suffix}</div>`;
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

function normalizeFundingPreference(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "grant" || raw === "paid") return raw;
  return "any";
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

export function getTrackFundingOptions(track) {
  const baseTrack = isPlainObject(track) ? track : {};
  const rawOptions = Array.isArray(baseTrack.funding_options)
    ? baseTrack.funding_options.filter(isPlainObject)
    : [];

  if (!rawOptions.length) {
    return [{
      ...baseTrack,
      __parent_track_id: String(baseTrack.id || "").trim(),
      __parent_track_label: String(baseTrack.label || "").trim(),
      __funding_option_index: 0,
      __is_funding_option: false,
    }];
  }

  return rawOptions.map((option, optionIdx) => {
    const merged = {
      ...baseTrack,
      ...option,
      requirements: mergeTrackVariantDict(baseTrack.requirements, option.requirements),
      stats_avg: mergeTrackVariantDict(baseTrack.stats_avg, option.stats_avg),
      finance_override: mergeTrackVariantDict(baseTrack.finance_override, option.finance_override),
      __parent_track_id: String(baseTrack.id || "").trim(),
      __parent_track_label: String(baseTrack.label || "").trim(),
      __funding_option_index: optionIdx,
      __is_funding_option: true,
    };

    delete merged.funding_options;

    if (!String(merged.id || "").trim()) merged.id = baseTrack.id;
    if (!String(merged.label || "").trim()) merged.label = baseTrack.label;

    return merged;
  });
}

export function filterTrackFundingOptions(track, fundingFilter = "all") {
  const options = getTrackFundingOptions(track);
  if (fundingFilter === "all") return options;
  return options.filter((option) => getTrackFundingType(option) === fundingFilter);
}

export function trackHasFundingOption(track, fundingFilter = "all") {
  if (fundingFilter === "all") return true;
  return filterTrackFundingOptions(track, fundingFilter).length > 0;
}

export function readAdmissionTrackFilterFromProfile() {
  const profile = loadProfile();
  const pref = normalizeFundingPreference(profile?.fundingType || profile?.funding_type || "any");
  return pref === "any" ? "all" : pref;
}
