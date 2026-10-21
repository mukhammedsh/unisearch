const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parseExactDeadlineDate(value) {
  const text = String(value || "").trim();
  let year;
  let month;
  let day;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const named = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(text);
    const dayFirst = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at\b.*)?$/.exec(text);
    if (!named && !dayFirst) return null;
    year = Number(named ? named[3] : dayFirst[3]);
    month = MONTHS.indexOf((named ? named[1] : dayFirst[2]).toLowerCase()) + 1;
    day = Number(named ? named[2] : dayFirst[1]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function publishedInstant(date, time, timezone) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || "") || !timezone) return null;
  const aliases = { ET: "America/New_York", EST: "Etc/GMT+5", GMT: "Etc/GMT", BST: "Etc/GMT-1", "UK time": "Europe/London" };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: aliases[timezone] || timezone, numberingSystem: "latn",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  } catch { return null; }
  const wallTime = Date.parse(`${date}T${time}:00Z`);
  const localAsUtc = instant => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  };
  const candidates = new Set();
  for (const offset of [-86400000, 0, 86400000]) {
    const sample = wallTime + offset;
    const candidate = wallTime - (localAsUtc(sample) - sample);
    if (localAsUtc(candidate) === wallTime) candidates.add(candidate);
  }
  // A skipped or repeated local time cannot establish one unambiguous deadline instant.
  return candidates.size === 1 ? new Date([...candidates][0]).toISOString().replace(/[-:]/g, "").replace(/\.000Z$/, "Z") : null;
}

export function getReviewedDeadlineEvents(resolved) {
  const option = resolved?.selected_option;
  if ((!option && resolved?.reading_scope !== "institution_route") || !resolved?.selected_route || Object.values(resolved.context_applicability || {}).includes("mismatched")) return [];
  const ids = new Set([...(resolved.fact_groups?.deadlines || []), ...(resolved.fact_groups?.funding || []), ...(resolved.fact_groups?.requirements || [])]);
  const events = new Map();
  const add = (row, kind, value, name = "", parent = {}) => {
    const detail = value && typeof value === "object" ? value : { date: value };
    const deadline = parseExactDeadlineDate(detail.date);
    if (!deadline || detail.approximate || detail.is_approximate) return;
    const time = detail.time || parent.deadline_time || parent.time || "";
    const timezone = detail.timezone || detail.timezone_as_published || parent.timezone || parent.timezone_as_published || "";
    const restrictions = detail.applicant_category_label || parent.applicant_category_label || detail.applicant_category || parent.applicant_category || row.scope?.applicant_categories || [];
    const applicantCategoryLabel = (Array.isArray(restrictions) ? restrictions : [restrictions]).join("; ");
    const key = JSON.stringify([kind, deadline, name, applicantCategoryLabel]);
    const existing = events.get(key);
    if (existing && (existing.time || !time)) return;
    events.set(key, { id: `${row.id}:${kind}:${deadline}:${name}`, kind, name, title: name || option?.title || resolved.selected_route.title,
      deadline, time, timezone, sourceFactId: row.id, sourceUrl: detail.source_url || resolved.sources?.find(source => row.source_ids?.includes(source.id))?.url || "",
      cycle: detail.cycle || row.scope?.cycle || "", scope: [option?.title, resolved.selected_route.title].filter(Boolean).join(" · "), applicantCategoryLabel });
  };
  const rows = (resolved.facts || []).filter(row => ids.has(row.id) && row.applicability?.status !== "mismatched"
    && row.publication_status === "published" && /verified|reviewed|rechecked|carried_forward_review/.test(row.review_status || "")
    && !/conflict|pending|partial|superseded|requires_confirmation/.test(row.review_status || "")
    && (!row.scope?.option_ids?.length || row.scope.option_ids.includes(option?.id))
    && (!row.scope?.route_ids?.length || row.scope.route_ids.some(id => [resolved.selected_route.id, ...(resolved.selected_route.shared_policy_context_ids || [])].includes(id))));
  for (const row of rows) {
    const value = row.value;
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!entry || typeof entry !== "object" || entry.publication_status && entry.publication_status !== "published") continue;
        if (entry.program_ids?.length && !entry.program_ids.includes(option?.id)) continue;
        const round = (entry.deadline_type || entry.window)?.match(/^round_(\d+)$/);
        const name = round ? `Round ${round[1]}` : entry.label || entry.cycle || "";
        const kind = entry.deadline_type === "aid_application" ? "funding" : entry.deadline_type === "standardized_test" ? "test" : "application";
        add(row, kind, entry, name);
      }
      continue;
    }
    if (["excluded_by_published_course_rules", "not_established"].includes(value.availability)) continue;
    for (const block of value.course_specific_test_blocks || []) {
      if (typeof block !== "string") continue;
      const exam = block.match(/^Admissions test \((TMUA|ESAT)\)/)?.[1];
      const booking = block.split("Booking windows (all candidates)")[1]?.split(/How to (?:book|register)/)[0];
      if (!exam || !booking) continue;
      for (const match of booking.matchAll(/Booking (opens|closes): (\d{1,2} [A-Za-z]+ 20\d{2}) at (\d{1,2})[.:](\d{2}) \(UK time\)/g)) {
        add(row, match[1] === "opens" ? "booking_open" : "booking", { date: match[2], time: `${match[3].padStart(2, "0")}:${match[4]}`, timezone: "Europe/London" }, exam);
      }
    }
    if (value.other_course_equal_consideration) {
      const medicine = option?.awards?.some(award => /MBBS/.test(award));
      add(row, "application", medicine ? value.medicine_deadline : value.other_course_equal_consideration);
      add(row, "opens", value.submission_opens);
      continue;
    }
    for (const window of Array.isArray(value.windows) ? value.windows : []) {
      const name = window.name || window.entry || window.round || "";
      add(row, "application", window.application_due || window.date, name, { ...value, ...window });
      add(row, "funding", window.aid_due, name, window);
      add(row, "decision", window.decision, name, window);
      add(row, "test", window.latest, name, window);
    }
    for (const [index, round] of (Array.isArray(value.rounds) ? value.rounds : []).entries()) {
      const name = round.name || round.label || `Round ${index + 1}`;
      add(row, row.topic.includes("funding") ? "funding" : "application", round.deadline || round.apply, name, { ...value, ...round });
      add(row, "decision", round.notify_by || round.decision, name);
    }
    for (const [key, date] of Object.entries(value.deadlines || {})) {
      if (option && (key === option.id || resolved.reference_labels?.[key] === option.title)) {
        const kind = value.deadline_kind === "admissions_for_scholarship_consideration" ? "funding_consideration" : row.topic.includes("funding") ? "funding" : "application";
        add(row, kind, date, value.funding_program || "", value);
      }
    }
    for (const key of ["application_due", "deadline"]) add(row, row.topic.includes("funding") ? "funding" : "application", value[key], value.not_immediate_2027_matriculation ? "MBA Early" : "", value);
    for (const key of ["open", "application_open"]) add(row, "opens", value[key]);
    add(row, "reply", value.reply || value.enrollment_reply);
    const text = value.course_page_application_rounds_and_deadlines || value.application_deadline_and_schedule;
    if (typeof text === "string") {
      const date = "(\\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) 20\\d{2})";
      const parent = /23[.:]59\s*\(UK time\)/i.test(text) ? { time: "23:59", timezone: "Europe/London" } : {};
      for (const match of text.matchAll(/\bRound\s+(\d+)\b([\s\S]*?)(?=\bRound\s+\d+\b|$)/g)) {
        const closing = match[2].match(new RegExp(`(?:Applications close on|Apply by:|Closing date:)\\s*(?:[A-Za-z]+\\s+)?${date}`));
        const decision = match[2].match(new RegExp(`Decision by:?\\s*(?:[A-Za-z]+\\s+)?${date}`));
        add(row, "application", closing?.[1], `Round ${match[1]}`, parent);
        add(row, "decision", decision?.[1], `Round ${match[1]}`);
      }
    }
  }
  return [...events.values()].sort((left, right) => left.deadline.localeCompare(right.deadline) || left.kind.localeCompare(right.kind));
}

export function createDeadlineIcs(item, { now = new Date(), uid = "" } = {}) {
  const date = parseExactDeadlineDate(item?.deadline);
  if (!date || item?.approximate === true || item?.is_approximate === true) return null;
  const dateCompact = date.replaceAll("-", "");
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const endDate = nextDate.toISOString().slice(0, 10).replaceAll("-", "");
  const instant = item.time ? publishedInstant(date, item.time, item.timezone) : null;
  if (item.time && !instant) return null;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const sourceValue = String(item.sourceUrl || item.source_url || "").trim();
  let source = "";
  try {
    const parsedSource = new URL(sourceValue);
    if (["https:", "http:"].includes(parsedSource.protocol)) source = sourceValue;
  } catch { /* A missing or invalid source is omitted from the calendar event. */ }
  const safeUid = uid || `${date}-${String(item.title || "deadline").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deadline"}@unisearch`;
  const details = [
    `Original deadline: ${item.deadline}`,
    item.time ? `${item.time} ${item.timezone}` : "",
    item.cycle ? `Admissions cycle: ${item.cycle}` : "",
    item.scope || item.level ? `Scope: ${item.scope || item.level}` : "",
    item.applicantCategoryLabel || "",
    item.applicabilityLabel || "",
    item.title ? `Deadline: ${item.title}` : "",
    source ? `Source: ${source}` : "",
    "Confirm exact time and rules with the university.",
  ].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UniSearch//Admissions Deadline//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(safeUid)}`,
    `DTSTAMP:${stamp}`,
    ...(instant ? [`DTSTART:${instant}`] : [`DTSTART;VALUE=DATE:${dateCompact}`, `DTEND;VALUE=DATE:${endDate}`]),
    `SUMMARY:${escapeIcsText(item.title || "Application deadline")}`,
    `DESCRIPTION:${escapeIcsText(details)}`,
    ...(source ? [`URL:${source.replace(/[\r\n]/g, "")}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  const fold = (line) => {
    let output = "";
    let current = "";
    let octets = 0;
    for (const character of line) {
      const size = new TextEncoder().encode(character).length;
      if (octets + size > 75) {
        output += `${current}\r\n `;
        current = "";
        octets = 1;
      }
      current += character;
      octets += size;
    }
    return output + current;
  };
  return lines.map(fold).join("\r\n");
}

export function getCalendarCells(year, monthIndex) {
  const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
}
