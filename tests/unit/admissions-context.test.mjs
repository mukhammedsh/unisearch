import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { admissionContextUrl, admissionsRequest, readAdmissionContext, normalizeAdmissionCycle, getApplicationLink, hasReadableAdmissionContext, admissionContextIsSaved, programProfileSuggestions, programRestriction, singlePublishedCycle, admissionContextFields } from "../../frontend/javascript/pages/university/admissions-controller.js";

test("browsing is saved only when every application context field matches", () => {
  const saved = { studyOptionId: "course", applicationRouteId: "route", studyLevel: "undergraduate", applicantRoute: "first_year", intendedEntryCycle: "2027", feeStatusContext: "unknown" };
  const context = { study_option_id: "course", application_route_id: "route", study_level: "undergraduate", intended_entry_cycle: "2027", fee_status_context: "unknown" };
  assert.equal(admissionContextIsSaved(context, saved), true);
  // An applicant category kept in an older saved choice is implied by the route now and never makes a choice unsaved.
  assert.equal(admissionContextIsSaved(context, { ...saved, applicantRoute: "transfer" }), true);
  assert.equal(admissionContextIsSaved({ ...context, intended_entry_cycle: "2028" }, saved), false);
  assert.equal(admissionContextIsSaved(context, undefined), false);
});

const uid = "mit-usa-cambridge";

test("preparation, residency and non-degree context survives saved choice and URL round trips", () => {
  for (const level of ["preparation", "residency", "non_degree"]) {
    const saved = { selectedAdmissionChoices: { [uid]: { studyOptionId: "option", applicationRouteId: "route", studyLevel: level } } };
    const context = readAdmissionContext(new URL("https://example.test/university"), saved, uid);
    assert.equal(context.study_level, level);
    assert.deepEqual(readAdmissionContext(admissionContextUrl(new URL("https://example.test/university"), context), {}, uid), context);
    assert.equal(programProfileSuggestions({ study_level: level }).level, level);
  }
  assert.equal(readAdmissionContext(new URL("https://example.test/?admission_level=unknown"), {}, uid).study_level, "");
});

test("only explicit institution-route projection permits reading without a major", () => {
  const route = { id: "first-year" };
  assert.equal(hasReadableAdmissionContext({ selected_route: route, reading_scope: "institution_route" }), true);
  assert.equal(hasReadableAdmissionContext({ selected_route: route }), false);
  assert.equal(hasReadableAdmissionContext({ selected_option: { id: "cs" }, selected_route: route }), true);
  assert.equal(hasReadableAdmissionContext({ selected_option: { id: "cs" } }), false);
});

test("profile suggestions use the declared target without inferring the next level", () => {
  assert.deepEqual(programProfileSuggestions({ study_level: "Bachelor", major: "Computer Science", education_level: "masters" }), { major: "Computer Science", level: "undergraduate" });
  assert.deepEqual(programProfileSuggestions({ education_level: "undergraduate" }), { major: "", level: "" });
  assert.deepEqual(programProfileSuggestions({ study_level: "unknown" }), { major: "", level: "" });
});

test("restriction labels use explicit catalog metadata and never program title guesses", () => {
  assert.equal(programRestriction({ title: "Internal medicine", entry: "external" }), "");
  assert.equal(programRestriction({ entry: "no_admission" }), "internal");
  assert.equal(programRestriction({ entry: "internal" }), "internal");
  assert.equal(programRestriction({ entry: "closed" }), "restricted");
  assert.equal(programRestriction({ entry: "external_restricted" }), "restricted");
  assert.equal(programRestriction({ entry: "unresolved" }), "");
  // Research labels alone never decide a restriction; preparation supplies the closed entry value.
  assert.equal(programRestriction({ application: { classification: "internal" } }), "");
});

test("localized entry examples normalize without guessing a year from free text", () => {
  assert.equal(normalizeAdmissionCycle("осенний набор 2027 года"), "Fall 2027");
  assert.equal(normalizeAdmissionCycle("2027 жылғы күзгі қабылдау"), "Fall 2027");
  assert.equal(normalizeAdmissionCycle("2027 жылғы көктемгі қабылдау"), "Spring 2027");
  assert.equal(normalizeAdmissionCycle("осень 2027"), "Fall 2027");
  assert.equal(normalizeAdmissionCycle("Осень 2027 года"), "Fall 2027");
  assert.equal(normalizeAdmissionCycle("весна 2028"), "Spring 2028");
  assert.equal(normalizeAdmissionCycle("2027 күз"), "Fall 2027");
  assert.equal(normalizeAdmissionCycle("Not yet decided for 2027"), "Not yet decided for 2027");
  assert.equal(normalizeAdmissionCycle("осень"), "осень");
});

test("application actions use only a declared destination", () => {
  const selected_route = { destination: "Dedicated MIT Application (apply.mitadmissions.org)", source_ids: ["official"] };
  assert.equal(getApplicationLink({ selected_route }), "https://apply.mitadmissions.org/");
  assert.equal(getApplicationLink({ selected_route: { ...selected_route, destination: "UCAS Hub" }, sources: [{ id: "unrelated", url: "https://example.com" }, { id: "official", url: "https://example.edu/apply" }] }), "");
  assert.equal(getApplicationLink({ selected_route: { destination: "javascript:alert(1)" } }), "");
  assert.equal(getApplicationLink({ selected_route: null }), "");
  assert.equal(getApplicationLink({ selected_route: { destination: "https://applymitsloan.mit.edu/apply/ (select the cited programme/cohort)" } }), "https://applymitsloan.mit.edu/apply/");
  assert.equal(getApplicationLink({ selected_route: { ...selected_route, application_url: "https://admission.stanford.edu/apply/transfer/apply.html" } }), "https://admission.stanford.edu/apply/transfer/apply.html");
  assert.equal(getApplicationLink({ selected_route: { application_url: "javascript:alert(1)" } }), "");
});
const profile = {
  study_level: "Master", applicant_route: "graduate", intended_entry_cycle: "2027 entry",
  fee_status_context: "self_reported_international_overseas", exams: [{ exam: "SAT", score: 1500 }],
  selectedAdmissionChoices: { [uid]: { studyOptionId: "saved-option", applicationRouteId: "saved-route" }, other: { programId: "untouched" } },
};

test("canonical manual URL context overrides saved defaults, including intentional empty fields", () => {
  const context = readAdmissionContext(new URL("https://example.test/university.html?admission_option=new-option&admission_application_route=&admission_level=undergraduate&admission_cycle=&admission_route=transfer"), profile, uid);
  assert.equal(context.study_option_id, "new-option");
  assert.equal(context.application_route_id, "");
  assert.equal(context.study_level, "undergraduate");
  assert.ok(!("applicant_route" in context), "an old admission_route link must not become a request category");
  assert.equal(context.intended_entry_cycle, "");
  const before = structuredClone(profile);
  const request = admissionsRequest(profile, context, uid);
  assert.deepEqual(profile, before);
  assert.equal(request.profile.selectedAdmissionChoices[uid], undefined);
  assert.deepEqual(request.profile.selectedAdmissionChoices.other, { programId: "untouched" });
  assert.deepEqual(request.profile.exams, profile.exams);
  assert.equal(request.profile.study_level, undefined);
  assert.equal(request.profile.intended_entry_cycle, undefined);
  assert.ok(!("applicant_route" in request.context), "the page never sends an applicant category");
  assert.ok(!("applicant_route" in request.profile));
});

test("context URL round trip preserves unrelated route state and does not consume legacy program IDs", () => {
  const url = new URL("https://example.test/university.html?id=mit-usa-cambridge&admission_program=legacy-cs&lang=rus#source");
  const saved = readAdmissionContext(url, profile, uid);
  assert.equal(saved.study_option_id, "saved-option");
  assert.equal(saved.study_level, "");
  assert.ok(!("applicant_route" in saved));
  assert.equal(saved.intended_entry_cycle, "");
  assert.equal(saved.fee_status_context, "unknown");
  const oldLink = new URL("https://example.test/university.html?id=mit-usa-cambridge&admission_route=transfer");
  assert.equal(admissionContextUrl(oldLink, { application_route_id: "route:coterm" }).searchParams.has("admission_route"), false);
  const next = admissionContextUrl(url, { ...saved, application_route_id: "route:coterm", intended_entry_cycle: "Fall 2027 entry" });
  assert.equal(next.searchParams.get("lang"), "rus");
  assert.equal(next.hash, "#source");
  assert.equal(next.searchParams.get("admission_program"), "legacy-cs");
  assert.equal(readAdmissionContext(next, {}, uid).application_route_id, "route:coterm");
  assert.equal(readAdmissionContext(next, {}, uid).intended_entry_cycle, "Fall 2027 entry");
  assert.equal(readAdmissionContext(new URL("https://example.test/?admission_program=legacy-cs"), {}, uid).study_option_id, "");
});

test("only deliberately saved or URL-selected scope filters the public reference", () => {
  const saved = structuredClone(profile);
  Object.assign(saved.selectedAdmissionChoices[uid], {
    studyLevel: "undergraduate", applicantRoute: "", intendedEntryCycle: "", feeStatusContext: "unknown",
  });
  const url = new URL("https://example.test/university.html");
  const context = readAdmissionContext(url, saved, uid);
  assert.equal(context.study_level, "undergraduate");
  assert.ok(!("applicant_route" in context));
  assert.equal(context.intended_entry_cycle, "");
  assert.equal(context.fee_status_context, "unknown");
  assert.equal(saved.study_level, "Master");
  url.searchParams.set("admission_cycle", "Fall 2028 entry");
  assert.equal(readAdmissionContext(url, saved, uid).intended_entry_cycle, "Fall 2028 entry");
});

test("a path's single requirement cycle is used for the minimums check; fee years and several intakes are not", () => {
  const fact = (id, cycle) => ({ id, scope: { cycle } });
  const resolved = (facts, requirements) => ({ facts, fact_groups: { requirements } });
  assert.equal(singlePublishedCycle(resolved([fact("english", "Fall 2027"), fact("academic", "2027/28"), fact("fees", "2026/27")], ["english", "academic"])), "");
  assert.equal(singlePublishedCycle(resolved([fact("english", "Fall 2027"), fact("academic", "Fall 2027"), fact("fees", "2026/27"), fact("policy", "current yearless policy")], ["english", "academic", "policy"])), "Fall 2027");
  assert.equal(singlePublishedCycle(resolved([fact("english", "Fall 2027"), fact("spring", "Spring 2028")], ["english", "spring"])), "");
  assert.equal(singlePublishedCycle(resolved([fact("english", null)], ["english"])), "");
});
test("entry-year and fee-status fields appear only when the path needs them", () => {
  const fact = (id, cycle, fee_status = []) => ({ id, scope: { cycle, fee_status } });
  const resolved = (facts, requirements, extra = {}) => ({ facts, fact_groups: { requirements }, ...extra });
  const notRequired = { selected_costs: { tuition: { fee_statuses: [], fee_status_match: "not_required" } } };
  // One published intake (NU, MIT): nothing to choose.
  assert.deepEqual(admissionContextFields(resolved([fact("english", "Fall 2027")], ["english"], notRequired), { intended_entry_cycle: "Fall 2027", fee_status_context: "unknown" }), { cycle: false, fee: false });
  // Several intakes, a missing required intake or a reader's own other year keep the field.
  assert.equal(admissionContextFields(resolved([fact("a", "Fall 2027"), fact("b", "Spring 2028")], ["a", "b"]), {}).cycle, true);
  assert.equal(admissionContextFields({ ...resolved([], []), assessment: { reason: "entry_cycle_required" } }, {}).cycle, true);
  assert.equal(admissionContextFields(resolved([fact("a", "Fall 2027")], ["a"]), { intended_entry_cycle: "Fall 2028" }).cycle, true);
  // MIT transfer publishes Spring and Fall windows.
  const windows = { id: "windows", scope: {}, value: { windows: [{ entry: "Spring 2027 (February)" }, { entry: "Fall 2027 (September)" }] } };
  assert.equal(admissionContextFields({ facts: [windows], fact_groups: { deadlines: ["windows"] } }, {}).cycle, true);
  // UK fee classes (Imperial) or a reader's chosen status keep the fee field.
  assert.equal(admissionContextFields(resolved([fact("fee", "2027 entry", ["Home/Overseas only where the page labels it"])], []), {}).fee, true);
  assert.equal(admissionContextFields(resolved([], [], { selected_costs: { tuition: { fee_statuses: ["Home", "Overseas"], fee_status_match: "unknown" } } }), {}).fee, true);
  assert.equal(admissionContextFields(resolved([], [], notRequired), { fee_status_context: "self_reported_home_domestic" }).fee, true);
});
