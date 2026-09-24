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
          if (aboutTitle && aboutTitle.textContent.includes("We are the abiturient team")) {
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
  await expect(aboutHeading).toContainText("Мы — команда абитуриентов, создавшая UniSearch.");

  const sawEnglish = await page.evaluate(() => window.__sawEnglishFlash);
  expect(sawEnglish).toBe(false);
});

test("dismissed scope notice does not flicker or appear when navigating to university detail page", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_universities_scope_notice_dismissed", "1");
  });

  await page.goto("/index.html");
  await expect(page.locator("#profileBtn")).toBeVisible();
  await expect(page.locator("#universitiesScopeNotice")).toBeHidden();

  // Install a MutationObserver to detect if #universityScopeNotice is ever added in a visible/non-hidden state
  await page.evaluate(() => {
    window.__sawScopeNoticeFlash = false;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const notice = node.matches?.("#universityScopeNotice, .d-page-scope")
            ? node
            : node.querySelector?.("#universityScopeNotice, .d-page-scope");
          if (notice && !notice.hidden && getComputedStyle(notice).display !== "none") {
            window.__sawScopeNoticeFlash = true;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  const detailLink = page.locator(".uni-card-link-overlay").first();
  await expect(detailLink).toBeVisible();
  await detailLink.click();

  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#universityScopeNotice")).toBeHidden();

  const sawNoticeFlash = await page.evaluate(() => window.__sawScopeNoticeFlash);
  expect(sawNoticeFlash).toBe(false);
});
