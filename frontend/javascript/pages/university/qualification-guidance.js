import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { t } from "../../i18n.js";
import { trProgramName, trStudyLevel } from "../_shared.js";

function normalizeQualificationLevel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (["bachelor", "undergraduate", "undergrad"].includes(key)) return "Bachelor";
  if (["master", "mba", "doctorate", "phd", "graduate"].includes(key)) return "graduate";
  return "";
}

function isOfficialSource(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

const QUALIFICATION_SCOPE_KEYS = new Map([
  ["Undergraduate first-year qualification status; this credential alone does not meet the standard offer. Oxford says applicants need further study and another accepted qualification.", "university.qualification_guidance.scope.oxford_attestat"],
  ["All undergraduate courses at qualification-type level; course-specific grades and subjects are not checked here.", "university.qualification_guidance.scope.oxford_ib"],
  ["Qualification-type level only; course-specific thresholds are not checked here.", "university.qualification_guidance.scope.imperial_ib"],
  ["Contextual admissions guidance only; no country-level qualification acceptance or rejection is inferred.", "university.qualification_guidance.scope.contextual_review"],
  ["Stanford says it considers international applications in the context of the school and country. This source does not publish a country-level acceptance decision for this credential.", "university.qualification_guidance.scope.stanford_review"],
  ["Harvard states that application requirements are the same for students attending high school inside or outside the United States; it does not publish a country-level diploma acceptance decision here.", "university.qualification_guidance.scope.harvard_review"],
  ["Oxford publishes country-specific school-leaving qualification decisions for undergraduate first-year entry. Course subject and grade requirements still apply.", "university.qualification_guidance.scope.oxford_review"],
  ["Imperial publishes accepted undergraduate qualification equivalencies, while course pages can require higher or additional subjects.", "university.qualification_guidance.scope.imperial_review"],
  ["Open the selected official programme page to review its current requirements.", "university.qualification_guidance.scope.graduate_review"],
]);

const QUALIFICATION_CYCLE_SCOPE_KEYS = new Map([
  ["Current published policy; the source does not name a specific entry year.", "university.qualification_guidance.cycle_scope.current_policy"],
  ["Current published guidance; the source does not name a specific entry year.", "university.qualification_guidance.cycle_scope.current_guidance"],
  ["Current published guidance; verify applicability to the intended entry year.", "university.qualification_guidance.cycle_scope.verify_entry_year"],
  ["Use the selected programme's named entry cycle and current course page.", "university.qualification_guidance.cycle_scope.program_page"],
]);

function qualificationReasonKey(item) {
  const id = String(item?.id || "");
  if (id.includes("oxford-kazakhstan-attestat")) return "university.qualification_guidance.reason.oxford_attestat";
  if (id.includes("international-baccalaureate") || id.includes("imperial-ib")) return "university.qualification_guidance.reason.accepted_ib";
  if (id.includes("us-high-school-context")) return "university.qualification_guidance.reason.contextual_review";
  return item?.requires_program_page ? "university.qualification_guidance.reason.graduate_review" : "university.qualification_guidance.reason.unknown";
}

// Published reference: every catalogued rule and fallback is returned as written. Nothing is matched to the reader,
// because each rule names its own qualification, study level, and cycle.
export function resolveQualificationGuidance({ university = {}, program = null } = {}) {
  const catalog = university?.qualification_guidance && typeof university.qualification_guidance === "object"
    ? university.qualification_guidance
    : {};
  const programUrl = isOfficialSource(program?.url || program?.source_url) ? String(program.url || program.source_url) : "";
  const entries = [...(Array.isArray(catalog.rules) ? catalog.rules : []), ...(Array.isArray(catalog.fallbacks) ? catalog.fallbacks : [])]
    .map((item) => {
      const requiresProgramPage = item.requires_program_page === true;
      const needsProgram = requiresProgramPage && !programUrl;
      const scope = item.scope || "";
      const cycleScope = item.cycle_scope || "";
      const itemUrl = isOfficialSource(item.source_url) ? item.source_url : "";
      return {
        id: item.id || "",
        status: item.status || "needs_review",
        reasonKey: needsProgram ? "university.qualification_guidance.reason.select_program" : item.reason_key || qualificationReasonKey(item),
        reason: needsProgram
          ? "Choose the exact graduate programme to open its official course requirements."
          : item.reason || "No verified decision for this exact qualification combination is catalogued.",
        scope,
        scopeKey: item.scope_key || QUALIFICATION_SCOPE_KEYS.get(scope) || "",
        cycleScope,
        cycleScopeKey: item.cycle_scope_key || QUALIFICATION_CYCLE_SCOPE_KEYS.get(cycleScope) || "",
        sourceUrl: requiresProgramPage ? programUrl || itemUrl : itemUrl,
        verifiedAt: item.verified_at || catalog.verified_at || "",
        studyLevel: normalizeQualificationLevel(item.study_level),
        requiresProgramPage,
      };
    });
  return {
    entries,
    programName: String(program?.name || "").trim(),
    programUrl,
  };
}

function renderQualificationEntry(entry, { programUrl }) {
  const statusKeys = {
    accepted: "university.qualification_guidance.status.accepted",
    not_accepted: "university.qualification_guidance.status.not_accepted",
    needs_review: "university.qualification_guidance.status.needs_review",
  };
  const statusClass = entry.status === "accepted" ? "accepted" : (entry.status === "not_accepted" ? "not-accepted" : "review");
  const statusLabel = t(statusKeys[entry.status] || statusKeys.needs_review, entry.status === "accepted" ? "Accepted qualification" : (entry.status === "not_accepted" ? "Explicitly not accepted" : "Needs official review"));
  const meta = (key, fallback, value, escape = escapeHtml) => `<p class="qualification-guidance__meta"><strong>${escapeHtml(t(key, fallback))}:</strong> ${escape(value)}</p>`;
  const programSource = entry.requiresProgramPage && programUrl
    ? `<a class="qualification-guidance__source" href="${escapeHtmlAttr(programUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.qualification_guidance.program_source", "Official program page"))}</a>`
    : "";
  const levelText = entry.studyLevel
    ? meta("university.qualification_guidance.level_label", "Study level", trStudyLevel(entry.studyLevel === "Bachelor" ? "Bachelor" : "Graduate"))
    : "";
  const scopeText = entry.scopeKey ? t(entry.scopeKey, entry.scope) : entry.scope;
  const scope = scopeText ? `<p class="qualification-guidance__meta">${escapeHtml(scopeText)}</p>` : "";
  const cycleScopeText = entry.cycleScopeKey ? t(entry.cycleScopeKey, entry.cycleScope) : entry.cycleScope;
  const cycleScope = cycleScopeText ? meta("university.qualification_guidance.cycle_scope_label", "Cycle coverage", cycleScopeText) : "";
  const checked = entry.verifiedAt ? meta("university.qualification_guidance.checked_label", "Official page checked", entry.verifiedAt, escapeHtmlAttr) : "";
  const source = entry.sourceUrl
    ? `<a class="qualification-guidance__source" href="${escapeHtmlAttr(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.qualification_guidance.official_source", "Open official qualification guidance"))}</a>`
    : "";
  return `
    <div class="qualification-guidance__result" data-qualification-entry>
      <span class="qualification-guidance__status qualification-guidance__status--${statusClass}">${escapeHtml(statusLabel)}</span>
      <p class="qualification-guidance__text">${escapeHtml(t(entry.reasonKey, entry.reason))}</p>
      ${levelText}
      ${scope}
      ${cycleScope}
      ${checked}
      ${source}
      ${programSource}
    </div>`;
}

export function renderQualificationGuidance({ container, university = {}, program = null } = {}) {
  if (!container) return null;
  const result = resolveQualificationGuidance({ university, program });
  // Without catalogued guidance the section keeps the single "no verified decision" notice.
  const entries = result.entries.length
    ? result.entries
    : [{ status: "needs_review", reasonKey: "university.qualification_guidance.reason.unknown", reason: "No verified decision for this exact qualification combination is catalogued." }];
  const referenceNote = result.entries.length
    ? `<p class="qualification-guidance__meta">${escapeHtml(t("university.qualification_guidance.reference_note", "These are the university's published decisions. Each applies only to the qualification, study level, and cycle it names."))}</p>`
    : "";
  const selectedProgram = result.programName
    ? `<p class="qualification-guidance__meta"><strong>${escapeHtml(t("university.qualification_guidance.program_label", "Programme"))}:</strong> ${escapeHtml(trProgramName(result.programName) || result.programName)}</p>`
    : "";
  const dataNotice = `<p class="qualification-guidance__meta">${escapeHtml(t("university.qualification_guidance.no_eligibility_notice", "This is qualification guidance, not an admission or eligibility decision. Grades, subjects, programme rules, and the applicable cycle still need review."))}</p>`;
  container.innerHTML = `${referenceNote}${selectedProgram}${entries.map((entry) => renderQualificationEntry(entry, result)).join("")}${dataNotice}`;
  return result;
}
