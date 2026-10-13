const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

const LOCALES = [
  {
    code: "eng",
    guide: "Guide",
    filter: "Filter",
    searchPlaceholder: "Search university...",
    backToList: "Back",
    programsTab: "Programs",
  },
  {
    code: "rus",
    guide: "Гайд",
    filter: "Фильтр",
    searchPlaceholder: "Поиск университета...",
    backToList: "Назад",
    programsTab: "Программы",
  },
];

async function switchLanguage(page, langCode) {
  const isAlreadyActive = await page.evaluate((expectedLang) => {
    const select = document.getElementById("languageSelect");
    const htmlLang = expectedLang === "rus" ? "ru" : "en";
    return select && select.value === expectedLang && select.dataset.loading !== "1" && document.documentElement.lang === htmlLang;
  }, langCode);

  if (isAlreadyActive) {
    return;
  }

  const langPromise = page.evaluate((expectedLang) => {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.detail?.language === expectedLang) {
          window.removeEventListener("languageChanged", handler);
          resolve(true);
        }
      };
      window.addEventListener("languageChanged", handler);
      setTimeout(() => {
        window.removeEventListener("languageChanged", handler);
        resolve(false);
      }, 5000);
    });
  }, langCode);

  await page.evaluate((nextLang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = nextLang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, langCode);

  await expect(page.locator("#languageSelect")).toHaveValue(langCode);
  await langPromise;
  await expect(page.locator("#languageSelect")).not.toBeDisabled();
}

test("universities page updates key UI texts for eng/rus", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator("#profileBtn")).toBeVisible();

  for (const locale of LOCALES) {
    await switchLanguage(page, locale.code);
    await expect(page.locator(".footer-product-links a[data-route='guide']")).toContainText(locale.guide);
    await expect(page.locator("[data-i18n='universities.filter']")).toContainText(locale.filter);
    await expect(page.locator("#qInput")).toHaveAttribute("placeholder", locale.searchPlaceholder);
  }
});

test("university detail page updates key UI texts for eng/rus", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/university.html?id=suleyman-demirel-university-kaz-kaskelen");
  await expect(page.locator("#profileBtn")).toBeVisible();
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");
  await expect(page.locator("#detailLocation img.flag-icon-inline")).toHaveCount(1);

  for (const locale of LOCALES) {
    await switchLanguage(page, locale.code);
    await expect(page.locator(".footer-product-links a[data-route='guide']")).toContainText(locale.guide);
    await expect(page.locator("#detailBackBtn")).toHaveAttribute("aria-label", locale.backToList);
    await expect(page.locator(".d-tab-btn[data-tab='tab-programs'] [data-i18n='university.tab.programs']")).toContainText(locale.programsTab);
    await expect(page.locator("#detailLocation img.flag-icon-inline")).toHaveCount(1);
    await expect(page.locator("#detailScholarshipInfo")).toContainText(
      locale.code === "rus" ? "Внутренний грант СДУ" : "SDU Internal Grant",
    );
  }
});

test("language switching preserves the detail ID after client-side navigation", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  const detailLink = page.locator(".uni-card-link-overlay").first();
  await expect(detailLink).toBeVisible();
  const detailHref = await detailLink.getAttribute("href");
  const expectedId = new URL(detailHref, page.url()).searchParams.get("id");

  await detailLink.click();
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailLoading")).not.toHaveClass(/is-visible/);

  await switchLanguage(page, "rus");
  await expect.poll(() => new URL(page.url()).searchParams.get("id")).toBe(expectedId);
  await expect(page.locator("#detailState")).not.toContainText("ID не указан");

  await page.reload();
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailLoading")).not.toHaveClass(/is-visible/);
});

test("client-side navigation with Russian language renders destination page directly in Russian without English flash", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });

  await page.goto("/index.html");
  await expect(page.locator("#profileBtn")).toBeVisible();

  // Install a MutationObserver to detect if any newly attached DOM contains raw English i18n text
  await page.evaluate(() => {
    window.__sawEnglishFlash = false;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const aboutTitle = node.matches?.("[data-i18n='about.title']")
            ? node
            : node.querySelector?.("[data-i18n='about.title']");
          if (aboutTitle && aboutTitle.textContent.includes("UniSearch is a service created by applicants")) {
            window.__sawEnglishFlash = true;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  // Navigate to About page via client-side routing
  const aboutLink = page.locator(".footer-product-links a[data-route='about']");
  await expect(aboutLink).toBeVisible();
  await aboutLink.click();

  const aboutHeading = page.locator("[data-i18n='about.title']");
  await expect(aboutHeading).toBeVisible();
  await expect(aboutHeading).toContainText("UniSearch — сервис, созданный абитуриентами для абитуриентов.");
  await expect(page.locator("[data-i18n='about.origin']")).toContainText("9 февраля 2026 года");
  await expect(page.locator("[data-i18n='about.origin']")).toContainText("нас — абитуриентов");
  await expect(page.locator("[data-i18n='about.evolution']")).toContainText("Спустя восемь месяцев");
  await expect(page.locator("[data-i18n='about.evolution']")).toContainText("сделали фокус на UniSearch");
  await expect(page.locator(".about-team-member")).toHaveCount(2);
  await expect(page.locator("[data-i18n='about.bio.lead']")).toContainText("серверную часть, базу данных");
  await expect(page.locator("[data-i18n='about.role.planning']")).toHaveText("Сооснователь и ведущий разработчик интерфейса");
  await expect(page.locator("[data-i18n='about.bio.planning']")).toContainText("основное тестирование");
  await expect(page.locator("#about-contact-title")).toHaveText("Свяжитесь с нами");
  await expect(page.locator(".about-contact-item")).toHaveCount(3);
  await expect(page.locator(".about-contact-item a[href='mailto:unisearch.sup@gmail.com']")).toBeVisible();
  await expect(page.locator(".about-contact-item a[href='https://github.com/mukhammedsh/unisearch']")).toBeVisible();
  await expect(page.locator(".about-contact-item a[href='https://t.me/unisearch_kz']")).toHaveText("@unisearch_kz");
  await expect(page.locator(".about-contact-icon")).toHaveCount(3);
  await expect(page.locator(".about-contact-icon[data-heroicon='envelope'] svg")).toBeVisible();

  const sawEnglish = await page.evaluate(() => window.__sawEnglishFlash);
  expect(sawEnglish).toBe(false);

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      await expect(page.locator(".about-team-member")).toHaveCount(2);
      const layout = await page.locator(".about-page").evaluate((element) => {
        const box = element.getBoundingClientRect();
        const canvas = document.body.getBoundingClientRect();
        return {
          left: box.left - canvas.left,
          right: canvas.right - box.right,
          panelColor: getComputedStyle(element).backgroundColor,
          canvasColor: getComputedStyle(document.body).backgroundColor,
          hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
        };
      });
      expect(Math.abs(layout.left - layout.right)).toBeLessThanOrEqual(1);
      expect(layout.panelColor).not.toBe(layout.canvasColor);
      expect(layout.hasHorizontalOverflow).toBe(false);
    }
  }
});
