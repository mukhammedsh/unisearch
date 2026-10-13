import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { admissionContextUrl, admissionsRequest, readAdmissionContext } from "../../frontend/javascript/pages/university/admissions-controller.js";

const uid = "mit-usa-cambridge";
const profile = {
  study_level: "Master", applicant_route: "graduate", intended_entry_cycle: "2027 entry",
  fee_status_context: "self_reported_international_overseas", exams: [{ exam: "SAT", score: 1500 }],
  selectedAdmissionChoices: { [uid]: { studyOptionId: "saved-option", applicationRouteId: "saved-route" }, other: { programId: "untouched" } },
};

test("canonical manual URL context overrides saved defaults, including intentional empty fields", () => {
  const context = readAdmissionContext(new URL("https://example.test/university.html?admission_option=new-option&admission_application_route=&admission_level=undergraduate&admission_cycle=&admission_route="), profile, uid);
  assert.equal(context.study_option_id, "new-option");
  assert.equal(context.application_route_id, "");
  assert.equal(context.study_level, "undergraduate");
  assert.equal(context.applicant_route, "");
  assert.equal(context.intended_entry_cycle, "");
  const before = structuredClone(profile);
  const request = admissionsRequest(profile, context, uid);
  assert.deepEqual(profile, before);
  assert.equal(request.profile.selectedAdmissionChoices[uid], undefined);
  assert.deepEqual(request.profile.selectedAdmissionChoices.other, { programId: "untouched" });
  assert.deepEqual(request.profile.exams, profile.exams);
  assert.equal(request.profile.study_level, undefined);
  assert.equal(request.profile.intended_entry_cycle, undefined);
  assert.equal(request.context.applicant_route, null);
});

test("context URL round trip preserves unrelated route state and does not consume legacy program IDs", () => {
  const url = new URL("https://example.test/university.html?id=mit-usa-cambridge&admission_program=legacy-cs&lang=rus#source");
  const saved = readAdmissionContext(url, profile, uid);
  assert.equal(saved.study_option_id, "saved-option");
  assert.equal(saved.study_level, "masters");
  const next = admissionContextUrl(url, { ...saved, application_route_id: "route:coterm", intended_entry_cycle: "Fall 2027 entry" });
  assert.equal(next.searchParams.get("lang"), "rus");
  assert.equal(next.hash, "#source");
  assert.equal(next.searchParams.get("admission_program"), "legacy-cs");
  assert.equal(readAdmissionContext(next, {}, uid).application_route_id, "route:coterm");
  assert.equal(readAdmissionContext(next, {}, uid).intended_entry_cycle, "Fall 2027 entry");
  assert.equal(readAdmissionContext(new URL("https://example.test/?admission_program=legacy-cs"), {}, uid).study_option_id, "");
});

test("saved per-institution context overrides global defaults while empty fields remain unknown", () => {
  const saved = structuredClone(profile);
  Object.assign(saved.selectedAdmissionChoices[uid], {
    studyLevel: "undergraduate", applicantRoute: "", intendedEntryCycle: "", feeStatusContext: "unknown",
  });
  const url = new URL("https://example.test/university.html");
  const context = readAdmissionContext(url, saved, uid);
  assert.equal(context.study_level, "undergraduate");
  assert.equal(context.applicant_route, "");
  assert.equal(context.intended_entry_cycle, "");
  assert.equal(context.fee_status_context, "unknown");
  assert.equal(saved.study_level, "Master");
  url.searchParams.set("admission_cycle", "Fall 2028 entry");
  assert.equal(readAdmissionContext(url, saved, uid).intended_entry_cycle, "Fall 2028 entry");
});
