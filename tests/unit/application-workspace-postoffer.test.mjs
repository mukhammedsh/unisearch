import test from "node:test";
import assert from "node:assert/strict";

const { buildPostOfferTasks, postOfferGuideFor } = await import("../../frontend/javascript/pages/application-workspace-postoffer.js");

test("Oxford and MIT post-offer guides point to official CAS and I-20 or DS-2019 instructions", () => {
  const oxford = postOfferGuideFor("university-of-oxford-uk-oxford");
  const mit = postOfferGuideFor("mit-usa-cambridge");

  assert.equal(oxford.visaDocumentType, "cas");
  assert.equal(oxford.visaUrl, "https://www.ox.ac.uk/students/visa/before/cas");
  assert.equal(mit.visaDocumentType, "i20");
  assert.equal(mit.visaUrl, "https://iso.mit.edu/getting-started/requesting-an-i-20-or-ds-2019/");
});

test("post-offer actions have no invented deadlines or net-price calculation when costs are unknown", () => {
  const tasks = buildPostOfferTasks({ id: "mit-usa-cambridge", finance: {} });

  assert.equal(tasks.length, 4);
  assert.ok(tasks.every((task) => !Object.hasOwn(task, "date") && !Object.hasOwn(task, "deadline")));
  assert.equal(tasks[0].sourceUrl, "");
  assert.match(tasks[0].detailFallback, /remains unknown/i);
  assert.match(tasks[1].detailFallback, /not confirmed funds/i);
  assert.doesNotMatch(JSON.stringify(tasks), /netPrice|net_price|amount\s*:\s*0/i);
});

test("funding confirmation and visa steps are distinct, and unknown universities are not assigned a visa route", () => {
  const tasks = buildPostOfferTasks({ id: "university-of-oxford-uk-oxford", finance: { source_url: "https://www.ox.ac.uk/students/fees-funding/fees" } });

  assert.deepEqual(tasks.map((task) => task.id.split(":").at(-1)), ["confirm-cost", "confirm-award", "request-visa-document", "confirm-proof-of-funds"]);
  assert.equal(tasks[0].sourceUrl, "https://www.ox.ac.uk/students/fees-funding/fees");
  assert.equal(tasks[1].sourceUrl, tasks[0].sourceUrl);
  assert.equal(buildPostOfferTasks({ id: "not-in-top-five" }).length, 0);
});
