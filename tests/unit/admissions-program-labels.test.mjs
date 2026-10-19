import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const catalog = JSON.parse(await readFile(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
const packs = JSON.parse(await readFile(new URL("../../backend/data/universities_translations.json", import.meta.url), "utf8"));
global.fetch = async url => {
  if (String(url).includes("/universities/translations?")) {
    const language = new URL(url, "https://example.test").searchParams.get("lang");
    return { ok: true, json: async () => ({ lang: language, data: packs.languages[language] }) };
  }
  return { ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") };
};
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { initUniversityTranslations } = await import("../../frontend/javascript/university-translations.js");
const { admissionsProgramLabel, renderStudyOptionOverview } = await import("../../frontend/javascript/pages/university/admissions-render.js");
const { translateAdmissionSummary } = await import("../../frontend/javascript/university-translations.js");
const { renderApplicantSection } = await import("../../frontend/javascript/pages/university/admissions-presentation.js");
await initI18n();

test("MIT titles explain catalog codes separately from localized program names", async () => {
  const option = catalog.institutions[0].study_options.find(option => option.id === "mit-course-6-3-bachelor");
  for (const [language, title] of [["eng", "Computer Science and Engineering"], ["rus", "Компьютерные науки и инженерия"], ["kaz", "Информатика және инженерия"]]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    assert.deepEqual(admissionsProgramLabel(option), { title, officialTitle: option.title, courseCode: "6-3" });
  }
  assert.equal(option.title, "Computer Science and Engineering (Course 6-3)");
});

test("every reviewed program has a Russian and Kazakh title while retaining its official name and award", async () => {
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const institution of catalog.institutions) for (const option of institution.study_options) {
      const before = structuredClone(option);
      const label = admissionsProgramLabel(option);
      assert.match(label.title, /[\u0400-\u04ff]/u, `${language}: ${option.title}`);
      assert.equal(label.officialTitle, option.title);
      assert.deepEqual(option, before);
    }
  }
});

test("award suffixes, distinct subjects and named routes stay visible", () => {
  setLanguage("eng", { emit: false });
  assert.equal(admissionsProgramLabel({ title: "Computer Science (PhD)", awards: ["PHD"] }).title, "Computer Science (PhD)");
  assert.equal(admissionsProgramLabel({ title: "Computing (Software Engineering)", awards: ["MEng"] }).title, "Computing (Software Engineering)");
  assert.equal(admissionsProgramLabel({ title: "Master of Business Administration (Full-Time MBA)", awards: ["MBA"] }).title, "Master of Business Administration (Full-Time MBA)");
  assert.equal(admissionsProgramLabel({ id: "other-institution", title: "Example (Course 6-3)", awards: [] }).courseCode, "");
});

test("program essentials use existing localized value formatters and keep official prose", async () => {
  const resolved = { selected_option: { id: "cs", format: { mode: "On-campus", language: ["English"] } },
    fact_groups: { study: ["overview"] }, facts: [{ id: "overview", publication_status: "published", review_status: "verified",
      scope: { option_ids: ["cs"] }, value: { duration: "4 years", description: "Official description stays available." } }] };
  const before = structuredClone(resolved);
  for (const [language, expected] of [["eng", ["4 years", "On-campus", "English"]], ["rus", ["4 года", "Очно (кампус)", "Английский"]], ["kaz", ["4 жыл", "Кампуста", "Ағылшын"]]]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    const html = renderStudyOptionOverview(resolved);
    for (const value of expected) assert.ok(html.includes(value), `${language}: ${value}`);
    assert.ok(html.includes(resolved.facts[0].value.description));
  }
  assert.deepEqual(resolved, before);
});

test("all available MIT overview descriptions have complete Russian and Kazakh translations", async () => {
  const mit = catalog.institutions[0];
  const descriptions = new Set();
  for (const option of mit.study_options) {
    const rows = mit.facts.filter(row => row.publication_status === "published" && /verified|reviewed|rechecked|carried_forward/.test(row.review_status) && row.scope.option_ids.includes(option.id) && !row.scope.route_ids.length);
    const description = rows.flatMap(row => [row.value?.description, row.value?.course_page_programme_summary, row.value?.A3i6E, row.topic === "study_content" ? row.value?.source_content : undefined]).find(value => typeof value === "string" && value.trim());
    if (description) descriptions.add(description);
  }
  assert.ok(descriptions.size > 150);
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const description of descriptions) assert.match(translateAdmissionSummary(description), /[\u0400-\u04ff]/u, `${language}: ${description}`);
  }
});

test("Stanford collected study overviews have source-bound summaries, originals and honest missing states", async () => {
  const stanford = catalog.institutions.find(row => row.institution.id === "stanford-university-usa-ca");
  const descriptions = new Set();
  let covered = 0;
  for (const option of stanford.study_options) {
    const facts = stanford.facts.filter(row => row.publication_status === "published" && row.scope.option_ids.includes(option.id) && !row.scope.route_ids.length);
    const description = facts.flatMap(row => [row.value?.description, row.value?.course_page_programme_summary, row.value?.A3i6E, row.topic === "study_content" ? row.value?.source_content : undefined]).find(value => typeof value === "string" && value.trim());
    if (description) { descriptions.add(description); covered += 1; }
  }
  assert.equal(covered, 151);
  assert.equal(descriptions.size, 149);
  const fallback = JSON.parse(await readFile(new URL("../../frontend/Localization/universities-kaz.json", import.meta.url), "utf8"));
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const description of descriptions) {
      const summary = translateAdmissionSummary(description, { section: "study" });
      assert.ok(summary, `${language}: ${description}`);
      if (language !== "eng") assert.match(summary, /[\u0400-\u04ff]/u);
      if (language === "kaz") assert.equal(fallback.admission_summaries[description].study, summary);
    }
    const option = stanford.study_options.find(row => row.id === "stanford-option-cs-ms");
    const row = stanford.facts.find(row => row.id === "engineering-doerr-evidence:recheck-cs-ms-degree-completion-context");
    const html = renderStudyOptionOverview({ selected_option: option, facts: [row], fact_groups: { study: [row.id] } });
    assert.match(html, /data-program-original/);
    assert.match(html, /data-award-explanation/);
    assert.ok(html.includes("does not lead to the PhD"));
    assert.match(renderStudyOptionOverview({ selected_option: option, facts: [], fact_groups: {} }), /data-program-overview-missing/);
    assert.equal(translateAdmissionSummary("Changed overview", { section: "study" }), "");
  }
});

test("Stanford summaries retain international aid consequences, route-specific dates and source conflicts", async () => {
  const stanford = catalog.institutions.find(row => row.institution.id === "stanford-university-usa-ca");
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const suffix of ["stanford-ug-international-financial-aid-admission", "cs-phd-funding", "gsb_mba_aid_process", "med_md_aid"]) {
      const row = stanford.facts.find(row => row.id.split(":").at(-1) === suffix);
      assert.ok(translateAdmissionSummary(row.value, { section: "funding" }));
    }
    const conflict = stanford.facts.find(row => row.id.endsWith(":cs-ms-tests-and-english-policy"));
    const html = renderApplicantSection({ selected_option: { id: "stanford-option-cs-ms", levels: ["masters"] }, facts: [conflict], fact_groups: { requirements: [conflict.id] }, sources: stanford.sources }, ["requirements", "application"]);
    assert.match(html, /data-summary-conflict/);
    assert.match(html, /GRE/);
    assert.ok(html.includes(stanford.sources.find(source => source.id === conflict.source_ids[0]).url));
  }
});

test("accepted profile overviews extend Stanford reading without displaying catalog flags as descriptions", async () => {
  const stanford = catalog.institutions.find(row => row.institution.id === "stanford-university-usa-ca");
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    let coverage = 0;
    for (const original of stanford.study_options) {
      const overviews = original.evidence_profiles.flatMap(profile => {
        const description = profile.attributes.description;
        const text = typeof description === "object" && description ? description.text : description;
        return text ? [{ text, source_ids: profile.source_ids }] : [];
      });
      const option = { ...original, overviews };
      const facts = stanford.facts.filter(row => row.scope.option_ids.includes(option.id) && !row.scope.route_ids.length && row.topic.includes("study"));
      const html = renderStudyOptionOverview({ selected_option: option, facts, fact_groups: { study: facts.map(row => row.id) }, sources: stanford.sources });
      if (!html.includes("data-program-overview-missing")) coverage += 1;
      assert.doesNotMatch(html, /Bulletin flags:|externalAdmissions=True|programCurrentPhdOnly/);
    }
    assert.equal(coverage, stanford.study_options.length, language);
    const mba = stanford.study_options.find(row => row.id === "stanford-option-gsb-mba");
    const profile = mba.evidence_profiles[0];
    const html = renderStudyOptionOverview({ selected_option: { ...mba, overviews: [{ text: profile.attributes.description, source_ids: profile.source_ids }] }, facts: [], fact_groups: {}, sources: stanford.sources });
    assert.match(html, /data-program-original/);
    assert.match(html, /gsb\.stanford\.edu/);
    assert.ok(html.includes("Two-year, full-time MBA"));
  }
});

test("all sixteen completed Stanford overviews retain their original, exact official source and translations", async () => {
  const stanford = catalog.institutions.find(row => row.institution.id === "stanford-university-usa-ca");
  const completed = stanford.study_options.filter(option => option.evidence_profiles.some(profile => profile.attributes.catalog_access_description));
  assert.equal(completed.length, 16);
  const fallback = JSON.parse(await readFile(new URL("../../frontend/Localization/universities-kaz.json", import.meta.url), "utf8"));
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const original of completed) {
      const profile = original.evidence_profiles.find(profile => profile.attributes.catalog_access_description);
      const description = profile.attributes.description.text;
      const source = stanford.sources.find(source => profile.source_ids.includes(source.id) && source.checked_at === "2026-10-19" && source.url.startsWith("https://bulletin.stanford.edu/programs/"));
      assert.ok(source, original.id);
      assert.equal(decodeURIComponent(source.url).split("/").at(-1), original.catalog_code || original.attributes.catalog_code);
      const summary = translateAdmissionSummary(description, { section: "study" });
      assert.ok(summary, `${language}: ${original.id}`);
      if (language !== "eng") assert.match(summary, /[\u0400-\u04ff]/u);
      if (language === "kaz") assert.equal(fallback.admission_summaries[description].study, summary);
      const html = renderStudyOptionOverview({ selected_option: { ...original, overviews: [{ text: description, source_ids: profile.source_ids }] }, facts: [], fact_groups: {}, sources: stanford.sources });
      assert.match(html, /data-program-original/);
      assert.doesNotMatch(html, /data-program-overview-missing|Bulletin flags|externalAdmissions/);
      assert.ok(html.includes(source.url));
    }
    const structural = completed.find(option => option.id === "stanford-option-sbio-phd");
    const profile = structural.evidence_profiles.find(profile => profile.attributes.catalog_access_description);
    const summary = translateAdmissionSummary(profile.attributes.description.text, { section: "study" });
    assert.match(summary, /2026/);
    assert.match(summary, /23:59:59|11:59:59/);
    assert.match(summary, /GRE/);
    assert.match(profile.attributes.description.text, /December 15/);
    assert.match(profile.attributes.description.text, /GRE general score is optional/);
  }
});

test("every available Imperial overview is translated in both packs and the Kazakh fallback", async () => {
  const imperial = catalog.institutions.find(row => row.institution.id === "imperial-college-london-uk");
  const fallback = JSON.parse(await readFile(new URL("../../frontend/Localization/universities-kaz.json", import.meta.url), "utf8"));
  const descriptions = new Set(imperial.facts.map(row => row.value?.course_page_programme_summary).filter(Boolean));
  assert.equal(descriptions.size, 168);
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const description of descriptions) {
      assert.match(translateAdmissionSummary(description), /[\u0400-\u04ff]/u, `${language}: ${description}`);
      if (language === "kaz") assert.equal(fallback.admission_exact[description], translateAdmissionSummary(description));
    }
  }
});

test("every Imperial option has a source-bound study overview in all three languages", async () => {
  const imperial = catalog.institutions.find(row => row.institution.id === "imperial-college-london-uk");
  assert.equal(imperial.study_options.length, 360);
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const option of imperial.study_options) {
      const facts = imperial.facts.filter(row => row.scope.option_ids.includes(option.id));
      const resolved = { selected_option: option, facts, sources: imperial.sources,
        fact_groups: { study: facts.map(row => row.id) } };
      const html = renderStudyOptionOverview(resolved);
      assert.doesNotMatch(html, /data-program-overview-missing/, `${language}: ${option.id}`);
      const description = html.match(/<p class="program-card__description">([^<]+)<\/p>/)?.[1];
      assert.ok(description, `${language}: ${option.id}`);
      if (language !== "eng") {
        assert.match(description, /[\u0400-\u04ff]/u, `${language}: ${option.id}`);
        assert.doesNotMatch(description, /перевод.*не.*готов|аудармасы.*дайын емес/i, `${language}: ${option.id}`);
      }
    }
  }
});

test("structured Imperial curricula retain their original record, source links and option scope", async () => {
  const imperial = catalog.institutions.find(row => row.institution.id === "imperial-college-london-uk");
  const option = imperial.study_options.find(row => row.id === "imperial-option-full-time-mba");
  const facts = imperial.facts.filter(row => row.scope.option_ids.includes(option.id));
  const resolved = { selected_option: option, facts, sources: imperial.sources, fact_groups: { study: facts.map(row => row.id) } };
  const before = structuredClone(resolved);
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    const html = renderStudyOptionOverview(resolved);
    assert.match(html, /data-program-original/);
    assert.match(html, /Business Analytics/);
    assert.match(html, /https:\/\/www\.imperial\.ac\.uk/);
    assert.doesNotMatch(html, /&quot;study_periods_pathways_and_components&quot;/);
    assert.doesNotMatch(html, /Selector mode|Study periods pathways and components|Section label/);
    assert.match(html, /12 (?:months|месяцев|ай)/, `${language}: duration from the published key facts`);
    if (language !== "eng") assert.doesNotMatch(html.split("<details")[0], /Core modules|Pre-study modules/);
    const mismatched = { ...resolved, facts: facts.map(row => ({ ...row, applicability: { status: "mismatched" } })) };
    assert.match(renderStudyOptionOverview(mismatched), /data-program-overview-missing/);
    assert.match(renderStudyOptionOverview({ ...resolved, selected_option: { id: "unrelated" } }), /data-program-overview-missing/);
  }
  assert.deepEqual(resolved, before);
});

test("Imperial summaries keep course requirements, costs, dates and aid tied to their original evidence", async () => {
  const imperial = catalog.institutions.find(row => row.institution.id === "imperial-college-london-uk");
  const ids = ["imperial-computing-meng-admission", "imperial-computing-meng-course-profile", "imperial-ucas-process", "imperial-ucas-2027-window", "imperial-london-living-2026", "imperial-bursary-conditions", "imperial-inspires-2027-contract"];
  const facts = imperial.facts.filter(row => ids.includes(row.id));
  const resolved = { selected_option: imperial.study_options.find(row => row.id === "imperial-option-computing-meng"),
    selected_route: imperial.application_routes.find(row => row.id === "procedure-computing-meng"), facts, sources: imperial.sources,
    fact_groups: { requirements: [ids[0]], application: [ids[2]], deadlines: [ids[3]], costs: [ids[1], ids[4]], funding: ids.slice(5) } };
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    const entry = renderApplicantSection(resolved, ["requirements", "application"]);
    assert.match(entry, /data-source-summary="requirements"/);
    assert.match(entry, /41/);
    assert.match(entry, /TMUA/);
    assert.match(entry, /I50/);
    const overview = renderStudyOptionOverview({ ...resolved, fact_groups: { study: [ids[1]] } });
    if (language !== "eng") assert.doesNotMatch(overview, />Full-time<|>October 2027<|>Department of Computing</);
    const finance = renderApplicantSection(resolved, ["costs", "funding"]);
    assert.match(finance, /data-course-tuition/);
    assert.match(finance, /47,800/);
    assert.match(finance, /data-living-reference/);
    assert.doesNotMatch(finance, /admissions-reading__total/);
    assert.match(finance, /data-source-summary="funding"/);
    const dates = renderApplicantSection(resolved, ["deadlines"]);
    assert.match(dates, /data-ucas-dates/);
    assert.match(dates, /2027/);
    assert.match(dates, /TMUA/);
    const admission = facts.find(row => row.id === ids[0]);
    assert.ok(translateAdmissionSummary(admission.value.course_specific_test_blocks[0], { section: "requirements" }));
    assert.equal(translateAdmissionSummary("Changed official evidence", { section: "requirements" }), "");
  }
});

test("Computing PhD reading does not borrow MSc rounds and keeps yearless funding suggestions yearless", async () => {
  const imperial = catalog.institutions.find(row => row.institution.id === "imperial-college-london-uk");
  const ids = ["imperial-computing-phd-admission", "imperial-computing-funding-exceptions", "imperial-president-phd-funding"];
  const facts = imperial.facts.filter(row => ids.includes(row.id));
  const resolved = { selected_option: imperial.study_options.find(row => row.id === "imperial-computing-phd"),
    selected_route: imperial.application_routes.find(row => row.id === "procedure-computing-phd"), facts, sources: imperial.sources,
    fact_groups: { requirements: [ids[0]], application: [ids[0]], deadlines: [], funding: ids.slice(1) } };
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    const dates = renderApplicantSection(resolved, ["deadlines"]);
    assert.match(dates, /data-source-summary="deadlines"/);
    assert.match(dates, /2026/);
    assert.doesNotMatch(dates, /23:59|6 January|6 января|6 қаңтар/);
    const finance = renderApplicantSection(resolved, ["costs", "funding"]);
    assert.match(finance, /data-scholarship-rounds/);
    assert.match(finance, /2027/);
    assert.match(finance, /i?360|27,036|27 036/);
    const undergraduate = renderApplicantSection({ ...resolved, selected_option: { id: "undergraduate", levels: ["undergraduate"] } }, ["costs", "funding"]);
    assert.doesNotMatch(undergraduate, /data-scholarship-rounds|data-source-summary="funding"/);
  }
});

test("MIT aid documents are readable without disclosures and keep first-year and transfer dates separate", async () => {
  const mit = catalog.institutions[0];
  const facts = mit.facts.filter(row => ["undergraduate-aid-process-and-renewal", "undergraduate-aid-category-and-documents"].includes(row.id));
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const route of ["mit-first-year", "mit-transfer", "mit_eecs_doctoral_admissions"]) {
      const resolved = { selected_option: mit.study_options[0], selected_route: { id: route }, facts, sources: mit.sources, unknowns: [],
        fact_groups: { funding: facts.map(row => row.id) } };
      const html = renderApplicantSection(resolved, ["costs", "funding"]);
      const highlights = html.split('<details class="admissions-reading__references"')[0];
      if (route === "mit_eecs_doctoral_admissions") { assert.doesNotMatch(highlights, /data-aid-summary/); continue; }
      for (const value of ["data-aid-summary", "CSS Profile", "3514", "IDOC", "data-aid-fafsa"]) assert.ok(highlights.includes(value), `${language} ${route}: ${value}`);
      assert.doesNotMatch(highlights, /Current published policy|Need-based Aid/);
      if (route === "mit-transfer") assert.doesNotMatch(highlights, /Early Action|Regular Action/);
      else assert.match(highlights, /Early Action/);
    }
  }
});
