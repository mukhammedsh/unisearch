const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

for (const width of [320, 390, 768, 900, 1440]) {
  for (const language of ["eng", "rus", "kaz"]) {
    test(`profile spacing at ${width}px in ${language}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await mockAllExpensiveEndpoints(page);
      await page.addInitScript((lang) => localStorage.setItem("unisearch_ui_language_v1", lang), language);
      await page.goto("/profile.html");
      await page.waitForFunction(() => !!window.__unisearchProfileDraft);
      await expect(page.locator("#siteInitialLoader")).toBeHidden();

      const checkLayout = async () => {
        const issues = await page.locator(".profile-shell").evaluate((shell) => {
          const errors = [];
          const workspace = shell.querySelector(".profile-workspace-layout");
          if (workspace.scrollWidth > workspace.clientWidth + 1) errors.push("Workspace overflows horizontally");
          for (const field of shell.querySelectorAll(".profile-field, .lang-control-item, .profile-exam-breakdown-subject, .profile-exam-breakdown-score, .profile-exam-special-field")) {
            if (!field.getClientRects().length) continue;
            const box = field.getBoundingClientRect();
            const control = field.querySelector(":scope > .profile-input:not(select), :scope > .custom-select-wrapper, :scope > .profile-exam-breakdown-chip");
            if (!control) continue;
            const rect = control.getBoundingClientRect();
            if (rect.left < box.left - 1 || rect.right > box.right + 1) errors.push(`Overflow: ${control.id || field.textContent.trim()}`);
            const label = field.querySelector(":scope > label, :scope > .mini-label:not(.mini-label--hidden)");
            if (label && rect.top - label.getBoundingClientRect().bottom < 7) errors.push(`Crowded label: ${label.htmlFor || label.textContent.trim()}`);
          }
          const budgetWrap = shell.querySelector("#budgetInput")?.closest(".profile-budget--with-unit");
          const budgetInput = shell.querySelector("#budgetInput");
          const budgetUnit = shell.querySelector("#profileBudgetUnit");
          if (budgetWrap && budgetInput && budgetUnit && budgetWrap.getClientRects().length) {
            const wrapBox = budgetWrap.getBoundingClientRect();
            const inputBox = budgetInput.getBoundingClientRect();
            const unitBox = budgetUnit.getBoundingClientRect();
            if (inputBox.left - wrapBox.left < 10) errors.push("Budget input missing left padding");
            if (inputBox.right > unitBox.left + 1) errors.push("Budget input overlaps unit");
          }
          const examForm = shell.querySelector(".profile-exam-form");
          const examControls = examForm?.querySelector(".profile-exam-form-controls");
          if (examForm && examControls && examForm.getClientRects().length) {
            const formBox = examForm.getBoundingClientRect();
            const controlsBox = examControls.getBoundingClientRect();
            if (Math.abs(controlsBox.left - formBox.left) > 2 || Math.abs(controlsBox.width - formBox.width) > 2) {
              errors.push("Exam form controls not stretched across form");
            }
          }
          for (const grid of shell.querySelectorAll(".profile-applicant-context-grid")) {
            const fields = Array.from(grid.children).filter((node) => node.getClientRects().length);
            for (let i = 1; i < fields.length; i++) {
              const previous = fields[i - 1].getBoundingClientRect();
              const current = fields[i].getBoundingClientRect();
              if (current.top >= previous.bottom && current.top - previous.bottom < 19) errors.push("Crowded evidence rows");
            }
          }
          return errors;
        });
        expect(issues).toEqual([]);
      };

      await checkLayout();
      await setNativeSelect(page, "languageEvidenceKind", "education");
      const kind = page.locator("#languageEvidenceKind").locator("xpath=ancestor::div[contains(@class,'profile-field')][1]");
      const grid = kind.locator("..");
      expect((await kind.boundingBox()).width).toBeCloseTo((await grid.boundingBox()).width, 0);
      await setNativeSelect(page, "institutionEvidenceUniversity", "mit-usa-cambridge");
      for (const evidence of ["enrollment", "gpa", "credential"]) {
        await setNativeSelect(page, "institutionEvidenceKind", evidence);
        await checkLayout();
      }
      await setNativeSelect(page, "examNameSelect", "SAT");
      await checkLayout();
      await setNativeSelect(page, "langCode", "en");
      await setNativeSelect(page, "langKind", "exam");
      await setNativeSelect(page, "langExam", "IELTS");
      await checkLayout();

      if (language === "rus" && [390, 1440].includes(width)) {
        for (const theme of ["light", "dark"]) {
          await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
          for (const section of ["basics", "preferences", "scores", "languages", "specific"]) {
            await page.locator(`[data-profile-section="${section}"]`).scrollIntoViewIfNeeded();
            await page.screenshot({ path: testInfo.outputPath(`${section}-${theme}.png`) });
          }
        }
      }
    });
  }
}
