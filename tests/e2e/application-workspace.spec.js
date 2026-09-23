const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { markTourAsSeen } = require("./helpers/personas");

const universities = JSON.parse(fs.readFileSync(path.join(__dirname, "../../backend/data/universities.json"), "utf8"));
const mit = universities.find((university) => university.id === "mit-usa-cambridge");

test("saved university application workspace shows course, aid, and award tasks", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify(["mit-usa-cambridge"]));
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      selectedAdmissionChoices: {
        "mit-usa-cambridge": {
          choiceKey: "mit_undergrad_early_action",
          categoryId: "mit_undergrad_early_action",
          programId: "mit-first-year",
          programName: "First-year undergraduate",
        },
      },
    }));
  });
  await page.route("**/universities/mit-usa-cambridge*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mit) });
  });

  await page.goto("/");
  await expect(page.locator("#openApplicationWorkspace")).toBeVisible();
  await page.locator("#openApplicationWorkspace").click();
  const workspace = page.locator("#applicationWorkspace");
  await expect(workspace).toBeVisible();
  await expect(workspace).toContainText("Massachusetts Institute of Technology");
  await expect(workspace).toContainText("Submit the course application");
  await expect(workspace).toContainText("Submit financial aid materials");
  await expect(workspace).toContainText("MIT Need-Based Scholarship");
  await expect(workspace).toContainText("CSS Profile");

  const checklistItem = workspace.locator('[data-task-id="mit-usa-cambridge:course-application"] input[type="checkbox"]');
  await checklistItem.check();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_application_checklist_v1") || "{}"))).toHaveProperty("mit-usa-cambridge:course-application", true);
});

test("post-offer steps stay locked for MIT until accepted and remain independent for Oxford", async ({ page }) => {
  await markTourAsSeen(page);
  const oxford = universities.find((university) => university.id === "university-of-oxford-uk-oxford");
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify(["mit-usa-cambridge", "university-of-oxford-uk-oxford"]));
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, selectedAdmissionChoices: {} }));
    localStorage.setItem("unisearch_application_post_offer_v1", JSON.stringify({ "university-of-oxford-uk-oxford": true }));
  });
  await page.route("**/universities/mit-usa-cambridge*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mit) });
  });
  await page.route("**/universities/university-of-oxford-uk-oxford*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(oxford) });
  });

  await page.goto("/");
  await expect(page.locator("#openApplicationWorkspace")).toBeVisible();
  await page.locator("#openApplicationWorkspace").click();
  const workspace = page.locator("#applicationWorkspace");
  await expect(workspace).toBeVisible();

  const mitSection = workspace.locator(".application-workspace__university").filter({ hasText: "Massachusetts Institute of Technology" });
  const oxfordSection = workspace.locator(".application-workspace__university").filter({ hasText: "University of Oxford" });
  await expect(mitSection.locator("[data-postoffer-tasks]")).toBeHidden();
  await expect(mitSection.locator("[data-postoffer-locked]")).toContainText("Start these steps only after accepting an offer");
  await expect(oxfordSection.locator("[data-postoffer-tasks]")).toBeVisible();
  await expect(oxfordSection).toContainText("CAS");
  await expect(oxfordSection.locator('[data-task-id="university-of-oxford-uk-oxford:post-offer:request-visa-document"] a[href="https://www.ox.ac.uk/students/visa/before/cas"]')).toHaveAttribute("target", "_blank");

  await mitSection.locator("[data-postoffer-gate]").check();
  await expect(mitSection.locator("[data-postoffer-tasks]")).toBeVisible();
  await expect(mitSection).toContainText("I-20 or DS-2019");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_application_post_offer_v1") || "{}"))).toMatchObject({ "mit-usa-cambridge": true, "university-of-oxford-uk-oxford": true });

  const mitCostTask = mitSection.locator('[data-task-id="mit-usa-cambridge:post-offer:confirm-cost"]');
  await expect(mitCostTask).toContainText("remains unknown");
  await expect(mitCostTask).toContainText("does not calculate a net price");
  await expect(mitCostTask).not.toContainText("$0");
});

test("Oxford PPE plan shows the shared UCAS date, separate Reach cutoff, and qualification warning", async ({ page }) => {
  await markTourAsSeen(page);
  const oxford = universities.find((university) => university.id === "university-of-oxford-uk-oxford");
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify(["university-of-oxford-uk-oxford"]));
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      studyLevel: "Bachelor",
      applicantRoute: "first_year",
      countryOfEducation: "KZ",
      educationCredential: "other",
      educationCredentialOther: "Attestat/Svidetel' stvo o Srednem Obrazovanii (Certificate of Secondary Education)",
      intendedEntryCycle: "2027 Fall",
      selectedAdmissionChoices: {
        "university-of-oxford-uk-oxford": {
          choiceKey: "oxford_ppe_a_level-grant-reach-oxford",
          categoryId: "oxford_ppe_and_humanities",
          requirementProfileId: "oxford_ppe_a_level",
          fundingOptionId: "oxford_ppe_a_level-grant-reach-oxford",
          programId: "philosophy_politics_and_economics_ppe_ug",
          programName: "Philosophy, Politics and Economics (PPE)",
        },
      },
    }));
  });
  await page.route("**/universities/university-of-oxford-uk-oxford*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(oxford) });
  });

  await page.goto("/");
  await expect(page.locator("#openApplicationWorkspace")).toBeVisible();
  await page.locator("#openApplicationWorkspace").click();
  const workspace = page.locator("#applicationWorkspace");
  await expect(workspace).toBeVisible();
  const course = workspace.locator('[data-task-id="university-of-oxford-uk-oxford:course-application"]');
  await expect(course).toContainText("October 15, 2026");
  await expect(course).toContainText("18:00");
  await expect(course).toContainText("UK time");
  await expect(course.locator('a[href="https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline"]')).toBeVisible();
  await expect(course).toContainText("listed as not accepted");
  await expect(course.locator('a[href="https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/philosophy-politics-and-economics"]')).toBeVisible();

  const reach = workspace.locator('[data-task-id="university-of-oxford-uk-oxford:award:oxford-reach-oxford-scholarship-2027"]');
  await expect(reach).toContainText("January 26, 2027");
  await expect(reach).toContainText("12:00");
  await expect(reach).toContainText("UK time");
  await expect(reach.locator(".application-workspace__detail-list li")).toHaveCount(9);
  await expect(reach.locator("[data-export-task]")).toBeVisible();
});
