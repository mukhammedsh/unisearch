import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.window = globalThis.window || {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  setTimeout,
  clearTimeout,
};
globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {} },
};
if (!globalThis.navigator?.languages) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { languages: ["en-US"], language: "en-US" },
  });
}
globalThis.localStorage = globalThis.localStorage || {
  getItem() { return null; },
  setItem() {},
};

const {
  fetchCompareProfiles,
  compareBachelorProgramNames,
  compareProgramSummary,
  compareProgramTitle,
  compareSourceText,
  compareExtraRequirementsText,
  compareAdmissionChoiceOptionLabel,
  compareRequirementsText,
  compareAverageScoreText,
} = await import("../../frontend/javascript/pages/universities/compare-helpers.js");

function response(body, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("fetchCompareProfiles maps batch chances and rois", async () => {
  const calls = [];
  const result = await fetchCompareProfiles([" u-a ", "u-b"], {
    apiBase: "/api",
    loadProfileForApi: () => ({ gpa: 3.8 }),
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      assert.equal(url, "/api/universities/compare-profiles");
      return response({
        "u-a": { uniChance: { overallChance: 70 }, roi: { roi_value: 1.2 } },
        "u-b": { uniChance: { overallChance: 40 }, roi: { roi_value: 0.8 } },
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { university_ids: ["u-a", "u-b"], profile: { gpa: 3.8 } });
  assert.equal(result.chances.get("u-a").overallChance, 70);
  assert.equal(result.rois.get("u-b").roi_value, 0.8);
});

test("fetchCompareProfiles keeps nulls for missing batch rows", async () => {
  const result = await fetchCompareProfiles(["u-a", "missing"], {
    apiBase: "/api",
    loadProfileForApi: () => ({}),
    fetchImpl: async () => response({
      "u-a": { uniChance: { overallChance: 70 }, roi: { roi_value: 1.2 } },
      missing: null,
    }),
  });

  assert.equal(result.chances.get("u-a").overallChance, 70);
  assert.equal(result.chances.get("missing"), null);
  assert.equal(result.rois.get("missing"), null);
});

test("fetchCompareProfiles falls back to individual endpoints when batch fails", async () => {
  const urls = [];
  const result = await fetchCompareProfiles(["u-a", "u-b"], {
    apiBase: "/api",
    loadProfileForApi: () => ({ budget: 20000 }),
    fetchImpl: async (url) => {
      urls.push(url);
      if (url === "/api/universities/compare-profiles") return response({}, false, 500);
      if (url === "/api/universities/u-a/uni-chance") return response({ overallChance: 80 });
      if (url === "/api/universities/u-a/roi") return response({ roi_value: 1.4 });
      if (url === "/api/universities/u-b/uni-chance") return response({ overallChance: 35 });
      if (url === "/api/universities/u-b/roi") return response({ roi_value: 0.7 });
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.deepEqual(urls, [
    "/api/universities/compare-profiles",
    "/api/universities/u-a/uni-chance",
    "/api/universities/u-a/roi",
    "/api/universities/u-b/uni-chance",
    "/api/universities/u-b/roi",
  ]);
  assert.equal(result.chances.get("u-a").overallChance, 80);
  assert.equal(result.rois.get("u-b").roi_value, 0.7);
});

test("compareBachelorProgramNames deduplicates and formats program summary", () => {
  const uni = {
    id: "al-farabi-kazakh-national-university-kaz-almaty",
    academics: {
      programs: [
        { name: "Computer Science", study_levels: ["Bachelor"] },
        { name: "Computer Science", study_levels: ["Bachelor"] },
        { name: "Software Engineering", study_levels: ["Bachelor"] },
        { name: "Data Science", study_levels: ["Bachelor"] },
        { name: "Master of AI", study_levels: ["Master"] },
      ],
    },
  };

  const names = compareBachelorProgramNames(uni);
  assert.deepEqual(names, ["Computer Science", "Software Engineering", "Data Science"]);

  const summary = compareProgramSummary(uni);
  assert.equal(summary, "Computer Science, Software Engineering +1");

  const title = compareProgramTitle(uni);
  assert.equal(title, "Computer Science, Software Engineering, Data Science");
});

test("compareProgramSummary handles empty programs gracefully", () => {
  assert.equal(compareProgramSummary({}), "N/A");
  assert.equal(compareProgramTitle({}), "");
});

test("compareSourceText formats source and status", () => {
  const uni = {
    id: "mit-usa-cambridge",
    fact_provenance: {
      facts: {
        rank: {
          source: "QS World University Rankings 2026",
          status: "official",
        },
        acceptance_rate_percent: {
          source: "University Admissions reports & aggregated public statistical profiles",
          status: "official_aggregated",
        },
      },
    },
  };

  assert.equal(
    compareSourceText(uni, "rank"),
    "QS World University Rankings 2026 - Official"
  );
  assert.equal(
    compareSourceText(uni, "acceptance_rate_percent"),
    "University Admissions reports & aggregated public statistical profiles - Official Aggregated"
  );
});

test("compareExtraRequirementsText truncates with count", () => {
  const uni = {
    id: "oxford",
    admission_categories: [
      {
        requirement_profiles: [
          {
            extra_requirements: ["Motivation letter", "Interview", "Portfolio"],
          },
        ],
      },
    ],
  };

  const text = compareExtraRequirementsText(uni);
  assert.equal(text, "Motivation letter; Interview +1");
});

test("compareAdmissionChoiceOptionLabel formats clean and distinguishable labels", () => {
  const paidEntry = {
    option: {
      category_label: "UNT Admission",
      requirement_profile_label: "UNT",
      funding_type: "paid",
      label: "Paid Admission",
    },
  };
  const grantEntry = {
    option: {
      category_label: "UNT Admission",
      requirement_profile_label: "UNT",
      funding_type: "grant",
      funding_program: "State Educational Grant",
      label: "State Grant",
    },
  };
  const rectorEntry = {
    option: {
      category_label: "UNT Admission",
      requirement_profile_label: "UNT",
      funding_type: "grant",
      funding_program: "Rector Grant",
      label: "Profile - Rector Grant (Grant)",
    },
  };

  const uni = { id: "abai-kazakh-national-pedagogical-university-kaz-almaty" };

  assert.equal(compareAdmissionChoiceOptionLabel(paidEntry, uni), "UNT · Paid");
  assert.equal(compareAdmissionChoiceOptionLabel(grantEntry, uni), "UNT · State Grant");
  assert.equal(compareAdmissionChoiceOptionLabel(rectorEntry, uni), "UNT · Rector Grant");
});

test("formatExamValue formats GPA on 4.0 and 5.0 scales explicitly without percent", async () => {
  const { formatExamValue } = await import("../../frontend/javascript/utils.js");
  assert.equal(formatExamValue("GPA", 3.8), "3.8 (/4.0)");
  assert.equal(formatExamValue("GPA", 4), "4 (/4.0)");
  assert.equal(formatExamValue("GPA", 4.75, { scale: 5 }), "4.75 (/5.0)");
  assert.equal(formatExamValue("GPA", 4.85), "4.85 (/5.0)");
  assert.equal(formatExamValue("GPA", 3.8, { includeScale: false }), "3.8");
});

test("compareRequirementsText and compareAverageScoreText format GPA with scale", () => {
  const uni = {
    id: "test-uni",
    admission_categories: [
      {
        id: "cat1",
        requirements: { GPA: 3.5, SAT: 1400 },
        stats_avg: { GPA: 3.85, SAT: 1480 },
        requirement_profiles: [
          {
            id: "prof1",
            requirements: { GPA: 3.5, SAT: 1400 },
            stats_avg: { GPA: 3.85, SAT: 1480 },
          },
        ],
      },
    ],
  };

  const reqText = compareRequirementsText(uni);
  assert.match(reqText, /GPA 3\.5 \(\/4\.0\)/);
  assert.match(reqText, /SAT 1400/);

  const avgText = compareAverageScoreText(uni);
  assert.match(avgText, /GPA 3\.85 \(\/4\.0\)/);
  assert.match(avgText, /SAT 1480/);
});


