const { test, expect } = require('./helpers/coverage-test.cjs');
const MIT = 'mit-usa-cambridge';
const presentations = [
  { language: 'eng', width: 1280, theme: 'light' },
  { language: 'rus', width: 390, theme: 'dark' },
  { language: 'kaz', width: 320, theme: 'light' },
];
async function open(page, presentation, option, route = '', level = '') {
  await page.setViewportSize({ width: presentation.width, height: 900 });
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem('unisearch_ui_language_v1', language);
    localStorage.setItem('unisearch_theme', theme);
    localStorage.removeItem('unisearch_profile');
  }, presentation);
  const params = new URLSearchParams({ id: MIT, admission_option: option, admission_level: level });
  if (route) params.set('admission_application_route', route);
  await page.goto(`/university.html?${params}`);
  await expect(page.locator('#detailCard')).toHaveClass(/is-mounted/);
  await expect(page.locator('#admissionsContext')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#admissionsReferenceSummary strong')).not.toBeEmpty();
}
async function tab(page, name) {
  await page.locator(`[data-tab="tab-${name}"]`).click();
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

for (const presentation of presentations) {
  for (const option of ['mit-bs-3-c', 'mit-bs-21', 'mit-bs-sts', 'mit-chemical-engineering-sm', 'mit-eecs-en-route-sm', 'mit-hst-terminal-sm']) {
    test(`${option} has a readable sourced overview in ${presentation.language}`, async ({ page }) => {
      await open(page, presentation, option);
      const description = page.locator('#admissionsStudyOverview > .program-card__description');
      await expect(description).toBeVisible();
      if (presentation.language !== 'eng') {
        await expect(description).toContainText(/[\u0400-\u04ff]/);
        const original = page.locator('#admissionsStudyOverview [data-program-original]');
        await original.locator(':scope > summary').click();
        await expect(original.locator('p').first()).toBeVisible();
        await expect(original.locator('a[href^="https://"]')).not.toHaveCount(0);
      } else await expect(page.locator('[data-program-overview-sources] a')).not.toHaveCount(0);
      if (option === 'mit-bs-sts') await expect(description).toContainText(/second major|вторую специальность|екінші мамандық/);
      if (['mit-chemical-engineering-sm', 'mit-hst-terminal-sm'].includes(option)) {
        await page.locator('#admissionsViewRequirements').click();
        await expect(page.locator('[data-no-application-route]')).toBeVisible();
        await expect(page.locator('#admissionsContextForm')).toBeHidden();
        await expect(page.locator('#admissionsSaveChoice')).toBeDisabled();
        await expect(page.locator('#admissionsContext a[href^="https://"]')).toBeVisible();
        await tab(page, 'finance');
        await expect(page.locator('#detailFinance button')).toBeVisible();
        await page.locator('#detailFinance button').click();
        await expect(page.locator('#tab-programs')).toHaveClass(/active/);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(presentation.width);
      for (const id of ['detailWebsite', 'detailMapLink']) await expect(page.locator(`#${id}`)).toHaveAttribute('aria-label', /.+/);
    });
  }

  test(`MIT transfer makes spring restrictions and documents understandable in ${presentation.language}`, async ({ page }) => {
    await open(page, presentation, 'mit-course-6-3-bachelor', 'mit-transfer', 'undergraduate');
    await expect(page.locator('#detailRequirements .admissions-reading__section')).toContainText([/SAT|ACT/]);
    const summaries = page.locator('#detailRequirements [data-source-summary="requirements"]');
    await expect(summaries).toContainText({ eng: 'not a published minimum', rus: 'не опубликованный минимум', kaz: 'жарияланған ең төменгі шек емес' }[presentation.language]);
    await expect(page.locator('#detailRequirements [data-source-summary="application"]')).toContainText('75');
    if (presentation.language !== 'eng') {
      const documents = page.locator('#detailRequirements .admissions-reading__section').filter({ has: page.locator('.admissions-catalog__items') }).first();
      await expect(documents).not.toContainText('Two college instructor recommendations');
    }
    await tab(page, 'deadlines');
    const dates = page.locator('[data-transfer-windows]');
    await expect(dates).toContainText('2026');
    await expect(dates).toContainText('2027');
    await expect(dates).toContainText({ eng: 'Only US citizens', rus: 'Только граждане США', kaz: 'Тек АҚШ азаматтары' }[presentation.language]);
    await expect(dates).toContainText({ eng: 'international transfer applicants', rus: 'иностранные абитуриенты', kaz: 'шетелдік transfer' }[presentation.language]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(presentation.width);
  });

  test(`Sloan regular rounds and deferred entry stay separate in the ${presentation.language} calendar`, async ({ page }) => {
    await open(page, presentation, 'mit-sloan-mba-full-time', 'mit_sloan_mba_admissions', 'masters');
    await tab(page, 'deadlines');
    const published = page.locator('[data-published-deadline-array]');
    await expect(published).toContainText('2026');
    await expect(published).toContainText('2027');
    await expect(published).toContainText('15:00');
    const grid = page.locator('[data-calendar-month-key]');
    async function month(target) {
      for (let step = 0; step < 12; step += 1) {
        const current = await grid.getAttribute('data-calendar-month-key');
        if (current === target) break;
        await page.locator(`[data-calendar-month="${current < target ? 'next' : 'previous'}"]`).click();
      }
      await expect(grid).toHaveAttribute('data-calendar-month-key', target);
    }
    await month('2027-01');
    const details = page.locator('.deadline-calendar__details');
    await expect(details).toContainText({ eng: 'Round 2', rus: 'Раунд 2', kaz: '2-раунд' }[presentation.language]);
    await expect(details).toContainText('15:00');
    await expect(details).toContainText('America/New_York');
    await expect(details).not.toContainText('graduate_applicant');
    const downloadPromise = page.waitForEvent('download');
    await details.locator('[data-calendar-export]').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let content = '';
    for await (const chunk of stream) content += chunk.toString();
    expect(content.replace(/\r\n /g, '')).toContain('DTSTART:20270112T200000Z');
    await month('2027-04');
    await expect(details).toContainText({ eng: 'deferred entry', rus: 'отложенное начало учёбы', kaz: 'оқуды кейін бастау' }[presentation.language]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(presentation.width);
  });

  for (const [option, route, level, pattern] of [
    ['mit-physics-phd-course-8', 'mit_physics_phd_admissions', 'doctoral', /not required|не обязателен|міндетті емес/],
    ['mit-sloan-mba-full-time', 'mit_sloan_mba_admissions', 'masters', /GMAT/],
    ['mit-course-6-9p-meng', 'mit_bcs_meng_admissions', 'masters', /4[.,]25\/5/],
  ]) {
    test(`${route} has scoped applicant guidance in ${presentation.language}`, async ({ page }) => {
      await open(page, presentation, option, route, level);
      const requirements = page.locator('#detailRequirements [data-source-summary="requirements"]');
      await expect(requirements).toContainText(pattern);
      const fullRecords = page.locator('#detailRequirements [data-admissions-fact]').first();
      await expect(fullRecords).toHaveCount(1);
      await tab(page, 'finance');
      await expect(page.locator('#detailFinance [data-source-summary="funding"]')).toBeVisible();
      if (route === 'mit_sloan_mba_admissions') {
        await expect(page.locator('#detailFinance [data-source-summary="costs"]')).toContainText(/91[ ,]?892/);
        await expect(page.locator('#detailFinance [data-summary-conflict]')).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(presentation.width);
    });
  }
}
