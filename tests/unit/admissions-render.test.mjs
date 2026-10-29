import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { EXAM_CONFIG } from "../../frontend/javascript/utils/config.js";
import { admissionsProgramLabel, admissionsRouteName, renderAdmissionsContext, renderAdmissionsFacts, renderAdmissionsAssessment, renderAdmissionsValue, renderStudyOptionOverview } from "../../frontend/javascript/pages/university/admissions-render.js";

const examDefinitions = JSON.parse(await readFile(new URL("../../backend/data/exams.json", import.meta.url), "utf8"));
for (const id of ["NUET", "NUET_MATH", "NUET_CRITICAL_THINKING", "A_LEVEL_CERT", "A_LEVEL_MATHEMATICS"]) EXAM_CONFIG[id] = examDefinitions[id];

test("language exemption references use readable evidence names and keep individual review explicit", () => {
  const html = renderAdmissionsValue({ possible_exemption_evidence_kinds: ["education", "primary_language"] });
  assert.match(html, /Language background for individual exemption review/);
  assert.match(html, /Education/);
  assert.match(html, /First language/);
  assert.doesNotMatch(html, /possible_exemption_evidence_kinds|primary_language/);
});

test("detail course labels distinguish UCAS awards without changing shared helper defaults", () => {
  const option = { title: "Computing", awards: ["MEng"], catalog_classification: "ucas_course_choice" };
  assert.equal(admissionsProgramLabel(option).title, "Computing");
  assert.equal(admissionsProgramLabel(option, { includeAward: true }).title, "Computing (MEng)");
  assert.equal(admissionsProgramLabel({ ...option, title: "Computing (MEng)" }, { includeAward: true }).title, "Computing (MEng)");
  assert.equal(admissionsProgramLabel({ ...option, awards: ["BEng"] }, { includeAward: true }).title, "Computing (BEng)");
});

test("unknown study format metadata does not leak into the program overview", () => {
  const resolved = context();
  resolved.selected_option.format = { duration: "not_stated", mode: "not_stated", language: ["English"] };
  const html = renderStudyOptionOverview(resolved);
  assert.doesNotMatch(html, /not_stated|Study mode|Duration/);
  assert.match(html, /English/);
});

test("a source route classification distinguishes external and coterm procedures when no title is published", () => {
  assert.equal(admissionsRouteName({ title: null, target: null, classification: "external non-professional graduate application" }), "external non-professional graduate application");
  assert.equal(admissionsRouteName({ title: null, target: null, classification: "Computer Science coterm application" }), "Computer Science coterm application");
  assert.equal(admissionsRouteName({ title: "UCAS", classification: "course_specific" }), "UCAS");
});

function context() {
  return {
    selected_option: { id: "example-option", title: "Computing" },
    selected_route: { id: "example-route", title: "Institutional admission" },
    facts: [], unknowns: [], sources: [], fact_groups: {}, history: {},
  };
}

function fact(value, extra = {}) {
  return {
    id: "private-fact-id", topic: "costs", value, source_ids: ["source-private"],
    publication_status: "published", checked_at: "2026-10-12", period: { kind: "named", label: "2026–2027" },
    applicability: { status: "conditional" },
    scope: { option_ids: ["example-option"], route_ids: ["example-route"], levels: ["undergraduate"], cycle: "Fall 2027" },
    ...extra,
  };
}

test("institution-route reading renders scoped facts without inventing a selected program", () => {
  const resolved = context();
  resolved.selected_option = null;
  resolved.reading_scope = "institution_route";
  resolved.facts = [fact("Shared requirements remain readable.", { scope: { route_ids: ["example-route"], levels: ["undergraduate"] }, topic: "eligibility" })];
  resolved.fact_groups = { requirements: ["private-fact-id"] };
  assert.match(renderAdmissionsContext(resolved, { domains: ["requirements"], includeAssessment: false }), /Shared requirements remain readable/);
  delete resolved.reading_scope;
  assert.doesNotMatch(renderAdmissionsContext(resolved), /Shared requirements remain readable/);
});

test("program overviews show scoped source descriptions and essentials without expanding compound records", () => {
  const resolved = context();
  resolved.selected_option.format = { duration: "not_stated", language: ["English"], mode: "On-campus", campus: "Astana" };
  const overviewFact = (id, value, extra = {}) => fact(value, { id, review_status: "reviewed", scope: { option_ids: ["example-option"] }, ...extra });
  resolved.facts = [
    overviewFact("other", { description: "Another program" }, { scope: { option_ids: ["another-option"] } }),
    overviewFact("route", { description: "Route-only conditions" }, { scope: { option_ids: ["example-option"], route_ids: ["example-route"] } }),
    overviewFact("conflicting", { description: "Conflicting wording" }, { publication_status: "conflicting" }),
    overviewFact("summary", { course_page_programme_summary: "Build computing systems.", duration: "4 years", start_date: "October 2027", course_page_tuition_fees: { amount: 12345 }, structure: "Detailed curriculum remains available." }),
  ];
  resolved.fact_groups.study = resolved.facts.map(row => row.id);
  const html = renderStudyOptionOverview(resolved);
  for (const text of ["Build computing systems.", "4 years", "October 2027", "On-campus", "English", "Astana"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Another program|Route-only|Conflicting wording|12345|Detailed curriculum/);
  const fullRecord = renderAdmissionsContext(resolved, { presentation: "simple", programOnly: true });
  assert.match(fullRecord, /12,345/);
  assert.match(fullRecord, /Detailed curriculum remains available/);
});

test("program overviews retain source-language descriptions without guessing a fixed duration", () => {
  const resolved = context();
  resolved.facts = [fact({ A3i6E: "An MS does not lead to the PhD.", expected_length: { value: 2, unit: "Years", status: "catalog_metadata_not_fixed_individual_duration" } }, { review_status: "original_catalog_content_rechecked_2026_10_03", scope: { option_ids: ["example-option"] } })];
  resolved.fact_groups.study = ["private-fact-id"];
  assert.match(renderStudyOptionOverview(resolved), /An MS does not lead to the PhD/);
  assert.doesNotMatch(renderStudyOptionOverview(resolved), /Duration|2|Years/);
  assert.equal(renderStudyOptionOverview({ selected_option: null }), "");
  resolved.facts = [
    fact({ source_content: "Full course lists." }, { id: "structure", topic: "study_structure", review_status: "verified", scope: { option_ids: ["example-option"] } }),
    fact({ source_content: "The undergraduate program covers computing theory and practice." }, { id: "content", topic: "study_content", review_status: "verified", scope: { option_ids: ["example-option"] } }),
  ];
  resolved.fact_groups.study = ["structure", "content"];
  assert.match(renderStudyOptionOverview(resolved), /The undergraduate program covers computing theory and practice/);
  assert.doesNotMatch(renderStudyOptionOverview(resolved), /Full course lists/);
});

test("structured source prices retain original currencies, periods, zero amounts, and limits", () => {
  const resolved = context();
  resolved.facts = [fact({ currency: "GBP", period: "Per academic quarter", tuition: 0, source_content: "The fee is conditional on course load.", health: { amount: 250, unit: "Per quarter" } })];
  resolved.fact_groups = { costs: ["private-fact-id"] };
  const html = renderAdmissionsFacts(resolved, ["costs"]);
  assert.match(html, /GBP/);
  assert.match(html, /Per academic quarter/);
  assert.match(html, /<dd>0<\/dd>/);
  assert.match(html, /conditional on course load/);
  assert.match(html, /2026–2027/);
  assert.doesNotMatch(html, /annual cost|net cost|example-option|example-route/);
  assert.match(html, /data-admissions-fact="private-fact-id"/);
  assert.doesNotMatch(html, /UnknownUnknown|<strong>Conditions and exceptions<\/strong>/);
});

test("provenance and provider field IDs stay hidden while significant source narratives remain", () => {
  const html = renderAdmissionsValue({
    A3i6E: "Admission requires an individual advisor arrangement.",
    WOZxr: "No external credit is accepted.",
    ItCSB: "Complete 90 units and a thesis.",
    source_ids: ["source-deadbeef"], provenance: { original_id: "private-id" },
    parent_course_fact_id: "provider-fact-id", conditional_shared_rule_refs: ["provider-rule-id"],
    source_content: [{ heading: "Academic standard", content: "A published condition." }],
    minimum: 4.25, scale: 5,
  });
  assert.match(html, /individual advisor arrangement/);
  assert.match(html, /No external credit/);
  assert.match(html, /Complete 90 units/);
  assert.match(html, /A published condition/);
  assert.match(html, /4.25/);
  assert.doesNotMatch(html, /A3i6E|WOZxr|ItCSB|deadbeef|private-id|provider-fact-id|provider-rule-id/);
});

test("fact applicability is conditional and source links only accept safe HTTP URLs", () => {
  const resolved = context();
  resolved.facts = [fact("Confirm the actual fee status.", { source_ids: ["safe", "unsafe", "credentialed"] })];
  resolved.fact_groups = { costs: ["private-fact-id"] };
  resolved.sources = [
    { id: "safe", url: "https://example.edu/fees", title: "Official fee page", checked_at: "2026-10-12" },
    { id: "unsafe", url: "javascript:alert(1)", title: "Unsafe" },
    { id: "credentialed", url: "https://private:secret@example.edu/", title: "Private" },
  ];
  const html = renderAdmissionsContext(resolved);
  assert.match(html, /Conditional — applicability still needs verification/);
  assert.match(html, /href="https:\/\/example.edu\/fees"/);
  assert.match(html, /Official fee page/);
  assert.match(html, /Official page checked/);
  assert.doesNotMatch(html, /javascript:|private:secret|>Unsafe<|>Private</);
});

test("a real zero remains available, while null never becomes zero", () => {
  const resolved = context();
  resolved.assessment = { chancePercent: 0, reason: "requirements_not_met", activeChoice: { details: { checks: [] } } };
  const zero = renderAdmissionsAssessment(resolved);
  assert.match(zero, /<strong>0%<\/strong>/);
  assert.match(zero, /not an admission probability/);
  resolved.assessment.chancePercent = null;
  const unknown = renderAdmissionsAssessment(resolved);
  assert.match(unknown, /No requirements-match percentage/);
  assert.doesNotMatch(unknown, /<strong>0%<\/strong>/);
});

test("assessment preserves reported evidence, exact source conditions, and separately labelled rules", () => {
  const resolved = context();
  resolved.assessment = {
    chancePercent: null, reason: "unassessed_minimums",
    activeChoice: { details: { checks: [{
      kind: "scoped_gpa", status: "unassessed", minimum: 4.25,
      checkId: "hidden-check-id", annotationId: "hidden-annotation-id",
      rule: { kind: "scoped_gpa", metric: "technical", minimum: 4.25, scale: 5 },
      provided: { university_id: "hidden-university-id", program_id: "hidden-program-id", metric: "technical", value: 4.1, scale: 5 },
      sourceRule: fact({ technical_gpa: { minimum: 4.25, scale: "MIT 5.0 scale" } }, { conditions_and_exceptions: ["Enrollment must first be verified."], exceptions: ["Research advisor approval remains separate."] }),
    }] } },
  };
  const html = renderAdmissionsAssessment(resolved);
  assert.match(html, /Not assessed/);
  assert.match(html, /Original published rule/);
  assert.match(html, /Reported evidence/);
  assert.match(html, /4.1/);
  assert.match(html, /self-reported/);
  assert.match(html, /Enrollment must first be verified/);
  assert.match(html, /Research advisor approval remains separate/);
  assert.doesNotMatch(html, /hidden-check-id|hidden-annotation-id|hidden-university-id|hidden-program-id|scoped_gpa/);
});

test("academic checks expose failed and missing sections without replacing the source-backed group", () => {
  const resolved = context();
  const check = {
    kind: "academic_requirement", status: "unmet", source_ids: ["source-private"],
    rule: { alternatives: [{ exam_id: "NUET", minimum: 120, component_minimums: { NUET_MATH: 50, NUET_CRITICAL_THINKING: 50 } }] },
    provided: { exam: "NUET", score: 120, taken_on: "2026-03-01", minimum_checks: [
      { exam: "NUET", minimum: 120, provided: 120, status: "met" },
      { exam: "NUET_MATH", minimum: 50, provided: 40, status: "unmet" },
      { exam: "NUET_CRITICAL_THINKING", minimum: 50, provided: 80, status: "met" },
    ] },
    sourceRule: fact("The total and both sections must meet their minima.", { conditions: ["This published cycle only."] }),
  };
  resolved.sources = [{ id: "source-private", url: "https://example.edu/requirements", title: "Official requirements" }];
  resolved.assessment = { chancePercent: 0, activeChoice: { details: { checks: [check] } } };
  const html = renderAdmissionsAssessment(resolved);
  assert.match(html, /Academic qualification/);
  assert.doesNotMatch(html, /<dt>Kind<\/dt>/);
  assert.match(html, /data-minimum-exam="NUET_MATH" data-minimum-status="unmet"[^]*?Published minimum: 50[^]*?Reported evidence: 40/);
  assert.match(html, /data-minimum-exam="NUET_CRITICAL_THINKING" data-minimum-status="met"/);
  for (const text of ["NUET Mathematics", "This published cycle only.", "https://example.edu/requirements"]) assert.ok(html.includes(text), text);
  assert.match(html, /2026[‑-]03-01/);
  assert.equal((html.match(/<strong>0%<\/strong>/g) || []).length, 1);
  assert.equal((html.match(/data-minimum-checks/g) || []).length, 1);
  assert.doesNotMatch(html, /Minimum checks|minimum_checks/);

  check.status = "missing";
  check.provided.minimum_checks[2] = { exam: "NUET_CRITICAL_THINKING", minimum: 50, provided: null, status: "missing" };
  resolved.assessment.chancePercent = null;
  const missing = renderAdmissionsAssessment(resolved);
  assert.match(missing, /data-minimum-exam="NUET_CRITICAL_THINKING" data-minimum-status="missing"[^]*?Reported evidence: Not provided/);
  assert.doesNotMatch(missing, /<strong>0%<\/strong>/);
});

test("counted A-level minimums show native grades and the count of qualifying subjects", () => {
  const resolved = context();
  resolved.assessment = { chancePercent: 0, activeChoice: { details: { checks: [{
    kind: "academic_requirement", status: "unmet",
    rule: { alternatives: [{ exam_id: "A_LEVEL_CERT", components_at_least: { count: 3, minimum: 4 } }] },
    provided: { exam: "A_LEVEL_CERT", score: 13, details: { components: [{ exam: "A_LEVEL_MATHEMATICS", score: 5 }] }, minimum_checks: [
      { exam: "A_LEVEL_CERT", minimum: { count: 3, minimum: 4 }, provided: { reported: 3, meeting_minimum: 2 }, status: "unmet" },
    ] },
    sourceRule: fact("Three A-level subjects, each at grade B or higher."),
  }] } } };
  const html = renderAdmissionsAssessment(resolved);
  assert.match(html, /At least 3 results, each B or higher/);
  assert.match(html, /3 reported; 2 meet the minimum/);
  assert.match(html, /data-minimum-exam="A_LEVEL_CERT" data-minimum-status="unmet"/);
  assert.match(html, /Three A-level subjects, each at grade B or higher/);
  assert.doesNotMatch(html, /each 4 or higher/);
  assert.doesNotMatch(html, /<dt>Minimum<\/dt><dd>4<\/dd>/);
});

test("reported A-level subject results use native grades instead of internal comparison points", () => {
  const html = renderAdmissionsValue({ exam: "A_LEVEL_MATHEMATICS", score: 4, raw_value: "B" });
  assert.match(html, /<dt>Reported score<\/dt><dd>B<\/dd>/);
  assert.doesNotMatch(html, /<dt>Reported score<\/dt><dd>4<\/dd>/);
});

test("manual prior-degree checks and funding contexts explain why no percentage is calculated", () => {
  const resolved = context();
  resolved.assessment = { chancePercent: null, reason: "funding_selection_separate", activeChoice: { details: { checks: [{
    kind: "manual_minimum", status: "unassessed", rule: { minimum: 2.67, scale: 4 }, provided: { gpa: 4.85, gpa_scale: 5 },
    sourceRule: fact("A prior nursing qualification must meet the published academic standard."),
  }] } } };
  const html = renderAdmissionsAssessment(resolved);
  for (const text of ["Funding selection is separate from admission", "Minimum requiring individual evidence review", "2.67", "4.85", "prior nursing qualification"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<strong>0%<\/strong>|manual_minimum|funding_selection_separate/);
});

test("unknowns and scoped historical source records remain visibly separate from current facts", () => {
  const resolved = context();
  resolved.unknowns = [{ reason: "Future-cycle tuition has not been published.", official_next_step: "Check the official fee page.", source_ids: [] }];
  resolved.history = { facts: [fact({ amount: 3000 }, { id: "old-id" })], unknowns: [] };
  const html = renderAdmissionsContext(resolved);
  assert.match(html, /Future-cycle tuition has not been published/);
  assert.match(html, /Check the official fee page/);
  assert.match(html, /Historical source record/);
  assert.match(html, /not current requirements or prices/);
  assert.doesNotMatch(html.replace(/data-admissions-fact="[^"]*"/g, ""), /old-id/);
});

test("unselected and incompatible contexts do not display unrelated facts", () => {
  assert.match(renderAdmissionsContext(context()), /No source records/);
  assert.match(renderAdmissionsContext({}), /Select a study option/);
  const resolved = context();
  resolved.facts = [fact("This does not belong to this route.", { applicability: { status: "mismatched" } })];
  resolved.fact_groups = { costs: ["private-fact-id"] };
  assert.doesNotMatch(renderAdmissionsFacts(resolved, ["costs"]), /does not belong/);
  assert.match(renderAdmissionsValue("<script>alert(1)</script>"), /&lt;script&gt;/);
});

test("publication, evidence review, and applicability remain independent", () => {
  const resolved = context();
  resolved.facts = [fact("Read both official versions.", { review_status: "conflicting", conditions: [], conditions_and_exceptions: null, exceptions: null })];
  resolved.fact_groups = { costs: ["private-fact-id"] };
  const html = renderAdmissionsFacts(resolved, ["costs"]);
  assert.match(html, /<span class="admissions-catalog__status">Published<\/span>/);
  assert.match(html, /Evidence review: Conflicting official sources/);
  assert.match(html, /Conditional — applicability still needs verification<\/span><\/summary>/);
  assert.doesNotMatch(html, /UnknownUnknown|<strong>Conditions and exceptions<\/strong>/);
  resolved.facts[0].publication_status = "unknown";
  resolved.facts[0].review_status = "verified";
  const reviewedUnknown = renderAdmissionsFacts(resolved, ["costs"]);
  assert.match(reviewedUnknown, /<span class="admissions-catalog__status">Unknown<\/span>/);
  assert.match(reviewedUnknown, /Evidence review: Verified/);
});

test("meaningful hyphenated source wording survives while actual internal references stay hidden", () => {
  const html = renderAdmissionsValue({
    award: "need-based-grant", route: "course-specific-admission",
    "full-time-study": "programme-specific-condition",
    source_id: "source-private", program_ids: ["internal-option-id"],
    gre_general_and_subject: { not_considered_both: ["stanford-aa-ms", "stanford-cs-phd"] },
  }, { "stanford-aa-ms": "Aeronautics and Astronautics (MS)", "stanford-cs-phd": "Computer Science (PhD)" });
  assert.match(html, /need-based-grant/);
  assert.match(html, /course-specific-admission/);
  assert.match(html, /Full-time-study/);
  assert.match(html, /programme-specific-condition/);
  assert.match(html, /Aeronautics and Astronautics \(MS\)/);
  assert.match(html, /Computer Science \(PhD\)/);
  assert.doesNotMatch(html, /source-private|internal-option-id|stanford-aa-ms|stanford-cs-phd/);
});

test("resolved fact aliases use source-bound human labels without changing source prose", () => {
  const resolved = context();
  resolved.reference_labels = { "stanford-aa-ms": "Aeronautics and Astronautics (MS)" };
  resolved.facts = [fact({ gre_general_and_subject: { not_considered_both: ["stanford-aa-ms"] }, note: "course-specific-admission" })];
  resolved.fact_groups = { requirements: ["private-fact-id"] };
  const html = renderAdmissionsFacts(resolved, ["requirements"]);
  assert.match(html, /Aeronautics and Astronautics \(MS\)/);
  assert.match(html, /course-specific-admission/);
  assert.doesNotMatch(html, /stanford-aa-ms/);
});

test("unassessed typed profile claims remain available without guessed program scope", () => {
  const resolved = context();
  resolved.assessment = {
    chancePercent: null, reason: "unassessed_minimums",
    activeChoice: { details: { checks: [] } },
    reportedEvidence: {
      origin: "self_reported",
      language_evidence: [{ kind: "education", language: "en", country: "Kazakhstan", entirely_in_language: true }],
      institutional_evidence: [{ kind: "enrollment", program_id: "another-private-program-id", university_id: "private-university-id", major_units: 102 }],
    },
  };
  const html = renderAdmissionsAssessment(resolved);
  assert.match(html, /Kazakhstan/);
  assert.match(html, /102/);
  assert.match(html, /<dt>Study option<\/dt><dd>Unknown<\/dd>/);
  assert.match(html, /Applicant evidence is self-reported/);
  assert.doesNotMatch(html, /another-private-program-id|private-university-id/);
});

test("simple source headings use published labels and bounded topic categories", () => {
  const resolved = context();
  resolved.facts = [
    fact({ label: "IELTS Academic", overall: 7 }, { id: "language", topic: "language_tests" }),
    fact("A degree and documents are required.", { id: "academic", topic: "academic_qualification_and_documents" }),
    fact("Read the official policy.", { id: "tests", topic: "standardized_tests" }),
    fact({ title: "Nested title", heading: "Nested heading", minimum: 4 }, { id: "named", title: "Published academic rule", topic: "academic_requirements" }),
    fact({ heading: "Course-specific interview", condition: "Only when invited." }, { id: "interview", topic: "interview" }),
  ];
  resolved.fact_groups = { requirements: ["language", "academic", "tests", "named", "interview"] };
  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  assert.match(html, /<span>IELTS Academic<\/span>/);
  assert.match(html, /<span>Academic qualifications · Application documents<\/span>/);
  assert.match(html, /<span>Tests<\/span>/);
  assert.match(html, /<span>Published academic rule<\/span>/);
  assert.match(html, /<span>Course-specific interview<\/span>/);
  assert.match(html, /A degree and documents are required/);
  assert.doesNotMatch(html, /<span>Admission requirements<\/span>|academic_qualification_and_documents/);
});

test("simple source details retain independent statuses, limits, periods and sources without repeated applicability", () => {
  const resolved = context();
  resolved.facts = [fact({ amount: 0, currency: "GBP", period: "Per quarter" }, {
    topic: "tuition", review_status: "conflicting", publication_status: "published",
    conditions: ["Only after fee-status assessment."], exceptions: ["Course load may change the charge."],
  })];
  resolved.fact_groups = { costs: ["private-fact-id"] };
  resolved.sources = [{ id: "source-private", title: "Official fees", url: "https://example.edu/fees" }];
  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  const summary = html.match(/<summary class="admissions-catalog__heading">([\s\S]*?)<\/summary>/)[1];
  assert.match(summary, /Conflicting official sources/);
  assert.doesNotMatch(summary, />Published</);
  assert.equal((html.match(/Scope varies/g) || []).length, 1);
  assert.match(html, /<details class="admissions-catalog__evidence">/);
  for (const value of ["Published", "Evidence review", "Conflicting official sources", "GBP", "Per quarter", "Only after fee-status assessment", "Course load may change the charge", "Source scope", "Computing", "Fall 2027", "2026–2027", "https://example.edu/fees"]) assert.ok(html.includes(value), value);
  assert.match(html, /2026[‑-]10-12/);
  assert.match(html, /<dd>0<\/dd>/);
});

test("simple assessment collapses exact checks and evidence while preserving real failures and unknowns", () => {
  const resolved = context();
  resolved.assessment = { chancePercent: 0, reason: "requirements_not_met", activeChoice: { details: { checks: [{ kind: "scoped_gpa", status: "unmet", minimum: 4.25, provided: 4, sourceRule: fact({ minimum: 4.25, scale: 5 }) }] } } };
  resolved.unknowns = [{ reason: "Future price remains unknown.", official_next_step: "Ask the official office." }];
  resolved.history = { facts: [fact("Previous tuition only.", { id: "old" })] };
  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  assert.match(html, /<strong>0%<\/strong>/);
  assert.match(html, /At least one evaluated published minimum was not met/);
  assert.match(html, /<details class="admissions-catalog__assessment-detail">/);
  assert.match(html, /4.25/);
  assert.match(html, /Original published rule/);
  assert.match(html, /Future price remains unknown/);
  assert.match(html, /Ask the official office/);
  assert.match(html, /Previous tuition only/);
  assert.match(html, /not current requirements or prices/);
});

test("program-only browsing never renders route-specific facts or an applicant assessment", () => {
  const resolved = context();
  resolved.selected_route = null;
  resolved.facts = [
    fact("Degree curriculum.", { id: "study", topic: "study_content", scope: { option_ids: ["example-option"], route_ids: [] } }),
    fact("Another program curriculum.", { id: "other", topic: "study_content", scope: { option_ids: ["another-option"], route_ids: [] } }),
    fact("Mismatched study level.", { id: "mismatched", topic: "study_content", applicability: { status: "mismatched" }, scope: { option_ids: ["example-option"], route_ids: [] } }),
    fact("General institution-wide curriculum.", { id: "general", topic: "study_content", scope: { option_ids: [], route_ids: [] } }),
    fact("Unselected route rules.", { id: "route", topic: "academic_requirements" }),
    fact("Program admission prerequisites.", { id: "program-requirements", topic: "academic_requirements", scope: { option_ids: ["example-option"], route_ids: [] } }),
  ];
  resolved.fact_groups = { study: ["study", "other", "mismatched", "general"], requirements: ["route", "program-requirements"] };
  resolved.assessment = { chancePercent: 100 };
  resolved.unknowns = [{ reason: "Curriculum detail unknown.", scope: { option_ids: ["example-option"], route_ids: [] } }, { reason: "Unselected-route price unknown.", scope: { route_ids: ["example-route"] } }];
  const html = renderAdmissionsContext(resolved, { presentation: "simple", programOnly: true });
  assert.match(html, /Degree curriculum/);
  assert.match(html, /Curriculum detail unknown/);
  assert.doesNotMatch(html, /Unselected route rules|Program admission prerequisites|Another program curriculum|Mismatched study level|General institution-wide curriculum|Unselected-route price unknown|100%|UniChance/);
  assert.match(renderAdmissionsContext(resolved), /Select a study option/);
});

test("simple sections show a multi-domain source fact once with all topic headings", () => {
  const resolved = context();
  resolved.facts = [fact("Tests apply; funding needs a separate award.", { topic: "tests", topics: ["funding"] })];
  resolved.fact_groups = { requirements: ["private-fact-id"], funding: ["private-fact-id"] };
  const html = renderAdmissionsContext(resolved, { presentation: "simple", includeSourceNote: false });
  assert.match(html, /<span>Tests · Funding<\/span>/);
  assert.equal((html.match(/data-admissions-fact="private-fact-id"/g) || []).length, 1);
  assert.match(html, /Tests apply; funding needs a separate award/);
  assert.doesNotMatch(html, /data-admissions-domain="funding"|Official wording remains in its original language|No source records/);
  const detailed = renderAdmissionsContext(resolved);
  assert.equal((detailed.match(/data-admissions-fact="private-fact-id"/g) || []).length, 2);
  assert.match(detailed, /Official wording remains in its original language/);
});

test("simple exam headings distinguish explicit source names without interpreting IDs or generic rule markers", () => {
  const resolved = context();
  resolved.facts = [
    fact({ test: "Oxford Test of English Advanced", standard: { overall: 145 }, higher: { overall: 155 } }, { id: "source-exam-one", topic: "language_tests" }),
    fact({ exam: "IELTS Academic", minimum: 7, exceptions: "One sitting only." }, { id: "source-exam-two", topic: "language_tests" }),
    fact({ qualification: "International Baccalaureate", minimum: 39 }, { id: "credential", topic: "qualifications" }),
    fact({ name: "TOEFL iBT", minimum: 100 }, { id: "source-exam-three", topic: "language_tests" }),
    fact({ test: "required", rule: "Specific published condition." }, { id: "imperial-english-guessed-name", topic: "language_tests" }),
  ];
  resolved.fact_groups = { requirements: resolved.facts.map(row => row.id) };
  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  for (const name of ["Oxford Test of English Advanced", "IELTS Academic", "International Baccalaureate", "TOEFL iBT"]) assert.ok(html.includes(`<span>${name}</span>`), name);
  assert.match(html, /One sitting only/);
  assert.match(html, /145/);
  assert.match(html, /155/);
  assert.match(html, /Specific published condition/);
  assert.doesNotMatch(html, /<span>required<\/span>|<span>Rule<\/span>|<span>Guessed name<\/span>/);
  assert.doesNotMatch(renderAdmissionsContext(resolved), /<span>Oxford Test of English Advanced<\/span>/);
});

test("simple source titles identify a fact only when its official source is not shared", () => {
  const resolved = context();
  resolved.facts = [
    fact("Published exemption conditions.", { id: "exemption", topic: "language_exemptions", source_ids: ["specific"] }),
    fact({ standard: 115 }, { id: "unnamed-one", topic: "language_tests", source_ids: ["shared"] }),
    fact({ standard: 6.5 }, { id: "unnamed-two", topic: "language_tests", source_ids: ["shared"] }),
  ];
  resolved.fact_groups = { requirements: resolved.facts.map(row => row.id) };
  resolved.sources = [{ id: "specific", title: "English language exemption", url: "https://example.edu/exemptions" }, { id: "shared", title: "English language requirements", url: "https://example.edu/english" }];
  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  assert.match(html, /<span>English language exemption<\/span>/);
  assert.doesNotMatch(html, /<span>English language requirements<\/span>/);
  assert.match(html, /Published exemption conditions/);
});

test("simple anonymous fact groups keep each record, its conditions, scope, period, source, and warnings", () => {
  const resolved = context();
  resolved.facts = [
    fact({ language_band: "Minimum 7.0", grading_note: "No component below 6.5." }, {
      id: "anonymous-one", topic: "language_tests", source_ids: ["english-policy", "shared-english"],
      publication_status: "unknown", review_status: "conflicting",
      conditions: ["Applies to taught master's applicants."], exceptions: ["Some courses require higher scores."],
      period: { kind: "named", label: "2026–2027 intake" },
      scope: { option_ids: ["example-option"], route_ids: ["example-route"], levels: ["masters"], cycle: "Fall 2026" },
      applicability: { status: "conditional" },
    }),
    fact({ language_band: "Minimum 6.5", grading_note: "No component below 6.0." }, {
      id: "anonymous-two", topic: "language_tests", source_ids: ["english-course-page", "shared-english"],
      publication_status: "published", review_status: "verified_current_page",
      conditions: ["For undergraduate applicants."],
      period: { kind: "named", label: "2027–2028 intake" },
      scope: { option_ids: ["example-option"], route_ids: ["example-route"], levels: ["undergraduate"], cycle: "Fall 2027" },
      applicability: { status: "matched" },
    }),
  ];
  resolved.fact_groups = { requirements: ["anonymous-one", "anonymous-two"] };
  resolved.sources = [
    { id: "english-policy", title: "Official English policy", url: "https://example.edu/english" },
    { id: "english-course-page", title: "Official course page", url: "https://example.edu/course" },
    { id: "shared-english", title: "Shared English overview", url: "https://example.edu/english-overview" },
  ];

  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  assert.equal((html.match(/class="admissions-catalog__group-record"/g) || []).length, 2);
  for (const value of ["Minimum 7.0", "Minimum 6.5", "No component below 6.5", "No component below 6.0", "Applies to taught master&#039;s applicants", "Some courses require higher scores", "For undergraduate applicants", "2026–2027 intake", "2027–2028 intake", "Fall 2026", "Fall 2027", "Official English policy", "Official course page", "Conflicting official sources", "Unknown", "Scope varies"]) {
    assert.ok(html.includes(value), value);
  }
});

test("simple qualification tables retain source wording, extra fields, conditions, and provenance", () => {
  const resolved = context();
  resolved.facts = [fact({
    interpretation: "The university evaluates each qualification in context.",
    labelled_qualifications: [{
      qualification_or_country: "International Baccalaureate",
      tables: [["Subject", "Published minimum"], ["Higher level", "6"], ["Total", "38"]],
      published_text: "Applicants must present the full diploma and meet the subject minimums.",
      unclassified_official_note: "The mathematics subject must be taken at higher level.",
    }],
  }, {
    id: "qualification-table", topic: "academic_qualification", source_ids: ["qualification-policy"],
    publication_status: "published", review_status: "reviewed",
    conditions: ["Only for first-year applicants."],
    conditions_and_exceptions: ["Required subjects vary by course."],
    exceptions: ["A separate test may also apply."],
    checked_at: "2026-10-13", period: { kind: "named", label: "2027 entry" },
    scope: { option_ids: ["example-option"], route_ids: ["example-route"], levels: ["undergraduate"], cycle: "Fall 2027", fee_status: ["all applicants"] },
    applicability: { status: "conditional" },
  })];
  resolved.fact_groups = { requirements: ["qualification-table"] };
  resolved.sources = [{ id: "qualification-policy", title: "Official qualification policy", url: "https://example.edu/qualifications", checked_at: "2026-10-13" }];

  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  for (const value of ["International Baccalaureate", "Subject", "Published minimum", "Higher level", "The mathematics subject must be taken at higher level", "full diploma", "The university evaluates each qualification", "Only for first-year applicants", "Required subjects vary by course", "A separate test may also apply", "Evidence review", "Source and conditions", "Published period", "2027 entry", "Fall 2027", "Official qualification policy", "https://example.edu/qualifications", "Scope varies"]) {
    assert.ok(html.includes(value), value);
  }
  assert.match(html, /2026[‑-]10-13/);
});

test("simple unknown information is closed by default while retaining every next step, scope and source", () => {
  const resolved = context();
  resolved.unknowns = [{ reason: "Award applicability has not been established.", official_next_step: "Ask the official funding office.", scope: { option_ids: ["example-option"], levels: ["undergraduate"], cycle: "Fall 2027", additional_dimensions: { employer: "Employer sponsorship remains unverified." } }, source_ids: ["official"] }];
  resolved.sources = [{ id: "official", title: "Official funding scope", url: "https://example.edu/funding" }];
  const html = renderAdmissionsContext(resolved, { presentation: "simple" });
  assert.match(html, /<details class="admissions-catalog__fact admissions-catalog__unknowns"><summary class="admissions-catalog__heading">Unresolved source information \(1\)/);
  for (const text of ["Award applicability has not been established", "Ask the official funding office", "Computing", "Fall 2027", "Employer sponsorship remains unverified", "https://example.edu/funding"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(renderAdmissionsContext(resolved), /admissions-catalog__unknowns/);
});

test("simple route classification labels remain separate from published titles and default comparison prose", () => {
  assert.equal(admissionsRouteName({ classification: "ucas_course_choice" }, { presentation: "simple" }), "UCAS course choice");
  assert.equal(admissionsRouteName({ classification: "ucas_course_choice" }), "ucas_course_choice");
  assert.equal(admissionsRouteName({ title: "Published course application", classification: "ucas_course_choice" }, { presentation: "simple" }), "Published course application");
  assert.equal(admissionsRouteName({ target: "Official programme target", classification: "ucas_course_choice" }, { presentation: "simple" }), "Official programme target");
  assert.equal(admissionsRouteName({ classification: "external non-professional graduate application" }, { presentation: "simple" }), "external non-professional graduate application");
  assert.equal(admissionsRouteName({ classification: "internal_progression" }, { presentation: "simple" }), "internal progression");
});
