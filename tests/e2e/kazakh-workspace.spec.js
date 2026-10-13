const { test, expect } = require("@playwright/test");

const scenarios = [
  { name: "desktop light", width: 1280, height: 900, theme: "light" },
  { name: "phone dark", width: 390, height: 844, theme: "dark" },
];

async function expectPageReady(page, pageName, theme) {
  await expect(page.locator("body")).toHaveAttribute("data-page", pageName);
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/initial-loading/);
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function expectNoHorizontalOverflow(page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(fits).toBe(true);
}

for (const scenario of scenarios) {
  test(`Kazakh About and profile flows fit ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.addInitScript(({ theme }) => {
      localStorage.setItem("unisearch_ui_language_v1", "kaz");
      localStorage.setItem("unisearch_theme", theme);
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    }, { theme: scenario.theme });

    await page.goto("/about.html");
    await expectPageReady(page, "about", scenario.theme);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("UniSearch – талапкерлер үшін талапкерлер жасаған қызмет.");
    await expect(page.locator("#about-team-title")).toHaveText("Біздің команда");
    await expect(page.locator(".about-team-member h3").nth(0)).toHaveText("Мұхаммед Шабдалұлы");
    await expect(page.locator(".about-team-member h3").nth(1)).toHaveText("Ерболат Рашидов");
    await expect(page.locator("#about-contact-title")).toHaveText("Бізбен байланысу");

    const contactLinks = page.locator(".about-contact-list a");
    await expect(contactLinks).toHaveCount(3);
    await expect(page.getByRole("link", { name: "unisearch.sup@gmail.com" })).toHaveAttribute("href", "mailto:unisearch.sup@gmail.com");
    await expect(page.getByRole("link", { name: "github.com/mukhammedsh/unisearch" })).toHaveAttribute("href", "https://github.com/mukhammedsh/unisearch");
    await expect(page.getByRole("link", { name: "@unisearch_kz" })).toHaveAttribute("href", "https://t.me/unisearch_kz");
    await expectNoHorizontalOverflow(page);

    await page.goto("/profile.html");
    await expectPageReady(page, "profile", scenario.theme);
    await expect(page.locator(".profile-page-header")).toBeVisible();
    await expect(page.locator(".profile-page-title")).toHaveText("Профиль");
    await expect(page.locator(".profile-progress-card")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.locator("#budgetInput").fill("25000");
    await page.getByRole("button", { name: "Сақтау" }).click();
    await expect(page.locator("#profileSaveState")).toBeVisible();
    await page.reload();
    await expectPageReady(page, "profile", scenario.theme);
    await expect(page.locator("#budgetInput")).toHaveValue("25000");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").budget)).toBe(25000);
    await expectNoHorizontalOverflow(page);
  });
}
