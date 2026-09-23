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

export function createDeadlineIcs(item, { now = new Date(), uid = "" } = {}) {
  const date = parseExactDeadlineDate(item?.deadline);
  if (!date || item?.approximate === true || item?.is_approximate === true) return null;
  const dateCompact = date.replaceAll("-", "");
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const endDate = nextDate.toISOString().slice(0, 10).replaceAll("-", "");
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
    item.cycle ? `Admissions cycle: ${item.cycle}` : "",
    item.scope || item.level ? `Scope: ${item.scope || item.level}` : "",
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
    `DTSTART;VALUE=DATE:${dateCompact}`,
    `DTEND;VALUE=DATE:${endDate}`,
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
