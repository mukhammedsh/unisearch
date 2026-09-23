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

test("Imperial application plan without a selected route does not link funding review to Computing BEng", async ({ page }) => {
  await markTourAsSeen(page);
  const imperial = universities.find((university) => university.id === "imperial-college-london-uk");
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify(["imperial-college-london-uk"]));
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, selectedAdmissionChoices: {} }));
  });
  await page.route("**/universities/imperial-college-london-uk*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(imperial) });
  });

  await page.goto("/");
  await expect(page.locator("#openApplicationWorkspace")).toBeVisible();
  await page.locator("#openApplicationWorkspace").click();
  const workspace = page.locator("#applicationWorkspace");
  await expect(workspace).toBeVisible();
  const imperialSection = workspace.locator(".application-workspace__university").filter({ hasText: "Imperial College London" });
  await expect(imperialSection).toContainText("No admission track is selected");
  const fundingReview = imperialSection.locator('[data-task-id="imperial-college-london-uk:funding-review"]');
  await expect(fundingReview.locator('a[href="https://www.imperial.ac.uk/study/courses/undergraduate/computing-beng/"]')).toHaveCount(0);
  await expect(fundingReview).toContainText("Official source not recorded");
  await expect(imperialSection.locator('a[href="https://www.imperial.ac.uk/study/courses/undergraduate/computing-beng/"]')).toHaveCount(0);
});

test("MIT Physics PhD plan shows its selected-program deadline and Russian route metadata", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify(["mit-usa-cambridge"]));
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      selectedAdmissionChoices: {
        "mit-usa-cambridge": {
          choiceKey: "mit_physics_phd_admissions",
          categoryId: "mit_physics_phd_admissions",
          requirementProfileId: "mit_physics_phd_applicant",
          programId: "mit-physics-phd-course-8",
          programName: "Doctor of Philosophy in Physics (Course 8 PhD)",
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
  const course = workspace.locator('[data-task-id="mit-usa-cambridge:course-application"]');
  await expect(course).toContainText("15 декабря 2026");
  await expect(course).toContainText("Набор на осень 2027 года");
  await expect(course).toContainText("Поступление на PhD по физике в MIT");
  await expect(course).toContainText("Абитуриент PhD по физике");
  await expect(course).toContainText("23:59");
  await expect(course.locator('a[href="https://physics.mit.edu/academic-programs/graduate-students/graduate-admissions/"]')).toBeVisible();
});

test("MIT MBAn costs show published gross tuition without deducting potential aid", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, studyLevel: "Master" }));
  });
  await page.route("**/universities/mit-usa-cambridge*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mit) });
  });

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  const costs = page.locator("#detailFinance");
  const mbanCosts = costs.locator(".finance-track-group").filter({ hasText: "MIT Sloan Master of Business Analytics" });
  await expect(mbanCosts).toContainText("$96,884");
  await expect(mbanCosts).toContainText("Published gross tuition for 2026");
  await expect(mbanCosts).toContainText("potential awards are not deducted");
  const tuitionSources = mbanCosts.locator('a[href="https://mitsloan.mit.edu/master-of-business-analytics/admissions/tuition-and-financial-aid"]');
  await expect(tuitionSources).toHaveCount(2);
  await expect(tuitionSources.first()).toBeVisible();
  await expect(mbanCosts).not.toContainText("$74,884");
  await expect(mbanCosts).not.toContainText("Cost breakdown unknown");
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

test("Oxford application plan hides a scholarship explicitly scoped to other programs", async ({ page }) => {
  await markTourAsSeen(page);
  const oxford = JSON.parse(JSON.stringify(universities.find((university) => university.id === "university-of-oxford-uk-oxford")));
  oxford.admission_categories.push({
    id: "oxford-mst-history-route-test",
    label: "MSt in History (Intellectual History)",
    study_levels: ["Master"],
    program_ids: ["mst_history_pgt"],
    source_url: "https://www.ox.ac.uk/admissions/graduate/courses/mst-history-intellectual",
  });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify(["university-of-oxford-uk-oxford"]));
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      selectedAdmissionChoices: {
        "university-of-oxford-uk-oxford": {
          choiceKey: "oxford-mst-history-route-test",
          categoryId: "oxford-mst-history-route-test",
          programId: "mst_history_pgt",
          programName: "MSt in History (Intellectual History)",
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
  const oxfordSection = workspace.locator(".application-workspace__university").filter({ hasText: "University of Oxford" });
  await expect(oxfordSection.locator('[data-task-id="university-of-oxford-uk-oxford:award:oxford-clarendon-fund-2027"]')).toBeVisible();
  await expect(oxfordSection.locator('[data-task-id="university-of-oxford-uk-oxford:award:oxford-weidenfeld-hoffmann-2027"]')).toHaveCount(0);
});

test("post-offer fee links follow the selected route's published source", async ({ page }) => {
  await markTourAsSeen(page);
  const cases = [
    {
      id: "mit-usa-cambridge",
      university: "Massachusetts Institute of Technology",
      level: "Doctorate",
      category: "mit_physics_phd_admissions",
      profile: "mit_physics_phd_applicant",
      program: "mit-physics-phd-course-8",
      name: "Doctor of Philosophy in Physics (Course 8 PhD)",
      source: "https://registrar.mit.edu/registration-academics/tuition-fees/graduate",
    },
    {
      id: "stanford-university-usa-ca",
      university: "Stanford University",
      level: "Master",
      category: "stanford_gsb_mba_track",
      profile: "stanford_gsb_mba_track_applicant",
      program: "stanford-mba",
      name: "Master of Business Administration (MBA)",
      source: "https://www.gsb.stanford.edu/programs/mba/tuition-financial-aid/cost-attendance",
    },
    {
      id: "harvard-usa-cambridge",
      university: "Harvard University",
      level: "Professional",
      category: "harvard_hls_jd",
      profile: "hls_jd_profile",
      funding: "hls_need_based_grant",
      program: "harvard-hls-jd",
      name: "Law (JD)",
      source: "https://hls.harvard.edu/sfs/financial-aid/financial-aid-policy/cost-of-attendance/",
    },
  ];

  for (const route of cases) {
    const state = {
      _v: 2,
      studyLevel: route.level,
      selectedAdmissionChoices: {
        [route.id]: {
          choiceKey: route.category,
          categoryId: route.category,
          requirementProfileId: route.profile,
          fundingOptionId: route.funding,
          programId: route.program,
          programName: route.name,
        },
      },
    };
    await page.goto("/");
    await page.evaluate(({ id, state }) => {
      localStorage.setItem("unisearch_saved_university_ids_v1", JSON.stringify([id]));
      localStorage.setItem("unisearch_profile", JSON.stringify(state));
      localStorage.setItem("unisearch_application_post_offer_v1", JSON.stringify({ [id]: true }));
      localStorage.setItem("unisearch_ui_language_v1", "eng");
    }, { id: route.id, state });
    await page.reload();
    await expect(page.locator("#openApplicationWorkspace")).toBeVisible();
    await page.locator("#openApplicationWorkspace").click();
    const section = page.locator("#applicationWorkspace .application-workspace__university").filter({ hasText: route.university });
    await expect(section).toBeVisible();
    const feeTask = section.locator(`[data-task-id="${route.id}:post-offer:confirm-cost"]`);
    await expect(feeTask).toBeVisible();
    await expect(feeTask.locator("a")).toHaveAttribute("href", route.source);
  }
});
