import assert from "node:assert/strict";
import { test } from "node:test";
import { COUNTRY_CODES, getCountryName, getCountryOptions } from "../../frontend/javascript/utils/countries.js";
import { createDeadlineIcs, escapeIcsText, getCalendarCells, parseExactDeadlineDate } from "../../frontend/javascript/pages/university/deadline-calendar.js";

test("citizenship options cover the country code list with localized names", () => {
  assert.equal(COUNTRY_CODES.length, 250);
  assert.equal(new Set(COUNTRY_CODES).size, COUNTRY_CODES.length);
  assert.equal(getCountryOptions("eng").length, COUNTRY_CODES.length);
  assert.equal(getCountryName("DE", "rus"), "Германия");
  assert.ok(getCountryOptions("eng").some((country) => country.code === "BR" && country.name === "Brazil"));
});

test("calendar uses only exact dates with a published year", () => {
  assert.equal(parseExactDeadlineDate("2027-01-13"), "2027-01-13");
  assert.equal(parseExactDeadlineDate("January 13, 2027"), "2027-01-13");
  assert.equal(parseExactDeadlineDate("15 October 2026 at 18:00 UK time for 2027 entry (strict deadline)"), "2026-10-15");
  for (const value of ["January 13", "2027-02-30", "2026-12-01 to 2026-12-15", "Early January (Jan 5-6)"]) {
    assert.equal(parseExactDeadlineDate(value), null);
  }
  const january = getCalendarCells(2027, 0);
  assert.equal(january[4], 1);
  assert.equal(january.at(-1), 31);
});

test("deadline calendar export creates one valid all-day event with source context", () => {
  const deadline = {
    title: "MBA, Stage 1; apply",
    deadline: "15 October 2026 at 18:00 UK time for 2027 entry (strict deadline)",
    cycle: "2027-28 cohort",
    scope: "MBA application",
    sourceUrl: "https://www.example.edu/admissions?stage=1",
  };
  const ics = createDeadlineIcs(deadline, { uid: "stage-1@example.test", now: new Date("2026-01-02T03:04:05Z") });
  assert.ok(ics);
  const unfolded = ics.replace(/\r\n[ \t]/g, "");
  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(ics, /BEGIN:VEVENT\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261015\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261016\r\n/);
  assert.doesNotMatch(ics, /DTSTART[^\r\n]*T\d{6}/);
  assert.match(ics, /DTSTAMP:20260102T030405Z\r\n/);
  assert.match(unfolded, /Original deadline: 15 October 2026 at 18:00 UK time for 2027 entry \(strict deadline\)/);
  assert.match(unfolded, /Admissions cycle: 2027-28 cohort/);
  assert.match(unfolded, /Scope: MBA application/);
  assert.match(unfolded, /Source: https:\/\/www\.example\.edu\/admissions\?stage=1/);
  assert.match(unfolded, /Confirm exact time and rules with the university\./);
  assert.match(unfolded, /SUMMARY:MBA\\, Stage 1\\; apply\r\n/);
  assert.ok(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, 1);
  assert.ok(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75));
  assert.equal(escapeIcsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
});

test("deadline calendar export rejects approximate, yearless, and multi-date entries", () => {
  assert.equal(createDeadlineIcs({ deadline: "January 13", title: "Deadline" }), null);
  assert.equal(createDeadlineIcs({ deadline: "2026-12-01 to 2026-12-15", title: "Deadline" }), null);
  assert.equal(createDeadlineIcs({ deadline: "2026-12-01", approximate: true, title: "Deadline" }), null);
});
