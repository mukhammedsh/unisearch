import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "").split("?")[0];
  if (target.endsWith("Localization/eng")) {
    return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } };
  }
  if (target.endsWith("Localization/ru")) {
    return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8"); } };
  }
  return { ok: false, async text() { return ""; } };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { renderAdmissionSection } = await import("../../frontend/javascript/pages/university/admission-section.js");
await initI18n();
setLanguage("eng", { emit: false });

function createContainer() {
  return {
    innerHTML: "",
    querySelectorAll: () => [],
    querySelector: () => null,
  };
}

function render(university) {
  const container = createContainer();
  renderAdmissionSection({
    container,
    university,
    annualCostForTrack: () => 12000,
    compactMode: true,
  });
  return container.innerHTML;
}

test("hides empty average-admitted boxes and expands minimums to a single column", () => {
  const withoutAvg = render({
    id: "no-avg-uni",
    admission_categories: [{
      id: "cat-1",
      label: "First-year admission",
      study_levels: ["Bachelor"],
      applicant_route: "first_year",
      requirement_profiles: [{ id: "gen", label: "General", requirements: { SAT: 1200 } }],
    }],
  });
  assert.match(withoutAvg, /class="admission-requirement-grid admission-requirement-grid--single"/);
  assert.doesNotMatch(withoutAvg, /track-stats-box--avg/);
  assert.doesNotMatch(withoutAvg, /No verified average admitted/);

  const withAvg = render({
    id: "with-avg-uni",
    admission_categories: [{
      id: "cat-1",
      label: "First-year admission",
      study_levels: ["Bachelor"],
      applicant_route: "first_year",
      requirement_profiles: [{ id: "gen", label: "General", requirements: { SAT: 1200 }, stats_avg: { SAT: 1450 } }],
    }],
  });
  assert.match(withAvg, /class="admission-requirement-grid"/);
  assert.doesNotMatch(withAvg, /admission-requirement-grid--single/);
  assert.match(withAvg, /track-stats-box--avg/);
});

test("hides single-profile count badge and simplifies category kicker without duplicating title", () => {
  const single = render({
    id: "single-profile-uni",
    admission_categories: [{
      id: "cat-1",
      label: "First-year admission",
      scope: "general",
      study_levels: ["Bachelor"],
      applicant_route: "first_year",
      requirement_profiles: [{ id: "gen", label: "General", requirements: { SAT: 1200 } }],
    }],
  });
  assert.doesNotMatch(single, /admission-category-count/);
  assert.doesNotMatch(single, /Admission category|Applicant route|General/);
  assert.match(single, /admission-category-kicker[^>]*><span class="admission-level-badge">Bachelor/);
  // Title already contains "First-year", so the duplicate route label is omitted from the kicker.
  assert.doesNotMatch(single, /admission-category-kicker[^>]*>.*First-year.*<\/div>/);

  const multi = render({
    id: "multi-profile-uni",
    admission_categories: [{
      id: "cat-2",
      label: "Direct entry",
      scope: "program_specific",
      study_levels: ["Bachelor"],
      applicant_route: "transfer",
      requirement_profiles: [
        { id: "p1", label: "Track A", requirements: { SAT: 1200 } },
        { id: "p2", label: "Track B", requirements: { ACT: 26 } },
      ],
    }],
  });
  assert.match(multi, /class="admission-category-count">2 profiles<\/div>/);
  assert.match(multi, /admission-category-kicker[^>]*>.*Program-specific.*Transfer/);
});

test("omits non-merit funding-difference placeholder while keeping concise competitive grant note", () => {
  const html = render({
    id: "funding-uni",
    admission_categories: [{
      id: "cat-1",
      label: "General entry",
      study_levels: ["Bachelor"],
      applicant_route: "first_year",
      requirement_profiles: [{
        id: "gen",
        label: "General",
        requirements: { SAT: 1200 },
        funding_options: [
          { id: "paid", label: "Paid", funding_type: "paid", funding_source: "self_funded" },
          { id: "grant", label: "Merit Grant", funding_type: "grant", funding_source: "merit" },
        ],
      }],
    }],
  });
  assert.doesNotMatch(html, /No separate funding-specific requirements/);
  assert.match(html, /Grant is awarded separately by competition; no separate grant score cutoff is published\./);
  assert.equal((html.match(/class="admission-funding-diff-note"/g) || []).length, 1);
});
