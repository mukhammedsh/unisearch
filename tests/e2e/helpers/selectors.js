const selectors = {
  profileBtn: "#profileBtn",
  profileModal: "#profileModal",
  profileCloseBtn: "#profileCloseBtn",
  budgetInput: "#budgetInput",
  saveProfileBtn: "#saveProfileBtn",
  saveBudgetBtn: "#saveProfileBtn, #saveBudgetBtn",
  gpaInput: "#gpaInput",
  saveGpaBtn: "#saveProfileBtn, #saveGpaBtn",
  interestsInput: "#profileInterestsInput",
  majorSelect: "#profileMajorSelect",
  fundingTypeSelect: "#profileFundingTypeSelect",
  studyModeSelect: "#studyModeSelect",
  examNameSelect: "#examNameSelect",
  examScoreInput: "#examScoreInput",
  addExamBtn: "#addExamBtn",
  examList: "#examList",
  universitiesList: "#universitiesList",
  queryInput: "#qInput",
  countrySelect: "#countrySelect",
  sortSelect: "#sortSelect",
  focusSlider: "#focusSlider",
  focusLabel: "#focusLabel",
  atmosphereSlider: "#atmosphereSlider",
  atmosphereLabel: "#atmosphereLabel",
  financeSlider: "#financeSlider",
  financeLabel: "#financeLabel",
  locationSlider: "#locationSlider",
  locationLabel: "#locationLabel",
  languageSelect: "#languageSelect",
  langCode: "#langCode",
  langKind: "#langKind",
  langExam: "#langExam",
  langExamScore: "#langExamScore",
  langAddBtn: "#langAddBtn",
  langList: "#langList",
};

async function setNativeSelect(page, elementId, value) {
  await page.evaluate(
    ({ id, nextValue }) => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.value = nextValue;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { id: elementId, nextValue: value }
  );
}

async function openDisclosureParents(locator) {
  const closedParent = locator.locator("xpath=ancestor::details[not(@open)][last()]");
  while (await closedParent.count()) await closedParent.locator(":scope > summary").click();
}

async function revealRestrictedProgram(locator) {
  const list = locator.locator("xpath=ancestor::div[@id='admissionsProgramList']");
  const disclosure = list.locator("details.admissions-programs__restricted");
  if (await disclosure.count() && !(await disclosure.evaluate(node => node.open))) {
    await disclosure.locator("summary").click();
  }
}

async function openAdmissionSelectionEditor(page) {
  const editor = page.locator("#admissionsSelectionEditor");
  if (!(await editor.isVisible())) {
    const edit = page.locator("#admissionsReferenceSummary button");
    if (await edit.isVisible()) await edit.click();
  }
  await editor.waitFor({ state: "visible" });
}

async function selectAdmissionRoute(page, value) {
  const selected = page.locator("#admissionsRoute");
  if (await selected.inputValue() === value) return;
  await openAdmissionSelectionEditor(page);

  const publishedRoute = page.locator(`[data-read-route="${value}"]`);
  await openDisclosureParents(publishedRoute);
  if (await publishedRoute.isVisible()) {
    await publishedRoute.click();
    await page.locator('#admissionsContext[data-state="ready"]').waitFor();
    return;
  }

  const sharedRoute = page.locator(`[data-shared-route="${value}"]`);
  if (await sharedRoute.isVisible()) {
    await sharedRoute.click();
    await page.locator('#admissionsContext[data-state="ready"]').waitFor();
    return;
  }

  const wrapper = page.locator(".custom-select-wrapper:has(#admissionsRoute)");
  await wrapper.locator(".custom-select-trigger").click();
  await wrapper.locator(`.custom-option[data-value="${value}"]`).click();
  await page.locator('#admissionsContext[data-state="ready"]').waitFor();
}

async function setRangeValue(page, elementId, value) {
  await page.evaluate(
    ({ id, nextValue }) => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.value = String(nextValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { id: elementId, nextValue: value }
  );
}

async function openProfileTab(page, tabName) {
  const tab = page.locator(`[data-profile-tab="${tabName}"]`);
  await tab.click();
  await expectProfileTabVisible(page, tabName);
}

async function expectProfileTabVisible(page, tabName) {
  await page.waitForFunction((name) => {
    const tab = document.querySelector(`[data-profile-tab="${name}"]`);
    const panel = document.querySelector(`[data-profile-section="${name}"]`);
    if (!tab || !panel) return false;
    return tab.classList.contains("is-active") && !panel.classList.contains("is-section-hidden");
  }, tabName);
}

module.exports = {
  openDisclosureParents,
  revealRestrictedProgram,
  openAdmissionSelectionEditor,
  selectAdmissionRoute,
  selectors,
  expectProfileTabVisible,
  openProfileTab,
  setNativeSelect,
  setRangeValue,
};
