import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { t } from "../../i18n.js";
import { formatPrice } from "../../currency.js";
import { translateFundingAwardField, translateWord } from "../../university-translations.js";
import { renderScholarshipLine, trStudyLevel, translateCostBreakdownLabel } from "../_shared.js";
import { normalizeLevelKey, safeHttpUrl, visibleAdmissionContextByUniversity } from "./section-context.js";

function fundingMetaShortLabel(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === String(t("admission.track.funding_program", "Funding program")).trim().toLowerCase()) {
    return t("admission.track.funding_program_short", "Program");
  }
  if (normalized === String(t("admission.track.funding_source", "Funding source")).trim().toLowerCase()) {
    return t("admission.track.funding_source_short", "Source");
  }
  return label;
}

export function renderFundingMetaTags(fundingMeta) {
  if (!Array.isArray(fundingMeta) || !fundingMeta.length) return "";

  return `
    <div class="admission-option-meta">
      ${fundingMeta.map(([label, value]) => `<span class="tag" title="${escapeHtmlAttr(`${label}: ${value}`)}"><small>${escapeHtml(fundingMetaShortLabel(label))}</small> <span>${escapeHtml(value)}</span></span>`).join("")}
    </div>
  `;
}

export function renderFinanceMetaList(fundingMeta) {
  if (!Array.isArray(fundingMeta) || !fundingMeta.length) return "";

  return `
    <dl class="finance-option-meta">
      ${fundingMeta.map(([label, value]) => `
        <div class="finance-option-meta__row">
          <dt>${escapeHtml(fundingMetaShortLabel(label))}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join("")}
    </dl>
  `;
}

function oneTimeCostTimingLabel(timing) {
  const normalized = String(timing || "").trim().toLowerCase();
  if (normalized === "enrollment") {
    return t("university.finance.one_time.timing.enrollment", "Paid once upon enrollment");
  }
  return "";
}

export function renderOneTimeCosts(finance) {
  const costs = Array.isArray(finance?.one_time_costs) ? finance.one_time_costs : [];
  const currency = String(finance?.currency || "USD").trim().toUpperCase();
  const rows = costs
    .filter((cost) => cost && typeof cost === "object" && Number.isFinite(Number(cost.amount)) && Number(cost.amount) > 0)
    .map((cost) => {
      const timing = oneTimeCostTimingLabel(cost.timing);
      const grantNote = cost.applies_to_grant_holders === true
        ? t("university.finance.one_time.applies_to_grant_holders", "Also required for grant holders")
        : "";
      const notes = [timing, grantNote].filter(Boolean).join(" · ");
      return `
        <div class="finance-one-time-costs__row">
          <dt>${escapeHtml(translateCostBreakdownLabel(cost.type))}</dt>
          <dd>
            <strong>${escapeHtml(formatPrice(cost.amount, currency))}</strong>
            ${notes ? `<span>${escapeHtml(notes)}</span>` : ""}
          </dd>
        </div>
      `;
    });

  if (!rows.length) return "";
  return `
    <section class="finance-one-time-costs" aria-labelledby="finance-one-time-costs-title">
      <h3 id="finance-one-time-costs-title">${escapeHtml(t("university.finance.one_time.title", "One-time payments"))}</h3>
      <dl>${rows.join("")}</dl>
    </section>
  `;
}

function normalizeAwardLevels(award) {
  const rawLevels = Array.isArray(award?.study_levels)
    ? award.study_levels
    : [award?.study_level || ""];
  return rawLevels
    .flatMap((value) => String(value || "").split(/[/,&]+/))
    .map((value) => normalizeLevelKey(value))
    .filter((value) => value && value !== "general");
}

function awardMatchesVisiblePrograms(award, categories, selectedLevel) {
  const explicitIds = Array.isArray(award?.program_ids) ? award.program_ids : [];
  if (explicitIds.length) {
    const visibleIds = new Set((Array.isArray(categories) ? categories : [])
      .flatMap((category) => Array.isArray(category?.program_ids) ? category.program_ids : [])
      .map((value) => String(value || "").trim().toLowerCase()));
    return explicitIds.some((id) => visibleIds.has(String(id || "").trim().toLowerCase()));
  }
  const scope = String(award?.program_scope || "").trim().toLowerCase();
  if (!scope) return true;
  if (scope.includes("selected postgraduate taught") && selectedLevel !== "bachelor") return false;

  const categoryText = (Array.isArray(categories) ? categories : [])
    .flatMap((category) => [
      category?.id,
      category?.label,
      category?.name,
      ...(Array.isArray(category?.program_names) ? category.program_names : []),
      ...(Array.isArray(category?.program_ids) ? category.program_ids : []),
    ])
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  const scopedTerms = ["mba", "hbs", "gsb", "mfin", "mban", "mpp", "mpa", "jd", "college"];
  const termsInScope = scopedTerms.filter((term) => new RegExp(`\\b${term}\\b`).test(scope));
  if (termsInScope.length && !termsInScope.some((term) => new RegExp(`\\b${term}\\b`).test(categoryText))) {
    return false;
  }

  if (/except\s+medicine/.test(scope) && /medicine/.test(categoryText)) return false;
  if (/centre for doctoral training/.test(scope) && !/\bcdt\b|centre for doctoral training/.test(categoryText)) return false;
  if (/business school/.test(scope) && !/business|mba|mfin|mban/.test(categoryText)) return false;
  return true;
}

export function getFundingAwardsForSelection(finance, categories, studyLevel, programCategories = categories) {
  const awards = Array.isArray(finance?.scholarships_and_funding)
    ? finance.scholarships_and_funding
    : [];
  const selectedLevel = normalizeLevelKey(studyLevel);
  return awards.filter((award) => {
    if (!award || typeof award !== "object") return false;
    const routes = programCategories.map((category) => category.applicant_route).filter(Boolean);
    if (Array.isArray(award.applicant_routes) && award.applicant_routes.length && routes.length
      && !routes.some((route) => award.applicant_routes.includes(route))) return false;
    const levels = normalizeAwardLevels(award);
    if (selectedLevel && !["all", "any", "general"].includes(selectedLevel) && levels.length && !levels.includes(selectedLevel)) {
      return false;
    }
    return awardMatchesVisiblePrograms(award, programCategories, selectedLevel);
  });
}

function fundingDeadlineText(value, award = null, field = "deadline") {
  if (value == null || value === "") return t("university.finance.award_unknown", "Not published");
  if (Array.isArray(value)) return value.map((item) => fundingDeadlineText(item, award, field)).join(" · ");
  if (typeof value === "object") {
    if (value.date) {
      const round = value.round ? ` · ${t("university.finance.award_round", "Round")} ${value.round}` : "";
      const time = value.time ? ` ${value.time}` : "";
      const label = value.label ? `${translateFundingAwardField(award, `${field}_label`, value.label)}: ` : "";
      return `${label}${value.date}${time}${round}`;
    }
    return Object.entries(value)
      .map(([key, date]) => `${t(`university.finance.award.deadline_label.${key}`, translateWord(key, key.replaceAll("_", " ")))}: ${fundingDeadlineText(date, award, field)}`)
      .join(" · ");
  }
  return translateFundingAwardField(award, field, value);
}

function fundingProcessLabel(process) {
  const labels = {
    automatic: t("university.finance.award_process.automatic", "No separate award application; reviewed with the course application"),
    course_application_selection: t("university.finance.award_process.course_application_selection", "Select the award in the course application"),
    separate: t("university.finance.award_process.separate", "Separate award application required"),
    post_offer: t("university.finance.award_process.post_offer", "Apply after receiving an admission offer"),
  };
  return labels[String(process || "").trim().toLowerCase()] || t("university.finance.award_unknown", "Not published");
}

export function renderFundingAwardList(finance, categories, studyLevel, programCategories = categories) {
  const awards = getFundingAwardsForSelection(finance, categories, studyLevel, programCategories);
  if (!awards.length) return "";

  const unknown = t("university.finance.award_unknown", "Not published");
  const row = (label, value) => `
    <div class="finance-award-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || unknown)}</dd>
    </div>
  `;
  return `
    <div class="finance-awards-list">
      ${awards.map((award) => {
        const basisDefaults = {
          need: "Need-based",
          merit: "Merit-based",
          need_and_merit: "Need and merit",
        };
        const basis = t(`university.finance.award_basis.${award.basis}`, basisDefaults[award.basis] || t("university.finance.award_unknown", "Not published"));
        const levels = normalizeAwardLevels(award).map((level) => trStudyLevel(level)).join(" / ") || unknown;
        const coverage = Array.isArray(award.coverage)
          ? award.coverage.map((item, index) => t(`university.finance.award.coverage_item.${item}`, translateFundingAwardField(award, `coverage.${index}`, translateWord(item, item.replaceAll("_", " "))))).join(", ")
          : translateFundingAwardField(award, "coverage", award.coverage);
        const steps = Array.isArray(award.steps) ? award.steps : [];
        const documents = Array.isArray(award.documents) ? award.documents : [];
        const sourceLinks = [award.source_url, ...(Array.isArray(award.source_urls) ? award.source_urls : [])]
          .map((url) => safeHttpUrl(url))
          .filter((url, index, all) => url && all.indexOf(url) === index);
        const scholarshipName = translateFundingAwardField(award, "name", award.name || award.label || t("university.finance.award_title_fallback", "Funding award"));
        const applicantScope = award.applicant_scope || award.target_audience;
        const applicantScopeText = String(applicantScope || "").toLowerCase() === "domestic_only"
          ? t("university.finance.award.applicant_scope.domestic_only", "Home fee status only; this is not determined by citizenship alone")
          : translateFundingAwardField(award, "applicant_scope", applicantScope);
        const targetScope = [
          translateFundingAwardField(award, "program_scope", award.program_scope),
          applicantScope === "all" ? unknown : applicantScopeText,
        ]
          .filter(Boolean)
          .join(" · ");
        const cycle = translateFundingAwardField(award, "cycle", award.academic_year || award.cycle);
        const timezone = translateFundingAwardField(award, "deadline_timezone", award.deadline_timezone);
        return `
          <article class="finance-award-card">
            <header class="finance-award-head">
              <h4>${escapeHtml(scholarshipName)}</h4>
              <span class="finance-award-basis">${escapeHtml(basis)}</span>
            </header>
            <p class="finance-award-scope">${escapeHtml(targetScope || unknown)} · ${escapeHtml(levels)} · ${escapeHtml(cycle)}</p>
            <dl class="finance-award-facts">
              ${row(t("university.finance.award_coverage", "What it covers"), coverage)}
              ${row(t("university.finance.award_eligibility", "Who can apply"), translateFundingAwardField(award, "eligibility", award.eligibility))}
              ${row(t("university.finance.award_application", "How to apply"), fundingProcessLabel(award.application_process))}
              ${row(t("university.finance.award_course_deadline", "Course application deadline"), fundingDeadlineText(award.course_application_deadline, award, "course_application_deadline"))}
              ${row(t("university.finance.award_deadline", "Award application deadline"), fundingDeadlineText(award.award_application_deadline, award, "award_application_deadline"))}
              ${row(t("university.finance.award_timezone", "Time zone"), timezone)}
            </dl>
            <details class="finance-award-details motion-disclosure">
              <summary>${escapeHtml(t("university.finance.award_details", "Steps, documents, and conditions"))}</summary>
              <div class="finance-award-details-content">
                ${row(t("university.finance.award_steps", "Application steps"), steps.length ? steps.map((step, index) => translateFundingAwardField(award, `steps.${index}`, step)).join(" • ") : unknown)}
                ${row(t("university.finance.award_documents", "Documents"), documents.length ? documents.map((document, index) => translateFundingAwardField(award, `documents.${index}`, document)).join(" • ") : unknown)}
                ${row(t("university.finance.award_competition", "Competition"), translateFundingAwardField(award, "competition", award.competition))}
                ${row(t("university.finance.award_renewal", "Renewal"), translateFundingAwardField(award, "renewal", award.renewal))}
                ${row(t("university.finance.award_verified", "Verified"), award.verified_at)}
                <div class="finance-award-row">
                  <dt>${escapeHtml(t("university.finance.award_source", "Official source"))}</dt>
                  <dd>${sourceLinks.length ? sourceLinks.map((url) => `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.finance.award_open_source", "Open university page"))}</a>`).join(" · ") : escapeHtml(unknown)}</dd>
                </div>
              </div>
            </details>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

export function refreshFundingAwardsForVisibleAdmission(university) {
  if (typeof document === "undefined") return;
  const container = document.getElementById("detailScholarshipInfo");
  if (!container) return;
  const context = visibleAdmissionContextByUniversity.get(String(university?.id || ""));
  if (!context) return;
  const awardsHtml = renderFundingAwardList(
    university?.finance,
    context.visibleCategories,
    context.selectedLevel,
    context.visibleCategories,
  );
  container.innerHTML = `
    <p class="finance-awards-disclaimer">${escapeHtml(t("university.finance.awards_not_guaranteed", "These are funding opportunities, not award offers. Estimated costs do not decrease unless aid is officially awarded."))}</p>
    ${awardsHtml || renderScholarshipLine("information-circle", "scholarship-line--muted", t("university.finance.award_none_for_scope", "No listed awards match this study level and program."))}
  `;
}

export function resolveFeeStatusAndAid({ university, profile, studyLevel }) {
  const fin = university?.finance || {};
  const country = String(university?.location?.country || "").trim().toLowerCase();
  const isUkUni = country.includes("kingdom") || country.includes("united kingdom") || country.includes("великобритан") || country === "gb" || country === "uk";
  const isUsUni = country.includes("united states") || country.includes("usa") || country.includes("сша") || country === "us";

  let feeStatusBadge = "";
  const feeStatusTone = "neutral";
  let feeStatusSummary = "";

  if (isUkUni || isUsUni) {
    // Fee status is never inferred from the profile; the applicant is pointed to the university's own eligibility rules.
    feeStatusBadge = t("university.finance.status_unconfirmed", "Fee status requires an eligibility check");
    feeStatusSummary = t("university.finance.status_unconfirmed_desc", "Citizenship alone does not establish home, domestic, or overseas fee status. Residency history and the university's rules may also matter.");
  }

  const targetStudyLevel = normalizeLevelKey(studyLevel || profile?.studyLevel || profile?.study_level);
  const showUndergraduatePolicy = ["", "any", "all", "general", "bachelor"].includes(targetStudyLevel);
  const showDoctoralFunding = ["", "any", "all", "general", "doctorate"].includes(targetStudyLevel);
  const ugPolicy = fin.undergraduate_aid_policy || {};
  const aid = fin.financial_aid || {};
  let aidBadge = "";
  let aidTone = "neutral";
  let aidDescription = "";

  const domesticNeedBlind = ugPolicy.need_blind_domestic === true || aid.undergraduate_need_blind_domestic === true;
  const internationalNeedBlind = ugPolicy.need_blind_international === true || aid.international_need_blind === true;
  const genericNeedBlind = aid.need_blind === true && aid.basis === "need";
  const isUniversalNeedBlind = domesticNeedBlind && internationalNeedBlind;
  const meetsFullDemonstratedNeed = showUndergraduatePolicy && (
    ugPolicy.meets_full_demonstrated_need === true || aid.meets_full_demonstrated_need === true
  );
  const zeroLoansPolicy = showUndergraduatePolicy && (
    ugPolicy.zero_loans_policy === true || aid.zero_loans_policy === true || aid.no_loans_policy === true
  );

  const isNeedBlindDomesticOnly = Boolean(
    domesticNeedBlind &&
    (ugPolicy.need_blind_international === false || aid.undergraduate_need_aware_international === true)
  );

  if (showUndergraduatePolicy && isUniversalNeedBlind) {
    aidBadge = t("university.finance.need_blind_universal", "Universal Need-Blind");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_universal_desc", "Need-blind undergraduate admission applies to domestic and international applicants under the published policy.");
  } else if (showUndergraduatePolicy && isNeedBlindDomesticOnly) {
    aidBadge = t("university.finance.domestic_and_international_policy", "Different aid rules by applicant category");
    aidDescription = t("university.finance.domestic_and_international_policy_desc", "The university publishes different need-based aid rules for domestic and international applicants. Your category and aid eligibility require review under its official rules.");
  } else if (showUndergraduatePolicy && domesticNeedBlind) {
    aidBadge = t("university.finance.need_blind_domestic", "Need-Blind (Domestic)");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_domestic_desc", "Need-blind undergraduate admission applies to domestic applicants covered by the published policy.");
  } else if (showUndergraduatePolicy && internationalNeedBlind) {
    aidBadge = t("university.finance.need_blind_international", "Need-Blind (International)");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_international_desc", "Need-blind undergraduate admission applies to international applicants covered by the published policy.");
  } else if (showUndergraduatePolicy && genericNeedBlind) {
    aidBadge = t("university.finance.need_blind_unscoped", "Need-Blind Undergraduate Admission");
    aidTone = "positive";
    aidDescription = t("university.finance.need_blind_unscoped_desc", "The available record identifies undergraduate admission as need-blind but does not specify the applicant categories covered.");
  }

  const freeTuitionUsd = showUndergraduatePolicy ? (
    ugPolicy.free_tuition_family_income_threshold_usd ||
    ugPolicy.tuition_free_income_threshold_usd ||
    aid.free_tuition_threshold_usd ||
    aid.free_tuition_income_threshold_usd ||
    aid.tuition_free_income_threshold_usd ||
    (aid.income_thresholds?.under_150k ? 150000 : null)
  ) : null;
  const zeroParentContributionUsd = showUndergraduatePolicy ? (
    ugPolicy.zero_parent_contribution_income_threshold_usd ||
    aid.zero_parent_contribution_income_threshold_usd ||
    aid.zero_contribution_income_threshold_usd ||
    (aid.income_thresholds?.under_100k ? 100000 : null)
  ) : null;
  const fullRideUsd = showUndergraduatePolicy ? (
    ugPolicy.full_ride_income_threshold_usd ||
    aid.full_ride_threshold_usd ||
    aid.full_ride_income_threshold_usd
  ) : null;

  const thresholds = [];
  if (zeroParentContributionUsd) {
    thresholds.push({
      label: t("university.finance.zero_parent_contribution_threshold", "Zero Parent Contribution Threshold"),
      value: `< $${Number(zeroParentContributionUsd).toLocaleString("en-US")} ${t("universities.card.per_year", "/ year")}`,
      note: t("university.finance.zero_parent_contrib", "The policy sets the expected parent contribution to zero; this does not establish total net price."),
    });
  }
  if (fullRideUsd) {
    thresholds.push({
      label: t("university.finance.full_ride_threshold", "Full-Ride Income Threshold"),
      value: `< $${Number(fullRideUsd).toLocaleString("en-US")} ${t("universities.card.per_year", "/ year")}`,
      note: t("university.finance.full_ride_threshold_note", "Eligibility for a full funding package depends on the university's full policy and applicant circumstances."),
    });
  }
  if (freeTuitionUsd) {
    thresholds.push({
      label: t("university.finance.free_tuition_threshold", "Free Tuition Threshold"),
      value: `< $${Number(freeTuitionUsd).toLocaleString("en-US")} ${t("universities.card.per_year", "/ year")}`,
      note: t("university.finance.free_tuition_note", "100% tuition coverage for qualifying families"),
    });
  }
  if (zeroLoansPolicy) {
    thresholds.push({
      label: t("university.finance.zero_loans", "Aid packages without loans"),
      value: t("university.finance.zero_loans_value", "No loans"),
      note: t("university.finance.zero_loans_note", "The published undergraduate aid policy says eligible aid packages do not include loans."),
    });
  }
  if (meetsFullDemonstratedNeed) {
    thresholds.push({
      label: t("university.finance.full_demonstrated_need", "Full demonstrated need met"),
      note: t("university.finance.full_demonstrated_need_note", "The university states that it meets 100% of demonstrated undergraduate financial need for applicants covered by this policy."),
    });
  }

  let phdFunding = null;
  if (showDoctoralFunding) {
    const doc = fin.doctorate_funding_guarantee
      || fin.graduate_financial_aid_models?.gsas_phd_guarantee
      || fin.graduate_funding?.phd_funding_guarantee
      || (typeof fin.phd_funding_guarantee === "string" ? fin.phd_funding_guarantee : null);
    if (doc) {
      const details = typeof doc === "string"
        ? doc
        : (doc.coverage || doc.commitment || doc.notes || (Array.isArray(doc.components) ? doc.components.join("; ") : ""));
      const duration = typeof doc === "object" && doc.duration_years ? `${doc.duration_years}-year ` : "";
      const stipendMin = typeof doc === "object" ? Number(doc.stipend_annual_usd_min) : Number.NaN;
      const stipendMax = typeof doc === "object" ? Number(doc.stipend_annual_usd_max) : Number.NaN;
      const stipendDetails = !details && Number.isFinite(stipendMin) && Number.isFinite(stipendMax)
        ? ` Annual stipend: $${stipendMin.toLocaleString("en-US")}–$${stipendMax.toLocaleString("en-US")} USD.`
        : "";
      const fullDetails = [details, stipendDetails].filter(Boolean).join(" ").trim();
      if (fullDetails) {
        phdFunding = {
          title: `${duration}${t("university.finance.doctoral_funding_title", "Doctoral funding")}`,
          details: fullDetails,
        };
      }
    }
  }

  return {
    hasPolicyData: Boolean(feeStatusBadge || aidBadge || thresholds.length || phdFunding),
    feeStatusBadge,
    feeStatusTone,
    feeStatusSummary,
    aidBadge,
    aidTone,
    aidDescription,
    thresholds,
    thresholdsNote: thresholds.length
      ? [
          university?.id === "stanford-university-usa-ca" && aid.income_thresholds_note
            ? t("university.finance.income_thresholds_note.stanford", "Stanford's income guidelines assume typical assets and US cost-of-living assumptions and may not apply to families living outside the United States.")
            : "",
        ].filter(Boolean).join(" ")
      : "",
    phdFunding,
  };
}

export function renderFinancePolicyOverview(policy) {
  if (!policy || !policy.hasPolicyData) return "";

  const shieldIcon = heroIcon("document-check", "ui-icon ui-icon--16");
  const sparkIcon = heroIcon("banknotes", "ui-icon ui-icon--16");
  const capIcon = heroIcon("academic-cap", "ui-icon ui-icon--16");

  return `
    <section class="finance-policy-card" aria-labelledby="finance-policy-title">
      <div class="finance-policy-head">
        <h3 id="finance-policy-title" class="finance-policy-title">
          ${shieldIcon}
          <span>${escapeHtml(t("university.finance.policy_title", "Tuition Status & Financial Aid Policy"))}</span>
        </h3>
      </div>

      ${policy.feeStatusBadge ? `
        <div class="finance-fee-status-banner">
          <div class="finance-fee-status-left">
            <span class="finance-fee-status-kicker">${escapeHtml(t("university.finance.fee_status_label", "Your Tuition Fee Status"))}</span>
            <div class="finance-fee-status-badge finance-fee-status-badge--${escapeHtmlAttr(policy.feeStatusTone)}">
              <strong>${escapeHtml(policy.feeStatusBadge)}</strong>
            </div>
            ${policy.feeStatusSummary ? `<p class="finance-fee-status-desc">${escapeHtml(policy.feeStatusSummary)}</p>` : ""}
          </div>
          ${policy.aidBadge ? `
            <div class="finance-aid-policy-badge-box">
              <span class="finance-fee-status-kicker">${escapeHtml(t("university.finance.aid_policy_label", "Admissions Aid Policy"))}</span>
              <span class="finance-aid-badge finance-aid-badge--${escapeHtmlAttr(policy.aidTone)}">${escapeHtml(policy.aidBadge)}</span>
            </div>
          ` : ""}
        </div>
      ` : ""}

      ${policy.aidDescription ? `
        <div class="finance-aid-description-box">
          <p>${escapeHtml(policy.aidDescription)}</p>
        </div>
      ` : ""}

      ${policy.thresholds && policy.thresholds.length ? `
        <div class="finance-thresholds-section">
          <h4 class="finance-thresholds-heading">${sparkIcon} <span>${escapeHtml(t("university.finance.thresholds_title", "Income-Based Financial Aid & Full Rides"))}</span></h4>
          <div class="finance-thresholds-grid">
            ${policy.thresholds.map((th) => `
              <div class="finance-threshold-item">
                <span class="finance-threshold-label">${escapeHtml(th.label)}</span>
                <strong class="finance-threshold-value">${escapeHtml(th.value)}</strong>
                ${th.note ? `<p class="finance-threshold-note">${escapeHtml(th.note)}</p>` : ""}
              </div>
            `).join("")}
          </div>
          ${policy.thresholdsNote ? `<p class="finance-threshold-note">${escapeHtml(policy.thresholdsNote)}</p>` : ""}
        </div>
      ` : ""}

      ${policy.phdFunding ? `
        <div class="finance-phd-guarantee-card">
          <h4 class="finance-phd-title">${capIcon} <span>${escapeHtml(policy.phdFunding.title)}</span></h4>
          <p class="finance-phd-details">${escapeHtml(policy.phdFunding.details)}</p>
        </div>
      ` : ""}
    </section>
  `;
}
