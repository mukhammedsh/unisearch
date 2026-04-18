const selectors = {
  profileBtn: "#profileBtn",
  profileModal: "#profileModal",
  profileCloseBtn: "#profileCloseBtn",
  nameInput: "#profileNameInput",
  editNameBtn: "#editNameBtn",
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
  selectors,
  expectProfileTabVisible,
  openProfileTab,
  setNativeSelect,
  setRangeValue,
};
