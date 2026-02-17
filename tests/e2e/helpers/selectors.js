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

module.exports = {
  selectors,
  setNativeSelect,
  setRangeValue,
};
