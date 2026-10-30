const { test, expect } = require("./helpers/coverage-test.cjs");
const { openDisclosureParents } = require("./helpers/selectors");

for (const { theme, mobile } of [{ theme: "light", mobile: false }, { theme: "dark", mobile: true }]) {
  test(`Kazakh NU Foundation overview and requirements (${theme}, ${mobile ? "phone" : "desktop"})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
    await page.addInitScript(theme => {
      localStorage.setItem("unisearch_ui_language_v1", "kaz");
      localStorage.setItem("unisearch_theme", theme);
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    }, theme);
    const params = new URLSearchParams({ id: "nazarbayev-university-kaz-astana", admission_option: "nu-a-study-nu-foundation-year-program",
      admission_application_route: "nu-a-route-regular-foundation-undergraduate", admission_level: "preparation",
      admission_route: "first_year", admission_cycle: "2027/28", admission_fee: "unknown" });
    await page.goto(`/university.html?${params}`);
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsStudyOverview")).toContainText("Бір оқу жылына созылатын күндізгі дайындық бағдарламасында");
    await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    const fact = page.locator("#detailRequirements [data-admissions-fact='nu-a-fact-fyp-academic']").first();
    await openDisclosureParents(fact);
    if (await fact.evaluate(node => node.tagName === "DETAILS" && !node.open)) await fact.locator(":scope > summary").click();
    await expect(fact).toContainText("жалпы балл 120/240");
    await expect(fact).toContainText("жалғыз немесе жалпы минимумы дегенді білдірмейді");
  });
}

test("Kazakh NUZYP source gaps retain their uncertainty", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "kaz");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana&admission_option=nu-a-study-nuzyp&admission_level=preparation");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator("#admissionsStudySources .admissions-programs__references > summary").click();
  await page.locator("#admissionsStudyInfo .admissions-catalog__unknowns > summary").click();
  await expect(page.locator("#admissionsStudyInfo")).toContainText("қазіргі қабылдауды немесе қазіргі талаптарды");
  await expect(page.locator("#admissionsStudyInfo")).toContainText("2017 жылғы оқу жоспары мен қаржыландыруды тек тарихи дерек ретінде сақтаңыз");
});

test("Kazakh Finance admission distinguishes test exemption from committee discretion", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "kaz");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  const params = new URLSearchParams({ id: "nazarbayev-university-kaz-astana", admission_option: "nu-b-study-master-of-science-in-finance",
    admission_application_route: "nu-b-route-master-of-science-in-finance", admission_level: "masters",
    admission_route: "graduate", admission_cycle: "2027-2028", admission_fee: "unknown" });
  await page.goto(`/university.html?${params}`);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("16 ай; төрт семестр");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("Кампуста күндізгі оқу");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("Астана; халықаралық резиденттік оқу бөлігі");
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const fact = page.locator("#detailRequirements [data-admissions-fact='nu-b-finance-requirements']").first();
  await openDisclosureParents(fact);
  if (await fact.evaluate(node => node.tagName === "DETAILS" && !node.open)) await fact.locator(":scope > summary").click();
  await expect(fact).toContainText("GRE/GMAT нәтижесін ұсыну ALEKS-тен босатады");
  await expect(fact).toContainText("Комиссия сандық тест нәтижелерін бәрібір сұрауы мүмкін");
});

test("Kazakh residency keeps conditional admission separate from funding on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "kaz");
    localStorage.setItem("unisearch_theme", "dark");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  const params = new URLSearchParams({ id: "nazarbayev-university-kaz-astana", admission_option: "nu-c-study-residency-in-neurology",
    admission_application_route: "nu-residency-conditional-umc", admission_level: "residency",
    admission_route: "graduate", admission_fee: "unknown" });
  await page.goto(`/university.html?${params}`);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const fact = page.locator("#detailRequirements [data-admissions-fact='nu-c-residency-conditional']").first();
  await openDisclosureParents(fact);
  if (await fact.evaluate(node => node.tagName === "DETAILS" && !node.open)) await fact.locator(":scope > summary").click();
  await expect(fact).toContainText("Шартты қабылдау қаржыландыру тағайындалды деген сөз емес");
  await expect(fact).toContainText("IFOM BSE немесе USMLE Step 1");
});

test("Kazakh joint BBA displays separate campus prices", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "kaz");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  const params = new URLSearchParams({ id: "nazarbayev-university-kaz-astana",
    admission_option: "nu-a-study-bachelor-of-business-administration-in-eurasian-business-joint-degree-with-hkust",
    admission_application_route: "nu-a-route-joint-bba", admission_level: "undergraduate", admission_route: "first_year", admission_fee: "unknown" });
  await page.goto(`/university.html?${params}`);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  const tuition = page.locator("#detailFinance [data-course-tuition]");
  await expect(tuition).toContainText("Назарбаев университеті және HKUST");
  await expect(tuition).toContainText(/15[\s,.]*000/);
  await expect(tuition).toContainText(/31[\s,.]*900/);
  await expect(tuition).toContainText("толық бағдарлама үшін");
});
