import test from "node:test";
import assert from "node:assert/strict";

function getActiveSectionId(sections, anchorTop, scrollY, windowHeight, docHeight) {
  if (!sections.length) return "";

  if (Math.ceil(windowHeight + scrollY) >= docHeight - 30) {
    return sections[sections.length - 1].id;
  }

  const firstRect = sections[0].rect;
  if (scrollY < 40 || firstRect.top > anchorTop) {
    return sections[0].id;
  }

  let activeId = sections[0].id;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].rect.top <= anchorTop) {
      activeId = sections[i].id;
    } else {
      break;
    }
  }

  return activeId;
}

test("scrollspy never skips short sections", () => {
  const anchorTop = 115;
  const windowHeight = 800;
  const docHeight = 3000;

  const getSectionsAtScroll = (scrollY) => [
    { id: "sec-0", rect: { top: 0 - scrollY, bottom: 800 - scrollY } },
    { id: "sec-1", rect: { top: 800 - scrollY, bottom: 920 - scrollY } },
    { id: "sec-2", rect: { top: 920 - scrollY, bottom: 2000 - scrollY } },
  ];

  assert.equal(
    getActiveSectionId(getSectionsAtScroll(0), anchorTop, 0, windowHeight, docHeight),
    "sec-0"
  );

  assert.equal(
    getActiveSectionId(getSectionsAtScroll(685), anchorTop, 685, windowHeight, docHeight),
    "sec-1"
  );

  assert.equal(
    getActiveSectionId(getSectionsAtScroll(720), anchorTop, 720, windowHeight, docHeight),
    "sec-1"
  );

  assert.equal(
    getActiveSectionId(getSectionsAtScroll(800), anchorTop, 800, windowHeight, docHeight),
    "sec-1"
  );

  assert.equal(
    getActiveSectionId(getSectionsAtScroll(805), anchorTop, 805, windowHeight, docHeight),
    "sec-2"
  );

  assert.equal(
    getActiveSectionId(getSectionsAtScroll(2200), anchorTop, 2200, windowHeight, docHeight),
    "sec-2"
  );
});

test("comparison with broken old formula: proves old formula skipped sec-1", () => {
  const windowHeight = 800;
  const viewportTop = 110;
  const viewportBottom = windowHeight - 120;

  const scrollY = 720;
  const sections = [
    { id: "sec-0", rect: { top: 0 - scrollY, bottom: 800 - scrollY } },
    { id: "sec-1", rect: { top: 800 - scrollY, bottom: 920 - scrollY } },
    { id: "sec-2", rect: { top: 920 - scrollY, bottom: 2000 - scrollY } },
  ];

  let bestOldScore = Number.NEGATIVE_INFINITY;
  let oldWinningId = "";

  for (const s of sections) {
    const rect = s.rect;
    const visibleTop = Math.max(rect.top, viewportTop);
    const visibleBottom = Math.min(rect.bottom, viewportBottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const distancePenalty = Math.abs(rect.top - viewportTop) * 0.08;
    const score = visibleHeight - distancePenalty;
    if (score > bestOldScore) {
      bestOldScore = score;
      oldWinningId = s.id;
    }
  }

  assert.equal(oldWinningId, "sec-2", "Old formula erroneously chose sec-2 over sec-1");
});
