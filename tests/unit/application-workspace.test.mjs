import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import "./setup.mjs";

globalThis.window = { location: { protocol: "http:", hostname: "localhost", pathname: "/" } };
globalThis.fetch = async (url) => {
  const target = String(url || "");
  if (target.endsWith("Localization/eng")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } };
  if (target.endsWith("Localization/ru")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8"); } };
  return { ok: false, async text() { return ""; } };
};
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
await initI18n();
const { buildApplicationTasks, createApplicationTaskIcs, localizedTimezone } = await import("../../frontend/javascript/pages/application-workspace.js");

test("application workspace localizes Pacific and UK deadline time zones in Russian", () => {
  setLanguage("ru", { persist: false, emit: false });
  try {
    assert.equal(localizedTimezone("US Pacific Time"), "тихоокеанское время США");
    assert.equal(localizedTimezone("UK time"), "время Великобритании");
    assert.equal(localizedTimezone("US Eastern Time; exact hour not published"), "восточное время США; exact hour not published");
  } finally {
    setLanguage("eng", { persist: false, emit: false });
  }
});

test("application workspace keeps MIT early-action course and aid deadlines separate", () => {
  const university = {
    id: "mit",
    admission_categories: [{
      id: "mit_undergrad_early_action",
      label: "Undergraduate Early Action",
      study_levels: ["Bachelor"],
      application_deadline: "2026-11-01",
      financial_aid_deadline: "2026-11-30",
      cycle: "2027 entry",
      source_url: "https://mitadmissions.org/apply/firstyear/deadlines-requirements/",
    }],
    finance: { scholarships_and_funding: [{
      id: "mit-need-aid",
      name: "MIT Need-Based Scholarship",
      study_level: "Bachelor",
      applicant_scope: "International applicants",
      academic_year: "2027 entry",
      application_process: "separate",
      course_application_deadline: { early_action: "2026-11-01", regular_action: "2027-01-04" },
      award_application_deadline: { early_action: "2026-11-30", regular_action: "2027-02-15" },
      deadline_timezone: "US Eastern Time; exact hour not published",
      steps: ["Submit CSS Profile", "Upload tax returns"],
      documents: ["CSS Profile", "IDOC tax documents"],
      source_url: "https://sfs.mit.edu/undergraduate-students/apply-for-aid/international/",
    }] },
  };
  const tasks = buildApplicationTasks(university, { categoryId: "mit_undergrad_early_action", choiceKey: "mit-ea", programId: "mit-first-year", programName: "First-year undergraduate" }, { citizenships: ["KZ"] });
  const course = tasks.find((task) => task.kind === "application");
  const award = tasks.find((task) => task.awardId === "mit-need-aid");
  const aidDocuments = tasks.find((task) => task.awardId === "financial-aid-documents");
  assert.equal(course.date, "2026-11-01");
  assert.equal(award.date, "2026-11-30");
  assert.equal(aidDocuments.date, "2026-11-30");
  assert.match(award.detail, /CSS Profile/);
  assert.equal(award.cycle.toLowerCase().includes("early action"), true);
  assert.ok(createApplicationTaskIcs(award));
});

test("MIT Physics plan uses the selected program deadline and Russian route metadata", () => {
  setLanguage("ru", { persist: false, emit: false });
  try {
  const university = {
    id: "mit-usa-cambridge",
    academics: { programs: [{
      id: "mit-physics-phd-course-8",
      course_number: "Course 8 PhD",
      name: "Doctor of Philosophy in Physics (Course 8 PhD)",
      application_deadline: "December 15, 2026 at 11:59 p.m. Eastern Time for fall 2027 entry",
      cycle: "Fall 2027 entry",
      source_url: "https://physics.mit.edu/academic-programs/graduate-students/graduate-admissions/",
    }] },
    admission_categories: [{
      id: "mit_physics_phd_admissions",
      label: "MIT Physics PhD Admission",
      study_levels: ["Doctorate"],
      application_deadline: "Deadlines vary by doctoral program; check the program page.",
      cycle: "Fall 2027 entry",
      source_url: "https://oge.mit.edu/graduate-admissions/applications/",
      requirement_profiles: [{ id: "mit_physics_phd_applicant", label: "Physics PhD Applicant" }],
    }],
    finance: { scholarships_and_funding: [] },
  };
  const [course] = buildApplicationTasks(university, {
    categoryId: "mit_physics_phd_admissions",
    requirementProfileId: "mit_physics_phd_applicant",
    programId: "mit-physics-phd-course-8",
    programName: "Doctor of Philosophy in Physics (Course 8 PhD)",
  });

  assert.equal(course.date, "2026-12-15");
  assert.equal(course.time, "11:59 p.m.");
  assert.equal(course.timezone, "Eastern Time");
  assert.equal(course.sourceUrl, "https://physics.mit.edu/academic-programs/graduate-students/graduate-admissions/");
  assert.equal(course.cycle, "Набор на осень 2027 года");
  assert.match(course.detail, /Поступление на PhD по физике в MIT/);
  assert.match(course.detail, /Абитуриент PhD по физике/);
  const calendar = createApplicationTaskIcs(course);
  assert.match(calendar, /DTSTART:20261216T045900Z/);
  } finally {
    setLanguage("eng", { persist: false, emit: false });
  }
});

test("application workspace keeps exact separate award cutoffs and exposes steps", () => {
  const university = {
    id: "stanford",
    admission_categories: [{ id: "stanford-phd", label: "PhD admission", study_levels: ["Doctorate"], application_deadline: "2026-12-01", cycle: "2027 entry", source_url: "https://gradadmissions.stanford.edu/" }],
    finance: { scholarships_and_funding: [{
      id: "knight-hennessy",
      name: "Knight-Hennessy Scholars",
      study_level: "Doctorate",
      applicant_scope: "Applicants worldwide",
      application_process: "separate",
      award_application_deadline: "2026-10-06 13:00",
      deadline_timezone: "US Pacific Time",
      steps: ["Submit the separate KHS application"],
      documents: ["Resume", "Essays"],
      source_url: "https://knight-hennessy.stanford.edu/admission",
    }] },
  };
  const tasks = buildApplicationTasks(university, { categoryId: "stanford-phd", choiceKey: "stanford-phd" });
  const award = tasks.find((task) => task.awardId === "knight-hennessy");
  assert.equal(award.date, "2026-10-06");
  assert.equal(award.time, "13:00");
  assert.match(award.detail, /separate KHS application/);
  const calendar = createApplicationTaskIcs(award);
  assert.match(calendar, /DTSTART:20261006T200000Z\r\n/);
  assert.match(calendar, /DTEND:20261006T201500Z\r\n/);
});

test("automatic award uses its course deadline and vague program dates stay out of calendar", () => {
  const university = {
    id: "oxford",
    admission_categories: [{ id: "oxford-master", label: "Master's course", study_levels: ["Master"], application_deadline: "Relevant course deadline; exact date varies", cycle: "2027 entry", source_url: "https://www.ox.ac.uk/admissions/graduate/courses" }],
    finance: { scholarships_and_funding: [{
      id: "clarendon",
      name: "Clarendon Fund Scholarship",
      study_level: "Master",
      applicant_scope: "Applicants of any nationality",
      application_process: "automatic",
      course_application_deadline: "Relevant Oxford course deadline, exact date is course-specific",
      award_application_deadline: "Same as course application deadline",
      deadline_timezone: "UK time",
      source_url: "https://www.ox.ac.uk/admissions/graduate/fees-and-funding/funding/clarendon/applicants",
    }] },
  };
  const tasks = buildApplicationTasks(university, { categoryId: "oxford-master", choiceKey: "oxford-master" });
  const course = tasks.find((task) => task.kind === "application");
  const award = tasks.find((task) => task.awardId === "clarendon");
  assert.equal(course.date, null);
  assert.equal(award.date, null);
  assert.equal(createApplicationTaskIcs(course), null);
  assert.equal(createApplicationTaskIcs(award), null);
  assert.match(award.title, /automatic award consideration/);
});

test("application workspace exposes each dated scholarship round separately", () => {
  const university = {
    id: "imperial",
    admission_categories: [{ id: "imperial-phd", label: "PhD", study_levels: ["Doctorate"], cycle: "2027-28 entry", application_deadline: "Department-specific date", source_url: "https://www.imperial.ac.uk/study/courses/postgraduate-doctoral/" }],
    finance: { scholarships_and_funding: [{
      id: "presidents-phd",
      name: "President's PhD Scholarships",
      study_level: "Doctorate",
      applicant_scope: "Applicants worldwide",
      application_process: "automatic",
      award_application_deadline: [{ date: "2026-11-02", time: "23:59", round: 1 }, { date: "2027-01-11", time: "23:59", round: 2 }],
      deadline_timezone: "UK time",
      source_url: "https://www.imperial.ac.uk/study/fees-and-funding/postgraduate-doctoral/grants-scholarships/presidents-phd/",
    }] },
  };
  const awards = buildApplicationTasks(university, { categoryId: "imperial-phd", choiceKey: "imperial-phd" }).filter((task) => task.awardId === "presidents-phd");
  assert.equal(awards.length, 2);
  assert.deepEqual(awards.map((task) => task.date), ["2026-11-02", "2027-01-11"]);
  assert.deepEqual(awards.map((task) => task.time), ["23:59", "23:59"]);
});

test("application workspace does not invent a route before the applicant selects one", () => {
  const university = {
    id: "sample",
    finance: {
      source_url: "https://www.example.edu/program/first-course",
      scholarships_and_funding: [{ id: "award", name: "Award", study_level: "Bachelor", applicant_scope: "Applicants worldwide", award_application_deadline: "2027-01-01", source_url: "https://www.example.edu/award" }],
    },
    admission_categories: [
      { id: "early", label: "Early Action", study_levels: ["Bachelor"], application_deadline: "2026-11-01", source_url: "https://www.example.edu/early" },
      { id: "regular", label: "Regular Action", study_levels: ["Bachelor"], application_deadline: "2027-01-04", source_url: "https://www.example.edu/regular" },
    ],
  };
  const tasks = buildApplicationTasks(university, {});
  assert.equal(tasks[0].date, null);
  assert.equal(tasks[0].sourceUrl, "");
  assert.equal(tasks.some((task) => task.awardId === "award"), false);
  assert.equal(tasks.find((task) => task.kind === "funding").sourceUrl, "");
});

test("award candidates respect explicit program exclusions and domestic eligibility", () => {
  const oxford = {
    id: "oxford",
    location: { country: "United Kingdom" },
    admission_categories: [{ id: "medicine", name: "Medicine", label: "Medicine", study_levels: ["Bachelor"], source_url: "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/medicine" }],
    finance: { scholarships_and_funding: [{ id: "reach", name: "Reach Oxford Scholarship", study_level: "Bachelor", program_scope: "Oxford undergraduate courses except Medicine", applicant_scope: "Applicants worldwide", source_url: "https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/reach-oxford" }] },
  };
  const oxfordTasks = buildApplicationTasks(oxford, { categoryId: "medicine", choiceKey: "medicine", programName: "Medicine" });
  assert.equal(oxfordTasks.some((task) => task.awardId === "reach"), false);

  const imperial = {
    id: "imperial",
    location: { country: "United Kingdom" },
    admission_categories: [{ id: "undergrad", label: "Undergraduate course", study_levels: ["Bachelor"], source_url: "https://www.imperial.ac.uk/study/undergraduate/" }],
    finance: { scholarships_and_funding: [
      { id: "home-bursary", name: "Home Bursary", study_level: "Bachelor", target_audience: "domestic_only", source_url: "https://www.imperial.ac.uk/study/fees-and-funding/undergraduate/bursaries-grants-scholarships/imperial-bursary/" },
      { id: "international-award", name: "International Award", study_level: "Bachelor", program_scope: "All undergraduate courses", applicant_scope: "International students eligible for the Overseas tuition fee rate", source_url: "https://www.imperial.ac.uk/study/fees-and-funding/imperial-inspires-scholarships/" },
    ] },
  };
  const imperialTasks = buildApplicationTasks(imperial, { categoryId: "undergrad", choiceKey: "undergrad" }, { citizenships: ["KZ"] });
  const homeAward = imperialTasks.find((task) => task.awardId === "home-bursary");
  assert.ok(homeAward);
  assert.equal(homeAward.warning, true);
  assert.equal(imperialTasks.some((task) => task.awardId === "international-award"), true);
  assert.equal(imperialTasks.find((task) => task.awardId === "international-award").warning, true);
  const ukCitizenAbroad = buildApplicationTasks(imperial, { categoryId: "undergrad", choiceKey: "undergrad" }, { citizenship: "GB", residence: "US" }).find((task) => task.awardId === "home-bursary");
  const dualCitizen = buildApplicationTasks(imperial, { categoryId: "undergrad", choiceKey: "undergrad" }, { citizenships: ["GB", "KZ"] }).find((task) => task.awardId === "home-bursary");
  assert.equal(ukCitizenAbroad.warning, true);
  assert.equal(dualCitizen.warning, true);
});

test("application workspace excludes an explicitly program-scoped award from other selected programs", () => {
  const oxford = {
    id: "university-of-oxford-uk-oxford",
    admission_categories: [{ id: "oxford-pgt", label: "Graduate taught course", study_levels: ["Master"] }],
    finance: { scholarships_and_funding: [{
      id: "oxford-weidenfeld-hoffmann-2027",
      name: "Weidenfeld-Hoffmann Scholarships and Leadership Programme",
      study_level: "Master",
      program_ids: ["msc_advanced_computer_science_pgt", "mba_said_business_school_pgt", "bcl_bachelor_of_civil_law_pgt"],
      program_scope: "Oxford MSc Advanced Computer Science, MBA and BCL in this catalogue",
      applicant_scope: "Applicants worldwide",
      award_application_deadline: "2027-01-10",
      source_url: "https://www.ox.ac.uk/admissions/graduate/fees-and-funding/fees-funding-and-scholarship-search/weidenfeld-hoffmann-scholarships-and-leadership-programme",
    }] },
  };
  const makeTasks = (programId, programName) => buildApplicationTasks(oxford, {
    categoryId: "oxford-pgt",
    choiceKey: `oxford-${programId}`,
    programId,
    programName,
  });

  const advancedCs = makeTasks("msc_advanced_computer_science_pgt", "MSc in Advanced Computer Science");
  const history = makeTasks("mst_history_pgt", "MSt in History (Intellectual History)");
  assert.equal(advancedCs.some((task) => task.awardId === "oxford-weidenfeld-hoffmann-2027"), true);
  assert.equal(history.some((task) => task.awardId === "oxford-weidenfeld-hoffmann-2027"), false);

  const mixedRouteOxford = {
    ...oxford,
    admission_categories: [{
      ...oxford.admission_categories[0],
      program_ids: ["msc_advanced_computer_science_pgt", "mst_history_pgt"],
    }],
  };
  const mixedRouteAward = buildApplicationTasks(mixedRouteOxford, {
    categoryId: "oxford-pgt",
    choiceKey: "oxford-shared-pgt-route",
  }).find((task) => task.awardId === "oxford-weidenfeld-hoffmann-2027");
  assert.equal(mixedRouteAward.warning, true);
  assert.match(mixedRouteAward.title, /Check eligibility and next steps/);
});

test("multi-level award strings match each declared study level and legacy PhD labels", () => {
  const university = {
    id: "sample",
    admission_categories: [{ id: "doctoral", label: "Doctoral course", study_levels: ["Doctorate"] }],
    finance: { scholarships_and_funding: [
      { id: "master-doctorate", name: "Graduate Award", study_level: "Master / Doctorate", applicant_scope: "Applicants worldwide", source_url: "https://www.example.edu/graduate-award" },
      { id: "legacy-phd", name: "Legacy PhD Award", study_levels: ["PhD"], applicant_scope: "Applicants worldwide", source_url: "https://www.example.edu/phd-award" },
    ] },
  };
  const awards = buildApplicationTasks(university, { categoryId: "doctoral", choiceKey: "doctoral" }).filter((task) => task.awardId);
  assert.deepEqual(awards.map((task) => task.awardId), ["master-doctorate", "legacy-phd"]);
});

test("every course round remains visible instead of picking the earliest deadline", () => {
  const university = {
    id: "rounds",
    admission_categories: [{
      id: "graduate",
      label: "Graduate admission",
      study_levels: ["Master"],
      deadlines: [
        { date: "2026-12-01", round: "Early" , cycle: "2027 entry", source_url: "https://www.example.edu/early" },
        { date: "2027-02-01", round: "Regular", cycle: "2027 entry", source_url: "https://www.example.edu/regular" },
      ],
    }],
  };
  const tasks = buildApplicationTasks(university, { categoryId: "graduate", choiceKey: "graduate" }).filter((task) => task.kind === "application");
  assert.deepEqual(tasks.map((task) => task.date), ["2026-12-01", "2027-02-01"]);
  assert.deepEqual(tasks.map((task) => task.rawDeadline), ["2026-12-01", "2027-02-01"]);
});

test("Oxford PPE plan keeps shared UCAS and Reach Oxford cutoffs distinct and flags an explicit qualification rejection", async () => {
  const rows = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
  const oxford = rows.find((row) => row.id === "university-of-oxford-uk-oxford");
  const tasks = buildApplicationTasks(oxford, {
    categoryId: "oxford_ppe_and_humanities",
    choiceKey: "oxford_ppe_a_level-grant-reach-oxford",
    requirementProfileId: "oxford_ppe_a_level",
    fundingOptionId: "oxford_ppe_a_level-grant-reach-oxford",
    programId: "philosophy_politics_and_economics_ppe_ug",
    programName: "Philosophy, Politics and Economics (PPE)",
  }, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    countryOfEducation: "KZ",
    educationCredential: "other",
    educationCredentialOther: "Attestat/Svidetel' stvo o Srednem Obrazovanii (Certificate of Secondary Education)",
    intendedEntryCycle: "2027 Fall",
  });
  const course = tasks.find((task) => task.kind === "application");
  const reach = tasks.find((task) => task.awardId === "oxford-reach-oxford-scholarship-2027");
  assert.equal(course.date, "2026-10-15");
  assert.equal(course.time, "18:00");
  assert.equal(course.timezone, "UK time");
  assert.equal(course.sourceUrl, "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline");
  assert.equal(course.calendarEligible, true);
  assert.equal(reach.date, "2027-01-26");
  assert.equal(reach.time, "12:00");
  assert.equal(reach.timezone, "UK time");
  assert.ok(createApplicationTaskIcs(reach));
  assert.ok(course.detail.includes("shared undergraduate route"));
  assert.equal(course.qualificationWarning, true);
  assert.equal(reach.qualificationWarning, true);
  assert.equal(course.qualificationSourceUrl, "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/philosophy-politics-and-economics");
  assert.ok(reach.detailLines.length > 1);

  setLanguage("rus", { persist: false, emit: false });
  const russianReach = buildApplicationTasks(oxford, {
    categoryId: "oxford_ppe_and_humanities",
    choiceKey: "oxford_ppe_a_level-grant-reach-oxford",
    requirementProfileId: "oxford_ppe_a_level",
    fundingOptionId: "oxford_ppe_a_level-grant-reach-oxford",
    programId: "philosophy_politics_and_economics_ppe_ug",
    programName: "Philosophy, Politics and Economics (PPE)",
  }).find((task) => task.awardId === "oxford-reach-oxford-scholarship-2027");
  assert.match(russianReach.title, /Стипендия Reach Oxford/);
  assert.ok(russianReach.detailLines.some((line) => /Получите предложение о зачислении/.test(line)));
  assert.doesNotMatch(russianReach.detail, /Receive an Oxford offer|Applicants of any nationality/);
  setLanguage("eng", { persist: false, emit: false });
});

test("Oxford PPE route without a program id still uses shared UCAS deadline and qualification rule", async () => {
  const rows = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
  const oxford = rows.find((row) => row.id === "university-of-oxford-uk-oxford");
  const tasks = buildApplicationTasks(oxford, {
    categoryId: "oxford_ppe_and_humanities",
    choiceKey: "oxford_ppe_a_level-grant-reach-oxford",
    requirementProfileId: "oxford_ppe_a_level",
    fundingOptionId: "oxford_ppe_a_level-grant-reach-oxford",
  }, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    countryOfEducation: "KZ",
    educationCredential: "other",
    educationCredentialOther: "Attestat/Svidetel' stvo o Srednem Obrazovanii (Certificate of Secondary Education)",
    intendedEntryCycle: "2027 Fall",
  });
  const course = tasks.find((task) => task.kind === "application");
  const reach = tasks.find((task) => task.awardId === "oxford-reach-oxford-scholarship-2027");

  assert.equal(course.date, "2026-10-15");
  assert.equal(course.sourceUrl, "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline");
  assert.ok(course.detail.includes("shared undergraduate route"));
  assert.equal(course.qualificationWarning, true);
  assert.equal(course.qualificationSourceUrl, "https://www.ox.ac.uk/admissions/undergraduate/courses/admissions-requirements/international-qualifications");
  assert.equal(reach.qualificationWarning, true);
});
