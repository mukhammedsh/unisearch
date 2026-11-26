import { escapeHtml, escapeHtmlAttr, initCustomSelect, showToast } from "../../utils.js";
import { t } from "../../i18n.js";

// Only evidence that a reviewed assessment check reads is collected: the MIT Course 6-9 and MITx credential checks.
const INSTITUTIONS = [
  ["mit-usa-cambridge", "profile.evidence.institution.mit"],
];
const PROGRAMS = {
  "mit-usa-cambridge": [
    ["mit-bs-6-9", "profile.evidence.program.mit_course_6_9"],
  ],
};
const CREDENTIALS = {
  "mit-usa-cambridge": [
    ["mitx-dedp-micromasters", "profile.evidence.credential.mit_dedp"],
    ["sc0x-course-credential", "profile.evidence.credential.mit_sc0x"],
  ],
};
const SUPPORTED_EVIDENCE = {
  "mit-usa-cambridge": ["enrollment", "gpa", "credential"],
};
const LANGUAGE_KINDS = ["primary_language", "education", "employment"];
// Reviewed language checks (admissions_assessment.py) read only English-language background.
const EVIDENCE_LANGUAGE = "en";
const QUALIFICATION_LEVELS = ["secondary", "bachelor", "master", "doctorate", "professional", "other"];
const EVIDENCE_SELECT_IDS = [
  "languageEvidenceKind",
  "languageEvidenceQualification",
  "languageEvidenceStatus",
  "languageEvidenceEntirely",
  "institutionEvidenceUniversity",
  "institutionEvidenceKind",
  "institutionEvidenceProgram",
  "institutionEvidenceEnrollmentStatus",
  "institutionEvidenceMetric",
  "institutionEvidenceCredential",
  "institutionEvidenceCredentialStatus",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value, allowFuture = false) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return allowFuture || value <= new Date().toISOString().slice(0, 10);
}

function optionRows(rows, selected = "") {
  return rows.map(([value, label]) => `<option value="${escapeHtmlAttr(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function localizedOptions(rows) {
  return rows.map(([value, key]) => [value, t(key, key)]);
}

function institutionLabel(id) {
  const row = INSTITUTIONS.find(([key]) => key === id);
  return row ? t(row[1], row[1]) : id;
}

function optionLabel(options, id, fallback = "") {
  const row = options.find(([key]) => key === id);
  return row ? t(row[1], row[1]) : fallback;
}

function renderLists(body, profile) {
  const languages = Array.isArray(profile.languageEvidence) ? profile.languageEvidence : [];
  const institutional = Array.isArray(profile.institutionalEvidence) ? profile.institutionalEvidence : [];
  const languageList = body.querySelector("#languageEvidenceList");
  const institutionalList = body.querySelector("#institutionalEvidenceList");
  if (languageList) {
    languageList.innerHTML = languages.map((row, index) => {
      const kind = t(`profile.evidence.language_kind.${row.kind}`, row.kind);
      const language = String(row.language || "").toUpperCase();
      const qualification = row.qualification_level ? t(`profile.evidence.qualification.${row.qualification_level}`, row.qualification_level) : "";
      const languageScope = typeof row.entirely_in_language === "boolean"
        ? t(`profile.evidence.entirely.${row.entirely_in_language ? "yes" : "no"}`, row.entirely_in_language ? "Entirely in language" : "Not entirely in language")
        : "";
      const detail = [row.country, qualification, row.started_on, row.completed_on, languageScope].filter(Boolean).join(" · ");
      return `<div class="profile-exam-item"><div class="profile-exam-meta"><span class="profile-exam-name">${escapeHtml(kind)} · ${escapeHtml(language)}</span><span class="profile-exam-score">${escapeHtml([detail, t("profile.evidence.self_reported_short", "Self-reported")].filter(Boolean).join(" · "))}</span></div><button type="button" class="profile-delete" data-remove-language-evidence="${index}">${escapeHtml(t("profile.delete", "Delete"))}</button></div>`;
    }).join("");
  }
  if (institutionalList) {
    institutionalList.innerHTML = institutional.map((row, index) => {
      const institution = institutionLabel(row.university_id);
      const programLabel = optionLabel(PROGRAMS[row.university_id] || [], row.program_id);
      const status = t(`profile.evidence.status.${row.status || "unknown"}`, row.status || "unknown");
      const credentialLabel = optionLabel(CREDENTIALS[row.university_id] || [], row.credential_id, t("profile.evidence.credential_other", "Program credential"));
      const details = row.kind === "gpa"
        ? `${t(`profile.evidence.metric.${row.metric}`, row.metric)}: ${row.value}/${row.scale}${programLabel ? ` · ${programLabel}` : ""}`
        : row.kind === "credential"
        ? `${credentialLabel}${row.score_percent !== undefined ? ` · ${row.score_percent}%` : ""} · ${status}`
          : `${programLabel || t("profile.evidence.institution_kind.enrollment", "Enrollment or course progress")} · ${status}${row.units !== undefined ? ` · ${t("profile.evidence.degree_units", "Total degree units")}: ${row.units}` : ""}${row.major_units !== undefined ? ` · ${t("profile.evidence.major_units", "Major units")}: ${row.major_units}` : ""}${row.completed_major_subjects !== undefined ? ` · ${t("profile.evidence.major_subjects_short", "Major subjects")}: ${row.completed_major_subjects}` : ""}`;
      return `<div class="profile-exam-item"><div class="profile-exam-meta"><span class="profile-exam-name">${escapeHtml(institution)}</span><span class="profile-exam-score">${escapeHtml(details)} · ${escapeHtml(t("profile.evidence.self_reported_short", "Self-reported"))}</span></div><button type="button" class="profile-delete" data-remove-institutional-evidence="${index}">${escapeHtml(t("profile.delete", "Delete"))}</button></div>`;
    }).join("");
  }
}

function reportError(message, target) {
  target?.focus();
  showToast(message, "error");
}

export function renderAdmissionEvidence(container, profile, onChange) {
  if (!container) return;
  container._admissionEvidenceState = { profile, onChange };
  // The previous render's custom selects hold window listeners; release them before the markup is replaced.
  (container._evidenceSelectCleanups || []).forEach((cleanup) => cleanup?.());
  container.innerHTML = `
    <div class="profile-admission-evidence">
        <p class="profile-hint" data-i18n="profile.evidence.description">Add only if a university page asks. Self-reported; official records are not verified.</p>
        <section class="profile-admission-evidence-group" aria-labelledby="languageEvidenceTitle">
          <div class="profile-subsection-head">
            <h3 id="languageEvidenceTitle" class="profile-subsection-title" data-i18n="profile.ux2.evidence.language_title">English language background</h3>
            <p class="profile-hint" data-i18n="profile.ux2.evidence.language_fixed">Records your background in English only, which is what English requirements ask about.</p>
          </div>
          <div class="profile-applicant-context-grid">
            <div class="profile-field">
              <label class="profile-form-label" for="languageEvidenceKind" data-i18n="profile.ux2.evidence.language_kind">How you know English</label>
              <select id="languageEvidenceKind" class="profile-input profile-input--select">
                ${optionRows(LANGUAGE_KINDS.map((kind) => [kind, t(`profile.evidence.language_kind.${kind}`, kind)]))}
              </select>
            </div>
            <div class="profile-field" data-language-evidence-detail>
              <label class="profile-form-label" for="languageEvidenceCountry" data-i18n="profile.evidence.country">Country</label>
              <input id="languageEvidenceCountry" class="profile-input" maxlength="80" />
            </div>
            <div class="profile-field" data-language-evidence-detail>
              <label class="profile-form-label" for="languageEvidenceQualification" data-i18n="profile.evidence.qualification">Qualification level</label>
              <select id="languageEvidenceQualification" class="profile-input profile-input--select">
                <option value="" data-i18n="profile.applicant_context.optional">Not specified</option>
                ${optionRows(QUALIFICATION_LEVELS.map((value) => [value, t(`profile.evidence.qualification.${value}`, value)]))}
              </select>
            </div>
            <div class="profile-field" data-language-evidence-detail>
              <label class="profile-form-label" for="languageEvidenceStarted" data-i18n="profile.evidence.started">Started</label>
              <input id="languageEvidenceStarted" class="profile-input" type="date" />
            </div>
            <div class="profile-field" data-language-evidence-detail>
              <label class="profile-form-label" for="languageEvidenceCompleted" data-i18n="profile.evidence.completed">Completed or ended</label>
              <input id="languageEvidenceCompleted" class="profile-input" type="date" />
            </div>
            <div class="profile-field" data-language-evidence-detail>
              <label class="profile-form-label" for="languageEvidenceStatus" data-i18n="profile.evidence.status">Status</label>
              <select id="languageEvidenceStatus" class="profile-input profile-input--select">
                ${optionRows([["unknown", t("profile.evidence.status.unknown", "Not specified")], ["in_progress", t("profile.evidence.status.in_progress", "In progress")], ["completed", t("profile.evidence.status.completed", "Completed")]])}
              </select>
            </div>
            <div class="profile-field" data-language-evidence-detail>
              <label class="profile-form-label" for="languageEvidenceEntirely" data-i18n="profile.ux2.evidence.entirely">Entirely in English?</label>
              <select id="languageEvidenceEntirely" class="profile-input profile-input--select">
                <option value="" data-i18n="profile.evidence.unknown">Not specified</option>
                <option value="yes" data-i18n="profile.evidence.entirely.yes">Yes, entirely</option>
                <option value="no" data-i18n="profile.evidence.entirely.no">No</option>
              </select>
            </div>
          </div>
          <button id="addLanguageEvidence" class="profile-add profile-add--secondary" type="button" data-i18n="profile.evidence.add_language">Add language evidence</button>
          <div id="languageEvidenceList" class="profile-exam-list"></div>
        </section>
        <section class="profile-admission-evidence-group" aria-labelledby="institutionalEvidenceTitle">
          <h3 id="institutionalEvidenceTitle" class="profile-subsection-title" data-i18n="profile.evidence.institution_title">Studies at a listed university</h3>
          <div class="profile-applicant-context-grid">
            <div class="profile-field">
              <label class="profile-form-label" for="institutionEvidenceUniversity" data-i18n="profile.evidence.institution">University</label>
              <select id="institutionEvidenceUniversity" class="profile-input profile-input--select">
                <option value="" data-i18n="profile.applicant_context.optional">Not specified</option>
                ${optionRows(localizedOptions(INSTITUTIONS))}
              </select>
            </div>
            <div class="profile-field">
              <label class="profile-form-label" for="institutionEvidenceKind" data-i18n="profile.ux2.evidence.institution_kind">What do you want to add?</label>
              <select id="institutionEvidenceKind" class="profile-input profile-input--select">
                <option value="" data-i18n="profile.applicant_context.optional">Not specified</option>
                ${optionRows([["enrollment", t("profile.evidence.institution_kind.enrollment", "Enrollment or completed courses")], ["gpa", t("profile.evidence.institution_kind.gpa", "Program GPA")], ["credential", t("profile.evidence.institution_kind.credential", "Program credential")]])}
              </select>
            </div>
            <div class="profile-field" data-institution-evidence-field="program_id">
              <label class="profile-form-label" for="institutionEvidenceProgram" data-i18n="profile.evidence.program">Program or study option</label>
              <select id="institutionEvidenceProgram" class="profile-input profile-input--select"></select>
            </div>
            <div class="profile-field" data-institution-evidence-kind="enrollment">
              <label class="profile-form-label" for="institutionEvidenceEnrollmentStatus" data-i18n="profile.evidence.status">Status</label>
              <select id="institutionEvidenceEnrollmentStatus" class="profile-input profile-input--select">
                ${optionRows([["unknown", t("profile.evidence.status.unknown", "Not specified")], ["enrolled", t("profile.evidence.status.enrolled", "Enrolled")], ["on_leave", t("profile.evidence.status.on_leave", "On leave")], ["completed", t("profile.evidence.status.completed", "Completed")], ["not_enrolled", t("profile.evidence.status.not_enrolled", "Not enrolled")]])}
              </select>
            </div>
            <div class="profile-field" data-institution-evidence-kind="enrollment">
              <label class="profile-form-label" for="institutionEvidenceUnits" data-i18n="profile.evidence.degree_units">Total degree units</label>
              <input id="institutionEvidenceUnits" class="profile-input" type="number" min="0" step="1" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="enrollment" data-major-evidence-for="mit-bs-6-9" hidden>
              <label class="profile-form-label" for="institutionEvidenceMajorUnits" data-i18n="profile.evidence.major_units">Course 6-9 major units</label>
              <input id="institutionEvidenceMajorUnits" class="profile-input" type="number" min="0" step="1" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="enrollment" data-major-evidence-for="mit-bs-6-9" hidden>
              <label class="profile-form-label" for="institutionEvidenceMajorSubjects" data-i18n="profile.evidence.major_subjects">Completed Course 6-9 major subjects</label>
              <input id="institutionEvidenceMajorSubjects" class="profile-input" type="number" min="0" step="1" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="enrollment">
              <label class="profile-form-label" for="institutionEvidenceExpectedCompletion" data-i18n="profile.evidence.expected_completion">Expected completion</label>
              <input id="institutionEvidenceExpectedCompletion" class="profile-input" type="date" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="gpa">
              <label class="profile-form-label" for="institutionEvidenceMetric" data-i18n="profile.evidence.metric">GPA measure</label>
              <select id="institutionEvidenceMetric" class="profile-input profile-input--select">
                ${optionRows([["overall", t("profile.evidence.metric.overall", "Overall")], ["technical", t("profile.evidence.metric.technical", "Technical")]])}
              </select>
            </div>
            <div class="profile-field" data-institution-evidence-kind="gpa">
              <label class="profile-form-label" for="institutionEvidenceValue" data-i18n="profile.evidence.value">GPA value</label>
              <input id="institutionEvidenceValue" class="profile-input" type="number" min="0" max="5" step="0.01" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="gpa">
              <label class="profile-form-label" for="institutionEvidenceScale" data-i18n="profile.evidence.scale">GPA scale</label>
              <input id="institutionEvidenceScale" class="profile-input" type="number" min="1" max="5" step="0.01" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="gpa">
              <label class="profile-form-label" for="institutionEvidenceTerm" data-i18n="profile.evidence.as_of_term">As of term</label>
              <input id="institutionEvidenceTerm" class="profile-input" maxlength="40" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="credential">
              <label class="profile-form-label" for="institutionEvidenceCredential" data-i18n="profile.evidence.credential_id">Credential</label>
              <select id="institutionEvidenceCredential" class="profile-input profile-input--select"></select>
            </div>
            <div id="institutionEvidenceCredentialScoreField" class="profile-field" data-institution-evidence-kind="credential" hidden>
              <label class="profile-form-label" for="institutionEvidenceCredentialScore" data-i18n="profile.evidence.score_percent">Credential score (%)</label>
              <input id="institutionEvidenceCredentialScore" class="profile-input" type="number" min="0" max="100" step="any" />
            </div>
            <div class="profile-field" data-institution-evidence-kind="credential">
              <label class="profile-form-label" for="institutionEvidenceCredentialStatus" data-i18n="profile.evidence.status">Status</label>
              <select id="institutionEvidenceCredentialStatus" class="profile-input profile-input--select">
                ${optionRows([["unknown", t("profile.evidence.status.unknown", "Not specified")], ["completed", t("profile.evidence.status.completed", "Completed")], ["in_progress", t("profile.evidence.status.in_progress", "In progress")], ["not_completed", t("profile.evidence.status.not_completed", "Not completed")]])}
              </select>
            </div>
            <div class="profile-field" data-institution-evidence-kind="credential">
              <label class="profile-form-label" for="institutionEvidenceCredentialDate" data-i18n="profile.evidence.completed_on">Completed on</label>
              <input id="institutionEvidenceCredentialDate" class="profile-input" type="date" />
            </div>
          </div>
          <button id="addInstitutionEvidence" class="profile-add profile-add--secondary" type="button" data-i18n="profile.evidence.add_institution">Add institution evidence</button>
          <div id="institutionalEvidenceList" class="profile-exam-list"></div>
        </section>
    </div>
  `;

  container._evidenceSelectCleanups = EVIDENCE_SELECT_IDS.map((id) => initCustomSelect(id));
  // Programmatic .value changes do not fire the select's own change event, so the custom control is told to re-read it.
  const setSelectValue = (id, value) => {
    const select = container.querySelector(`#${id}`);
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event("change"));
  };

  const langKind = container.querySelector("#languageEvidenceKind");
  const institution = container.querySelector("#institutionEvidenceUniversity");
  const institutionKind = container.querySelector("#institutionEvidenceKind");
  const credentialSelect = container.querySelector("#institutionEvidenceCredential");

  const updateLanguageFields = () => {
    const isPrimary = langKind.value === "primary_language";
    container.querySelectorAll("[data-language-evidence-detail]").forEach((node) => { node.hidden = isPrimary; });
  };
  const populateInstitutionOptions = () => {
    const universityId = institution.value;
    const kinds = SUPPORTED_EVIDENCE[universityId] || [];
    const programSuggestions = localizedOptions(PROGRAMS[universityId] || []);
    const credentialSuggestions = localizedOptions(CREDENTIALS[universityId] || []);
    const currentKind = institutionKind.value;
    const allowedKind = kinds.includes(currentKind) ? currentKind : "";
    institutionKind.innerHTML = `<option value="">${escapeHtml(t("profile.applicant_context.optional", "Not specified"))}</option>${optionRows(kinds.map((kind) => [kind, t(`profile.evidence.institution_kind.${kind}`, kind)]), allowedKind)}`;
    const programSelect = container.querySelector("#institutionEvidenceProgram");
    programSelect.innerHTML = `<option value="">${escapeHtml(t("profile.applicant_context.optional", "Not specified"))}</option>${optionRows(programSuggestions)}`;
    credentialSelect.innerHTML = `<option value="">${escapeHtml(t("profile.applicant_context.optional", "Not specified"))}</option>${optionRows(credentialSuggestions)}`;
  };
  const updateInstitutionFields = () => {
    container.querySelectorAll("[data-institution-evidence-kind]").forEach((node) => { node.hidden = node.dataset.institutionEvidenceKind !== institutionKind.value; });
    container.querySelectorAll("[data-institution-evidence-field='program_id']").forEach((node) => { node.hidden = !institutionKind.value || institutionKind.value === "credential"; });
    container.querySelectorAll("[data-major-evidence-for]").forEach((node) => {
      const visible = institution.value === "mit-usa-cambridge"
        && institutionKind.value === "enrollment"
        && container.querySelector("#institutionEvidenceProgram").value === node.dataset.majorEvidenceFor;
      node.hidden = !visible;
      if (!visible) {
        const input = node.querySelector("input");
        if (input) input.value = "";
      }
    });
    const scoreField = container.querySelector("#institutionEvidenceCredentialScoreField");
    if (scoreField) {
      scoreField.hidden = credentialSelect.value !== "sc0x-course-credential" || institutionKind.value !== "credential";
      if (scoreField.hidden) container.querySelector("#institutionEvidenceCredentialScore").value = "";
    }
  };

  langKind.addEventListener("change", updateLanguageFields);
  institution.addEventListener("change", () => {
    populateInstitutionOptions();
    updateInstitutionFields();
  });
  institutionKind.addEventListener("change", updateInstitutionFields);
  container.querySelector("#institutionEvidenceProgram").addEventListener("change", updateInstitutionFields);
  credentialSelect.addEventListener("change", updateInstitutionFields);
  updateLanguageFields();
  populateInstitutionOptions();
  updateInstitutionFields();
  renderLists(container, profile);

  if (container.dataset.bound !== "1") {
    container.dataset.bound = "1";
    container.addEventListener("click", (event) => {
      const languageDelete = event.target.closest("[data-remove-language-evidence]");
      const institutionDelete = event.target.closest("[data-remove-institutional-evidence]");
      if (!languageDelete && !institutionDelete) return;
      const current = container._admissionEvidenceState;
      if (!current) return;
      const currentProfile = current.profile;
      const key = languageDelete ? "languageEvidence" : "institutionalEvidence";
      const index = Number((languageDelete || institutionDelete).dataset.removeLanguageEvidence
        ?? (languageDelete || institutionDelete).dataset.removeInstitutionalEvidence);
      if (!Number.isInteger(index) || index < 0 || index >= (currentProfile[key] || []).length) return;
      currentProfile[key].splice(index, 1);
      renderLists(container, currentProfile);
      current.onChange(currentProfile);
    });
  }

  container.querySelector("#addLanguageEvidence").addEventListener("click", () => {
    const kind = langKind.value;
    if (!LANGUAGE_KINDS.includes(kind)) {
      reportError(t("profile.evidence.error.language", "Choose how you know English."), langKind);
      return;
    }
    const row = { kind, language: EVIDENCE_LANGUAGE };
    const country = String(container.querySelector("#languageEvidenceCountry").value || "").trim();
    const qualification = container.querySelector("#languageEvidenceQualification").value;
    const startedOn = container.querySelector("#languageEvidenceStarted").value;
    const completedOn = container.querySelector("#languageEvidenceCompleted").value;
    const status = container.querySelector("#languageEvidenceStatus").value || "unknown";
    const entirely = container.querySelector("#languageEvidenceEntirely").value;
    if (kind !== "primary_language") {
      if (country) row.country = country.slice(0, 80);
      if (qualification) row.qualification_level = qualification;
      if (startedOn) row.started_on = startedOn;
      if (completedOn) row.completed_on = completedOn;
      row.status = status;
      if (entirely === "yes") row.entirely_in_language = true;
      else if (entirely === "no") row.entirely_in_language = false;
      if ((startedOn && !validDate(startedOn)) || (completedOn && !validDate(completedOn)) || (startedOn && completedOn && startedOn > completedOn)) {
        reportError(t("profile.evidence.error.dates", "Check the dates for this evidence."), container.querySelector("#languageEvidenceStarted"));
        return;
      }
      if (kind === "education" && !qualification) {
        reportError(t("profile.evidence.error.qualification", "Choose the education level for this evidence."), container.querySelector("#languageEvidenceQualification"));
        return;
      }
    }
    profile.languageEvidence = Array.isArray(profile.languageEvidence) ? profile.languageEvidence : [];
    if (profile.languageEvidence.length >= 10) {
      reportError(t("profile.evidence.error.max_language", "You can save up to 10 language evidence records."), langKind);
      return;
    }
    profile.languageEvidence.push(row);
    container.querySelector("#languageEvidenceCountry").value = "";
    setSelectValue("languageEvidenceQualification", "");
    container.querySelector("#languageEvidenceStarted").value = "";
    container.querySelector("#languageEvidenceCompleted").value = "";
    setSelectValue("languageEvidenceStatus", "unknown");
    setSelectValue("languageEvidenceEntirely", "");
    renderLists(container, profile);
    onChange(profile);
  });

  container.querySelector("#addInstitutionEvidence").addEventListener("click", () => {
    const universityId = institution.value;
    const kind = institutionKind.value;
    const programInput = container.querySelector("#institutionEvidenceProgram");
    if (!INSTITUTIONS.some(([id]) => id === universityId) || !SUPPORTED_EVIDENCE[universityId]?.includes(kind)) {
      reportError(t("profile.evidence.error.institution", "Choose a supported university and evidence type."), institution);
      return;
    }
    const row = { university_id: universityId, kind };
    const programId = String(programInput.value || "").trim();
    if (programId) row.program_id = programId.slice(0, 128);
    if (kind === "enrollment") {
      row.status = container.querySelector("#institutionEvidenceEnrollmentStatus").value || "unknown";
      const unitsRaw = String(container.querySelector("#institutionEvidenceUnits").value || "").trim();
      const units = Number(unitsRaw);
      const majorUnitsRaw = String(container.querySelector("#institutionEvidenceMajorUnits").value || "").trim();
      const majorUnits = Number(majorUnitsRaw);
      const majorSubjectsRaw = String(container.querySelector("#institutionEvidenceMajorSubjects").value || "").trim();
      const majorSubjects = Number(majorSubjectsRaw);
      const expectedCompletion = container.querySelector("#institutionEvidenceExpectedCompletion").value;
      if ((unitsRaw && (!Number.isInteger(units) || units < 0 || units > 10000))
        || (majorUnitsRaw && (!Number.isInteger(majorUnits) || majorUnits < 0 || majorUnits > 10000))
        || (majorSubjectsRaw && (!Number.isInteger(majorSubjects) || majorSubjects < 0 || majorSubjects > 10000))) {
        reportError(t("profile.evidence.error.units", "Enter a non-negative whole number of units."), container.querySelector("#institutionEvidenceUnits"));
        return;
      }
      if (unitsRaw) row.units = units;
      if (majorUnitsRaw && programId === "mit-bs-6-9") row.major_units = majorUnits;
      if (majorSubjectsRaw && programId === "mit-bs-6-9") row.completed_major_subjects = majorSubjects;
      if (expectedCompletion) {
        if (!validDate(expectedCompletion, true)) {
          reportError(t("profile.evidence.error.dates", "Check the dates for this evidence."), container.querySelector("#institutionEvidenceExpectedCompletion"));
          return;
        }
        row.expected_completion_on = expectedCompletion;
      }
    } else if (kind === "gpa") {
      row.metric = container.querySelector("#institutionEvidenceMetric").value;
      const valueRaw = String(container.querySelector("#institutionEvidenceValue").value || "").trim();
      const scaleRaw = String(container.querySelector("#institutionEvidenceScale").value || "").trim();
      const value = Number(valueRaw);
      const scale = Number(scaleRaw);
      const term = String(container.querySelector("#institutionEvidenceTerm").value || "").trim();
      if (!["overall", "technical"].includes(row.metric) || !valueRaw || !scaleRaw || !Number.isFinite(value) || !Number.isFinite(scale) || value < 0 || value > 5 || scale < 1 || scale > 5 || value > scale) {
        reportError(t("profile.evidence.error.gpa", "Enter a GPA within its stated scale."), container.querySelector("#institutionEvidenceValue"));
        return;
      }
      row.value = value;
      row.scale = scale;
      if (term) row.as_of_term = term.slice(0, 40);
    } else {
      const credential = String(container.querySelector("#institutionEvidenceCredential").value || "").trim();
      const status = container.querySelector("#institutionEvidenceCredentialStatus").value || "unknown";
      const completedOn = container.querySelector("#institutionEvidenceCredentialDate").value;
      if (!credential) {
        reportError(t("profile.evidence.error.credential", "Choose a listed credential."), container.querySelector("#institutionEvidenceCredential"));
        return;
      }
      row.credential_id = credential.slice(0, 128);
      row.status = status;
      const scoreRaw = String(container.querySelector("#institutionEvidenceCredentialScore").value || "").trim();
      if (credential === "sc0x-course-credential" && scoreRaw) {
        const scorePercent = Number(scoreRaw);
        if (!Number.isFinite(scorePercent) || scorePercent < 0 || scorePercent > 100) {
          reportError(t("profile.evidence.error.percentage", "Enter a score between 0 and 100 percent."), container.querySelector("#institutionEvidenceCredentialScore"));
          return;
        }
        row.score_percent = scorePercent;
      }
      if (completedOn) {
        if (!validDate(completedOn)) {
          reportError(t("profile.evidence.error.dates", "Check the dates for this evidence."), container.querySelector("#institutionEvidenceCredentialDate"));
          return;
        }
        row.completed_on = completedOn;
      }
    }
    profile.institutionalEvidence = Array.isArray(profile.institutionalEvidence) ? profile.institutionalEvidence : [];
    if (profile.institutionalEvidence.length >= 20) {
      reportError(t("profile.evidence.error.max_institution", "You can save up to 20 institution evidence records."), institution);
      return;
    }
    profile.institutionalEvidence.push(row);
    container.querySelector("#institutionEvidenceCredentialScore").value = "";
    setSelectValue("institutionEvidenceProgram", "");
    container.querySelector("#institutionEvidenceUnits").value = "";
    container.querySelector("#institutionEvidenceMajorUnits").value = "";
    container.querySelector("#institutionEvidenceMajorSubjects").value = "";
    container.querySelector("#institutionEvidenceExpectedCompletion").value = "";
    container.querySelector("#institutionEvidenceValue").value = "";
    container.querySelector("#institutionEvidenceScale").value = "";
    container.querySelector("#institutionEvidenceTerm").value = "";
    setSelectValue("institutionEvidenceCredential", "");
    container.querySelector("#institutionEvidenceCredentialDate").value = "";
    renderLists(container, profile);
    onChange(profile);
  });

  const languageEvidenceDate = container.querySelector("#languageEvidenceStarted");
  if (languageEvidenceDate) languageEvidenceDate.addEventListener("change", () => {
    const complete = container.querySelector("#languageEvidenceCompleted");
    if (languageEvidenceDate.value) complete.min = languageEvidenceDate.value;
    else complete.removeAttribute("min");
  });
}
