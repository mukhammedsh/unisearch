import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeadlineIcs, getReviewedDeadlineEvents } from "../../frontend/javascript/pages/university/deadline-calendar.js";

const fact = (id, value, extra = {}) => ({ id, value, publication_status: "published", review_status: "reviewed",
  topic: "deadlines", source_ids: ["official"], scope: { option_ids: ["computing"], route_ids: [], levels: ["undergraduate"], applicant_categories: [] }, ...extra });
const context = facts => ({ institution_id: "university", context: { intended_entry_cycle: "2027 entry" },
  selected_option: { id: "computing", title: "Computing", awards: ["MEng"], levels: ["undergraduate"] },
  selected_route: { id: "ucas", title: "UCAS", shared_policy_context_ids: [] },
  facts, fact_groups: { deadlines: facts.map(row => row.id) }, sources: [{ id: "official", url: "https://example.edu/apply" }] });

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
    fact("history", { deadline: "2026-01-13" }, { publication_status: "historical" }),
    fact("conflict", { deadline: "2027-02-01" }, { review_status: "reviewed_with_source_conflict" })];
  assert.deepEqual(getReviewedDeadlineEvents(context(rows)), []);
  assert.deepEqual(getReviewedDeadlineEvents({ ...context(rows), selected_route: null }), []);
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
