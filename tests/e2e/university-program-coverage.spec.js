const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const universities = JSON.parse(fs.readFileSync(path.join(__dirname, "../../backend/data/universities.json"), "utf8"));
const universityById = Object.fromEntries(universities.map((university) => [university.id, university]));

function selectedProgram(universityId, programId) {
  const university = universityById[universityId];
  return university.academics.programs.find((program) => (program.id || program.course_number) === programId);
}

function awardContract(universityId, awardId) {
  const award = universityById[universityId].finance.scholarships_and_funding.find((item) => item.id === awardId);
  return {
    id: award.id,
    name: award.name,
    program_scope: award.program_scope,
    applicant_scope: award.applicant_scope,
    eligibility: award.eligibility,
    basis: award.basis,
    application_process: award.application_process,
    coverage: award.coverage,
    course_application_deadline: award.course_application_deadline,
    award_application_deadline: award.award_application_deadline || award.deadlines,
    deadline_timezone: award.deadline_timezone,
    source_url: award.source_url,
    cycle: award.academic_year || award.cycle,
    verified_at: award.verified_at,
  };
}

const coverageRows = {
  "mit-usa-cambridge": [{
    program_id: "Course 6-3",
    program_name: selectedProgram("mit-usa-cambridge", "Course 6-3").name,
    study_levels: ["bachelor"],
    requirements: { status: "available", scope: "institution_wide_route", source_url: "https://mitadmissions.org/apply/firstyear/deadlines-requirements/", cycle: "Annual first-year cycle; official page does not identify an entry year.", verified_at: "2026-09-23" },
    deadline: { status: "approximate_or_yearless", scope: "institution_wide_route", source_url: "https://mitadmissions.org/apply/firstyear/deadlines-requirements/", cycle: "Annual first-year cycle; official page does not identify an entry year.", values: ["January 4", "November 1"] },
    tuition_mandatory_fees: { status: "available", scope: "university_guidance", source_url: "https://sfs.mit.edu/cost-of-attendance-class-of-2030/", cycle: "2026-27", values: { Tuition: 66720, currency: "USD" } },
    awards: { status: "available", scope: "award_program_scope", items: [awardContract("mit-usa-cambridge", "mit-undergraduate-need-based-scholarship")] },
  }],
  "university-of-oxford-uk-oxford": [{
    program_id: "philosophy_politics_and_economics_ppe_ug",
    program_name: selectedProgram("university-of-oxford-uk-oxford", "philosophy_politics_and_economics_ppe_ug").name,
    study_levels: ["bachelor"],
    requirements: { status: "available", scope: "program_specific", source_url: "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/philosophy-politics-and-economics" },
    deadline: { status: "exact_dated", scope: "university_guidance", source_url: "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline", cycle: "2027 entry", verified_at: "2026-09-23", values: ["15 October 2026 at 18:00 UK time (strict deadline)"] },
    tuition_mandatory_fees: { status: "not_catalogued", scope: "not_catalogued", values: {} },
    awards: { status: "not_catalogued", scope: "not_catalogued", items: [] },
  }, {
    program_id: "msc_advanced_computer_science_pgt",
    program_name: selectedProgram("university-of-oxford-uk-oxford", "msc_advanced_computer_science_pgt").name,
    study_levels: ["master"],
    requirements: { status: "available", scope: "program_specific", source_url: "https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science" },
    deadline: { status: "not_catalogued", scope: "not_catalogued", values: [] },
    tuition_mandatory_fees: { status: "not_catalogued", scope: "not_catalogued", values: {} },
    awards: { status: "available", scope: "award_program_scope", items: [awardContract("university-of-oxford-uk-oxford", "oxford-clarendon-fund-2027")] },
  }],
  "imperial-college-london-uk": [{
    program_id: "imperial-phd-computing",
    program_name: selectedProgram("imperial-college-london-uk", "imperial-phd-computing").name,
    study_levels: ["doctorate"],
    requirements: { status: "available", scope: "program_specific" },
    deadline: { status: "not_catalogued", scope: "not_catalogued", values: [] },
    tuition_mandatory_fees: { status: "available", scope: "program_specific", values: { tuition_international_native: 31500, tuition_international_usd: 40825, currency: "GBP" } },
    awards: { status: "available", scope: "award_program_scope", items: [awardContract("imperial-college-london-uk", "presidents-phd-scholarships")] },
  }],
};

async function setProgramSelection(page, universityId, studyLevel, programId, programName) {
  await page.evaluate(({ universityId: id, studyLevel: level, programId: selectedId, programName: selectedName }) => {
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      studyLevel: level,
      major: selectedName,
      selectedAdmissionChoices: { [id]: { choiceKey: "program-coverage-test", programId: selectedId, programName: selectedName } },
    }));
  }, { universityId, studyLevel, programId, programName });
}

async function openPrograms(page, universityId) {
  await page.goto(`/university.html?id=${universityId}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#detailPrograms .program-coverage")).toBeVisible();
}

test("selected top-five program coverage keeps routes, course dates, and award deadlines in their own scopes", async ({ page }) => {
  for (const universityId of Object.keys(coverageRows)) {
    await page.route(`**/universities/${universityId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...universityById[universityId], coverage_by_program: coverageRows[universityId] }),
      });
    });
  }
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await setProgramSelection(page, "mit-usa-cambridge", "Bachelor", "Course 6-3", "Computer Science and Engineering (Course 6-3)");
  await page.reload();
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const mitCoverage = page.locator("#detailPrograms .program-coverage");
  await expect(mitCoverage).toBeVisible();
  await expect(mitCoverage).toContainText(/Computer Science and Engineering \(Course 6[-‐‑‒–—−]3\)/);
  await expect(mitCoverage.locator('[data-coverage-kind="deadline"]')).toContainText("University-wide admission route");
  await expect(mitCoverage.locator('[data-coverage-kind="deadline"]')).toContainText("November 1");
  await expect(mitCoverage.locator('[data-coverage-kind="deadline"] a')).toHaveAttribute("href", "https://mitadmissions.org/apply/firstyear/deadlines-requirements/");
  await expect(mitCoverage.locator('[data-coverage-kind="cost"]')).toContainText("not a program price");
  await expect(mitCoverage.locator('[data-coverage-kind="cost"]')).not.toContainText("USD 66,720");

  await page.evaluate(() => localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, studyLevel: "Bachelor", major: "" })));
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const oxfordPpeToggle = page.locator('#detailPrograms [data-program-key="philosophy politics and economics ppe"] [data-program-toggle]');
  await expect(oxfordPpeToggle).toBeVisible();
  await oxfordPpeToggle.click();
  const ppeCoverage = page.locator("#detailPrograms .program-coverage");
  await expect(ppeCoverage).toContainText("Philosophy, Politics and Economics (PPE)");
  await expect(ppeCoverage.locator('[data-coverage-kind="deadline"]')).toContainText("15 October 2026 at 18:00 UK time");
  await expect(ppeCoverage.locator('[data-coverage-kind="deadline"] a')).toHaveAttribute("href", "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline");

  await setProgramSelection(page, "university-of-oxford-uk-oxford", "Master", "msc_advanced_computer_science_pgt", "MSc in Advanced Computer Science");
  await openPrograms(page, "university-of-oxford-uk-oxford");
  const oxfordDeadline = page.locator('#detailPrograms .program-coverage [data-coverage-kind="deadline"]');
  await expect(oxfordDeadline).toContainText("Not catalogued");
  await expect(oxfordDeadline).not.toContainText("December or January");

  await setProgramSelection(page, "imperial-college-london-uk", "Doctorate", "imperial-phd-computing", "PhD in Computing");
  await openPrograms(page, "imperial-college-london-uk");
  const imperialDeadline = page.locator('#detailPrograms .program-coverage [data-coverage-kind="deadline"]');
  const imperialAwards = page.locator('#detailPrograms .program-coverage [data-coverage-kind="awards"]');
  await expect(imperialDeadline).toContainText("Not catalogued");
  await expect(imperialDeadline).not.toContainText("2026-11-02");
  await expect(imperialAwards).toContainText("President's PhD Scholarships");
  await expect(imperialAwards).toContainText("Award application deadline");
  await expect(imperialAwards).toContainText(/2026[-‐‑‒–—−]11[-‐‑‒–—−]02/);
  await expect(imperialAwards).toContainText("not confirmed funding");
});
