import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createDeadlineIcs, getReviewedDeadlineEvents } from "../../frontend/javascript/pages/university/deadline-calendar.js";

const fact = (id, value, extra = {}) => ({ id, value, publication_status: "published", review_status: "reviewed",
  normalized_status: { publication: "published", review: "verified" }, topic: "deadlines", source_ids: ["official"], scope: { option_ids: ["computing"], route_ids: [], levels: ["undergraduate"], applicant_categories: [] }, ...extra });
const context = facts => ({ institution_id: "university", context: { intended_entry_cycle: "2027 entry" },
  selected_option: { id: "computing", title: "Computing", awards: ["MEng"], levels: ["undergraduate"] },
  selected_route: { id: "ucas", title: "UCAS", shared_policy_context_ids: [] },
  facts, fact_groups: { deadlines: facts.map(row => row.id) }, sources: [{ id: "official", url: "https://example.edu/apply" }] });

function catalogRecord(id) {
  const root = JSON.parse(readFileSync(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
  const stack = [root];
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;
    if (item.id === id) return item;
    stack.push(...Object.values(item));
  }
  throw new Error(`Missing catalog record ${id}`);
}

test("Stanford MBA and CS coterm projections preserve real published rounds, times and term scope", () => {
  const mba = catalogRecord("professional-evidence:gsb_mba_deadlines");
  const mbaContext = { ...context([mba]), selected_option: { id: "stanford-option-gsb-mba", title: "MBA" },
    selected_route: { id: "professional-evidence:gsb_mba_admission", title: "MBA" }, sources: [{ id: mba.source_ids[0], url: "https://www.gsb.stanford.edu/programs/mba/admission/application/deadlines" }] };
  const mbaEvents = getReviewedDeadlineEvents(mbaContext);
  assert.deepEqual(mbaEvents.filter(e => e.kind === "application").map(e => [e.deadline, e.time, e.timezone]), [
    ["2026-09-09", "16:00", "America/Los_Angeles"], ["2027-01-06", "16:00", "America/Los_Angeles"], ["2027-04-07", "16:00", "America/Los_Angeles"],
  ]);
  assert.deepEqual(mbaEvents.filter(e => e.kind === "decision").map(e => e.deadline), ["2026-12-09", "2027-04-01", "2027-05-27"]);
  assert.match(createDeadlineIcs(mbaEvents[0]), /DTSTART:20260909T230000Z/);
  assert.equal(mbaEvents[0].cycle, "Fall 2027 entry");
  assert.equal(mbaEvents[0].applicantCategoryLabel, "external_applicant");
  const coterm = catalogRecord("engineering-doerr-evidence:engineering-coterm-2027-directory-details");
  const cotermContext = { ...context([coterm]), selected_option: { id: "stanford-option-cs-ms", title: "Computer Science MS" },
    selected_route: { id: "engineering-doerr-evidence:cs-coterm", title: "CS coterm", shared_policy_context_ids: ["engineering-doerr-evidence:engineering-coterm"] } };
  const events = getReviewedDeadlineEvents(cotermContext);
  assert.deepEqual(events.map(e => [e.deadline, e.cycle]), [["2026-10-06", "2026-27"], ["2027-01-08", "2026-27"], ["2027-04-30", "2027-28"]]);
  assert.equal(events[0].applicantCategoryLabel, "current_stanford_undergraduate");
  assert.ok(events.every(event => !event.time && !event.timezone));
  const policy = catalogRecord("coterm-central-evidence:stanford-coterm-central-deadline");
  const timedContext = { ...cotermContext, facts: [coterm, policy], sources: [{ id: policy.source_ids[0], url: "https://stanford.edu/coterm" }] };
  const timed = getReviewedDeadlineEvents(timedContext);
  assert.deepEqual(timed.map(event => [event.time, event.timezone]), Array(3).fill(["23:59", "America/Los_Angeles"]));
  assert.equal(timed[0].timeSourceUrl, "https://stanford.edu/coterm");
  assert.match(createDeadlineIcs(timed[0]), /DTSTART:20261007T065900Z/);
  const conditional = { ...policy, conditions: [{ when: "additional restriction" }] };
  assert.ok(getReviewedDeadlineEvents({ ...timedContext, facts: [coterm, conditional] }).every(event => !event.time));
  assert.deepEqual(getReviewedDeadlineEvents({ ...cotermContext, selected_route: { id: "external" } }), []);
});

test("reviewed calendar keeps Medicine and other UCAS dates separate and preserves the source timezone", () => {
  const resolved = context([fact("ucas", { submission_opens: "2026-09-01",
    medicine_deadline: { date: "2026-10-15", time: "18:00", timezone: "Europe/London" },
    other_course_equal_consideration: { date: "2027-01-13", time: "18:00", timezone: "Europe/London" } })]);
  const events = getReviewedDeadlineEvents(resolved);
  assert.equal(events.find(row => row.kind === "application").deadline, "2027-01-13");
  assert.equal(events.find(row => row.kind === "application").sourceUrl, "https://example.edu/apply");
  const medicine = getReviewedDeadlineEvents({ ...resolved, selected_option: { ...resolved.selected_option, awards: ["MBBS"] } });
  assert.equal(medicine.find(row => row.kind === "application").deadline, "2026-10-15");
  assert.equal(medicine.find(row => row.kind === "application").time, "18:00");
  assert.equal(medicine.find(row => row.kind === "application").timezone, "Europe/London");
});

test("calendar does not manufacture years or accept mismatched, historical or conflicted evidence", () => {
  const rows = [fact("yearless", { windows: [{ name: "Early Action", application_due: "November 1" }] }),
    fact("mismatch", { deadline: "2027-01-13" }, { applicability: { status: "mismatched" } }),
    fact("history", { deadline: "2026-01-13" }, { publication_status: "historical", normalized_status: { publication: "historical", review: "verified" } }),
    fact("conflict", { deadline: "2027-02-01" }, { review_status: "reviewed_with_source_conflict", normalized_status: { publication: "published", review: "needs_resolution" } })];
  assert.deepEqual(getReviewedDeadlineEvents(context(rows)), []);
  assert.deepEqual(getReviewedDeadlineEvents({ ...context(rows), selected_route: null }), []);
});

test("institution-wide routes export exact shared dates without selecting a major", () => {
  const rows = [
    fact("shared-date", { deadline: "2027-01-13" }, { scope: { option_ids: [], route_ids: ["first-year"] } }),
    fact("other-program", { deadline: "2027-02-01" }),
    fact("other-route", { deadline: "2027-03-01" }, { scope: { option_ids: [], route_ids: ["transfer"] } }),
  ];
  const resolved = { ...context(rows), selected_option: null, reading_scope: "institution_route",
    selected_route: { id: "first-year", title: "University-wide first-year admission" },
    context_applicability: { option: "not_required", route: "matched", level: "matched" } };
  const events = getReviewedDeadlineEvents(resolved);
  assert.deepEqual(events.map(row => row.deadline), ["2027-01-13"]);
  assert.equal(events[0].title, "University-wide first-year admission");
  assert.match(createDeadlineIcs(events[0]), /University-wide first-year admission/);
  assert.deepEqual(getReviewedDeadlineEvents({ ...resolved, reading_scope: undefined }), []);
});

test("unstructured MBA round prose stays a reference without breaking the calendar", () => {
  const rows = [fact("mba", { rounds: "January and September 2027 have separate rounds" }),
    fact("published", { deadline: "2027-01-12" })];
  assert.deepEqual(getReviewedDeadlineEvents(context(rows)).map(row => row.deadline), ["2027-01-12"]);
});

test("a transfer calendar preserves the entry and applicant restrictions on each published date", () => {
  const resolved = context([fact("transfer", { windows: [
    { entry: "Spring 2027", date: "2026-10-15", applicant_category: ["US citizen", "US permanent resident"] },
    { entry: "Fall 2027", date: "2027-03-01", applicant_category: "Domestic and international transfer applicants" },
  ] })]);
  const events = getReviewedDeadlineEvents(resolved);
  assert.equal(events.length, 2);
  assert.equal(events[0].name, "Spring 2027");
  assert.match(events[0].applicantCategoryLabel, /US citizen.*US permanent resident/);
  assert.match(createDeadlineIcs(events[0]).replace(/\r\n /g, ""), /US citizen.*US permanent resident/);
});

test("only the selected program's mapped graduate deadline is included", () => {
  const resolved = context([fact("graduate", { deadlines: { cs: "2026-12-08", other: "2026-12-01" } })]);
  resolved.reference_labels = { cs: "Computing", other: "Another program" };
  assert.deepEqual(getReviewedDeadlineEvents(resolved).map(row => row.deadline), ["2026-12-08"]);
});

test("funding consideration dates do not become scholarship-form deadlines or leak from other awards", () => {
  const rows = [fact("consideration", { funding_program: "Imperial Inspires", availability: "conditional_course_class",
    deadline_kind: "admissions_for_scholarship_consideration", deadlines: { computing: "2027-04-28" } }, { topic: "funding" }),
  fact("excluded", { availability: "excluded_by_published_course_rules", deadline: "2027-04-28" }, { topic: "funding" }),
  fact("other-course", { deadline: "2027-05-01" }, { scope: { option_ids: ["other"] } })];
  const events = getReviewedDeadlineEvents(context(rows));
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "funding_consideration");
  assert.equal(events[0].deadline, "2027-04-28");
  assert.equal(events[0].time, "");
});

test("source-bound projections keep support test dates separate from applications and preserve dated references", () => {
  const rows = [fact("support", { original_source_text: "Application deadline remains TBA." }, { publication_status: "published_aid_categories_benefits_and_requirements_2027_28_deadlines_TBA", normalized_status: { publication: "published_with_limits", review: "verified" }, attributes: { deadline_events: [
    { date: "2026-12-05", deadline_type: "test_date", label: "Last SAT test date for financial support", exam_id: "SAT", application_category: "financial_support", cycle: "2027/28", publication_status: "published" },
    { date: "2026-11-28", deadline_type: "test_submission", time: "23:59", timezone: "Asia/Almaty", cycle: "2026/27", publication_status: "published_dated_reference" },
    { date: "2027-01-01", deadline_type: "application", publication_status: "conflicting" },
    { date: "December 5", deadline_type: "application", publication_status: "published" },
  ] } })];
  const events = getReviewedDeadlineEvents(context(rows));
  assert.equal(events.length, 2);
  assert.equal(events.filter(row => row.kind === "application").length, 0);
  const support = events.find(row => row.kind === "test");
  assert.equal(support.applicationCategory, "financial_support");
  assert.equal(support.examId, "SAT");
  assert.equal(support.cycle, "2027/28");
  assert.equal(support.time, "");
  assert.equal(support.timezone, "");
  assert.equal(support.sourceFactId, "support");
  const reference = events.find(row => row.kind === "test_submission");
  assert.equal(reference.publicationStatus, "published_dated_reference");
  assert.match(createDeadlineIcs(reference), /DTSTART:20261128T185900Z/);
});

test("labelled Imperial application rounds retain exact dates without importing an inapplicable round", () => {
  const text = "Apply by 23.59 (UK time). Round 1 Business School courses only. Round 2 Applications open on Wednesday 30 September 2026 Applications close on Wednesday 6 January 2027 Decision by Wednesday 3 March 2027 Round 3 Applications open on Thursday 7 January 2027 Applications close on Wednesday 10 March 2027 Decision by Wednesday 5 May 2027";
  const events = getReviewedDeadlineEvents(context([fact("rounds", { course_page_application_rounds_and_deadlines: text })]));
  const deadlines = events.filter(row => row.kind === "application");
  assert.deepEqual(deadlines.map(row => [row.name, row.deadline, row.time, row.timezone]), [
    ["Round 2", "2027-01-06", "23:59", "Europe/London"], ["Round 3", "2027-03-10", "23:59", "Europe/London"],
  ]);
});

test("precise ICS deadlines convert source timezones to UTC across daylight saving", () => {
  const january = createDeadlineIcs({ title: "UCAS", deadline: "2027-01-13", time: "18:00", timezone: "Europe/London" });
  assert.match(january, /DTSTART:20270113T180000Z/);
  const october = createDeadlineIcs({ title: "Medicine", deadline: "2026-10-15", time: "18:00", timezone: "Europe/London" });
  assert.match(october, /DTSTART:20261015T170000Z/);
  assert.doesNotMatch(october, /DTSTART;VALUE=DATE/);
  assert.match(october, /18:00 Europe\/London/);
  assert.equal(createDeadlineIcs({ deadline: "2027-03-28", time: "01:30", timezone: "Europe/London" }), null);
  assert.equal(createDeadlineIcs({ deadline: "2027-10-31", time: "01:30", timezone: "Europe/London" }), null);
  assert.equal(createDeadlineIcs({ deadline: "2027-01-13", time: "18:00", timezone: "unknown" }), null);
});

test("course-specific TMUA booking dates are distinct from test windows and unrelated exam inventories", () => {
  const text = "Admissions test (TMUA) You must sit TMUA. Test window: 4–8 January 2027. Booking windows (all candidates) Test window 2 Booking opens: 26 October 2026 at 15.00 (UK time) Booking closes: 21 December 2026 at 18.00 (UK time) How to book a test Other dates 1 July 2026";
  const resolved = context([fact("tmua", { course_specific_test_blocks: [text, text.replace(/^Admissions test \(TMUA\)/, "Available test inventory")] })]);
  const events = getReviewedDeadlineEvents(resolved);
  assert.deepEqual(events.map(row => [row.kind, row.deadline, row.name]), [
    ["booking_open", "2026-10-26", "TMUA"], ["booking", "2026-12-21", "TMUA"],
  ]);
  assert.equal(events[1].time, "18:00");
});
