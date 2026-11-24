#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const DEFAULT_VIEWPORTS = {
  390: { width: 390, height: 844 },
  768: { width: 768, height: 1024 },
  1280: { width: 1280, height: 800 },
  1440: { width: 1440, height: 900 },
};

const ALL_PAGES = [
  "catalog",
  "catalog-map",
  "university-mit",
  "university-nu",
  "university-imperial",
  "university-legacy",
  "compare",
  "compare-empty",
  "profile",
  "guide",
  "about",
  "error-404",
];

const DEFAULT_THEMES = ["light", "dark"];
const DEFAULT_LANGS = ["eng", "rus", "kaz"];
const TOUR_SEEN_KEY = "unisearch_universities_tour_seen_v1";
const THEME_KEY = "unisearch_theme";
const LANG_KEY = "unisearch_ui_language_v1";
const COMPARE_KEY = "unisearch_compare_university_ids_v1";
const PROFILE_KEY = "unisearch_profile";

const AUDIT_PROFILE = {
  name: "Aruzhan Dev",
  budget: 26000,
  gpa: 3.84,
  gpaScale: 4,
  major: "Computer Science",
  interests: "computer science, artificial intelligence, robotics",
  studyMode: "On-campus",
  fundingType: "any",
  exams: [
    { exam: "SAT", score: 1450 },
    { exam: "NUET", score: 150 },
  ],
  languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 7.5 }],
};

function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

function parseArgs(argv) {
  const opts = {
    baseUrl: "",
    pages: [...ALL_PAGES],
    viewports: [1440, 1280, 768, 390],
    themes: [...DEFAULT_THEMES],
    langs: [...DEFAULT_LANGS],
    screenshotsDir: "",
    allScreenshots: false,
    jsonPath: "",
    strict: false,
    backendPort: Number(process.env.UNISEARCH_AUDIT_BACKEND_PORT) || 8012,
    frontendPort: Number(process.env.UNISEARCH_AUDIT_FRONTEND_PORT) || 5512,
    concurrency: Number(process.env.UNISEARCH_AUDIT_CONCURRENCY) || 4,
  };

  for (const arg of argv) {
    if (arg === "--strict") opts.strict = true;
    else if (arg === "--all-screenshots") opts.allScreenshots = true;
    else if (arg.startsWith("--base-url=")) opts.baseUrl = trimTrailingSlashes(arg.slice("--base-url=".length).trim());
    else if (arg.startsWith("--pages=")) opts.pages = arg.slice("--pages=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--viewports=")) opts.viewports = arg.slice("--viewports=".length).split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    else if (arg.startsWith("--themes=")) opts.themes = arg.slice("--themes=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--langs=")) opts.langs = arg.slice("--langs=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--screenshots=")) opts.screenshotsDir = arg.slice("--screenshots=".length).trim();
    else if (arg.startsWith("--json=")) opts.jsonPath = arg.slice("--json=".length).trim();
    else if (arg.startsWith("--concurrency=")) {
      const n = Number(arg.slice("--concurrency=".length).trim());
      if (Number.isFinite(n) && n >= 1) opts.concurrency = Math.min(n, 6);
    }
  }
  return opts;
}

function resolvePythonBin() {
  const candidates = process.platform === "win32"
    ? [path.join(rootDir, "backend", ".venv", "Scripts", "python.exe"), "python"]
    : [path.join(rootDir, "backend", ".venv", "bin", "python"), "python3", "python"];
  for (const candidate of candidates) {
    if (candidate === "python" || candidate === "python3" || fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python";
}

async function waitForHttpOk(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "unknown"}`);
}

function spawnQuietProcess(cmd, args, cwd, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let tail = "";
  const appendTail = (chunk) => {
    tail = (tail + chunk.toString("utf8")).slice(-3000);
  };
  child.stdout?.on("data", appendTail);
  child.stderr?.on("data", appendTail);
  return { child, getTail: () => tail };
}

async function killProcessTree(proc) {
  if (!proc || proc.killed || proc.exitCode !== null) return;
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot || process.env.WINDIR || "";
    const taskkillBin = systemRoot ? path.join(systemRoot, "System32", "taskkill.exe") : "";
    if (!taskkillBin || !fs.existsSync(taskkillBin)) {
      proc.kill();
      return;
    }
    await new Promise((resolve) => {
      const killer = spawn(taskkillBin, ["/pid", String(proc.pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
  } else {
    proc.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (proc.exitCode === null) proc.kill("SIGKILL");
  }
}

function pageSpec(pageKey) {
  switch (pageKey) {
    case "catalog":
      return { url: "/index.html", kind: "catalog", tabs: false };
    case "catalog-map":
      return { url: "/index.html", kind: "catalog-map", tabs: false };
    case "university-mit":
      return { url: "/university.html?id=mit-usa-cambridge", kind: "university", tabs: true };
    case "university-nu":
      return { url: "/university.html?id=nazarbayev-university-kaz-astana", kind: "university", tabs: true };
    case "university-imperial":
      return { url: "/university.html?id=imperial-college-london-uk", kind: "university", tabs: true };
    case "university-legacy":
      return { url: "/university.html?id=harvard-usa-cambridge", kind: "university", tabs: true };
    case "compare":
      return { url: "/compare.html?ids=mit-usa-cambridge,stanford-university-usa-ca", kind: "compare", tabs: false };
    case "compare-empty":
      return { url: "/compare.html", kind: "compare-empty", tabs: false };
    case "profile":
      return { url: "/profile.html", kind: "profile", tabs: false };
    case "guide":
      return { url: "/guide.html", kind: "guide", tabs: false };
    case "about":
      return { url: "/about.html", kind: "about", tabs: false };
    case "error-404":
      return { url: "/404.html", kind: "error-404", tabs: false };
    default:
      throw new Error(`Unknown page key: ${pageKey}`);
  }
}

function shouldCaptureScreenshot(opts, pageKey, vpWidth, theme, lang, tabSuffix = "") {
  if (!opts.screenshotsDir) return false;
  if (opts.allScreenshots) return true;
  if (vpWidth !== 1440 && vpWidth !== 390) return false;
  if (tabSuffix && tabSuffix !== "-admission" && tabSuffix !== "-finance") return false;
  if (lang === "rus") {
    return true;
  }
  if (theme === "light" && (pageKey === "catalog" || pageKey === "university-mit" || pageKey === "university-nu")) {
    return true;
  }
  return false;
}

async function waitForPageReady(page, spec) {
  await page.waitForSelector("#siteInitialLoader", { state: "hidden", timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.fonts || document.fonts.status === "loaded" || document.fonts.size >= 0, { timeout: 5000 }).catch(() => {});

  if (spec.kind === "catalog" || spec.kind === "catalog-map") {
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)", { state: "visible", timeout: 20000 });
    if (spec.kind === "catalog-map") {
      const mapBtn = page.locator("#viewMapBtn");
      await mapBtn.waitFor({ state: "visible", timeout: 10000 });
      await page.waitForFunction(() => {
        const el = document.querySelector("#viewMapBtn");
        return el && !el.disabled;
      }, { timeout: 15000 });
      await mapBtn.click();
      await page.waitForSelector(".u-map-stage", { state: "visible", timeout: 15000 });
      await page.waitForFunction(() => {
        const stage = document.querySelector(".u-map-stage");
        return stage && !stage.classList.contains("is-loading");
      }, { timeout: 20000 });
      await page.waitForTimeout(300);
    }
  } else if (spec.kind === "university") {
    await page.waitForSelector("#detailCard", { state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const name = document.querySelector("#detailName")?.textContent?.trim() || "";
      const loading = document.querySelector("#detailLoading");
      const loadingVisible = loading && getComputedStyle(loading).display !== "none" && loading.classList.contains("is-visible");
      return name.length > 0 && name !== "University Name" && !loadingVisible;
    }, { timeout: 20000 });
    await page.waitForTimeout(180);
  } else if (spec.kind === "compare") {
    await page.waitForSelector("#compareResultsPane", { state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const pane = document.querySelector("#compareResultsPane");
      return pane && pane.querySelectorAll(".compare-reviewed__head, .compare-uni-card, .compare-config-column, .compare-results-empty, .error-screen").length > 0;
    }, { timeout: 20000 });
    await page.waitForTimeout(180);
  } else if (spec.kind === "compare-empty") {
    await page.waitForSelector(".compare-results-empty", { state: "visible", timeout: 15000 });
    await page.waitForTimeout(150);
  } else if (spec.kind === "profile") {
    await page.waitForSelector("#profileModal", { state: "visible", timeout: 15000 });
    await page.waitForTimeout(180);
  } else if (spec.kind === "guide") {
    await page.waitForSelector("#guidePage", { state: "visible", timeout: 15000 });
    await page.waitForTimeout(180);
  } else if (spec.kind === "about" || spec.kind === "error-404") {
    await page.waitForSelector("main", { state: "visible", timeout: 15000 });
    await page.waitForTimeout(120);
  }
}

async function runGeometryAudit(page, stepLabel, viewportWidth) {
  return page.evaluate(({ label, vpWidth }) => {
    const findings = [];
    const pushFinding = (severity, rule, message, selector = "") => {
      findings.push({ severity, rule, step: label, selector, message });
    };

    const describeEl = (el) => {
      if (!el || !el.tagName) return "unknown";
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string"
        ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join("")
        : "";
      return `${tag}${id}${cls}`;
    };

    const clippedVisibleRect = (el) => {
      if (!el || !el.isConnected) return null;
      if (el.closest("[hidden], .sr-only, [aria-hidden='true'], .u-tooltip, .ui-tooltip-bubble, .profile-tooltip, .d-tooltip, .uni-status-tooltip__content, .custom-options:not(.open)")) {
        return null;
      }
      const closedDetails = el.closest("details:not([open])");
      if (closedDetails && !el.closest("summary")) return null;
      if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        return null;
      }
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0.5 || r.height <= 0.5) return null;
      let left = r.left;
      let top = r.top;
      let right = r.right;
      let bottom = r.bottom;
      let cur = el.parentElement;
      while (cur && cur !== document.documentElement) {
        const pcs = getComputedStyle(cur);
        if (pcs.display === "none" || pcs.visibility === "hidden" || Number(pcs.opacity) === 0) return null;
        const clipsX = pcs.overflowX === "hidden" || pcs.overflowX === "clip" || pcs.overflowX === "auto" || pcs.overflowX === "scroll";
        const clipsY = pcs.overflowY === "hidden" || pcs.overflowY === "clip" || pcs.overflowY === "auto" || pcs.overflowY === "scroll";
        if (clipsX || clipsY) {
          const pr = cur.getBoundingClientRect();
          if (clipsX) {
            left = Math.max(left, pr.left);
            right = Math.min(right, pr.right);
          }
          if (clipsY) {
            top = Math.max(top, pr.top);
            bottom = Math.min(bottom, pr.bottom);
          }
          if (right - left <= 1 || bottom - top <= 1) return null;
        }
        cur = cur.parentElement;
      }
      return { left, top, right, bottom, width: right - left, height: bottom - top, raw: r };
    };

    const isTrulyVisible = (el) => Boolean(clippedVisibleRect(el));

    const isInsideHorizontalScroller = (el) => {
      let cur = el.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const ox = getComputedStyle(cur).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        cur = cur.parentElement;
      }
      return false;
    };

    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;

    // 1. Horizontal overflow
    if (scrollWidth > clientWidth + 1) {
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(".leaflet-pane, .leaflet-control-container") || isInsideHorizontalScroller(el)) continue;
        if (!isTrulyVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1.5 || rect.left < -1.5) {
          offenders.push(`${describeEl(el)}[${Math.round(rect.left)}..${Math.round(rect.right)}]`);
          if (offenders.length >= 6) break;
        }
      }
      pushFinding(
        "error",
        "overflow-x",
        `Horizontal overflow: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}${offenders.length ? ` (${offenders.join(", ")})` : ""}`,
        offenders[0] || "html"
      );
    }

    // 2. Overlap detection among interactive controls
    const isInteractiveExcluded = (el) => Boolean(
      el.closest(".leaflet-container, .dual-slider-container, .ui-input-composite, .custom-select-wrapper, .u-tooltip, .ui-tooltip-bubble, .uni-status-tooltip__content")
      || el.classList.contains("uni-card-link-overlay")
      || el.classList.contains("d-gallery-preview")
      || el.classList.contains("skip-link")
    );
    const stickyOrFixedLayer = (el) => {
      const host = el.closest(".navbar, .profile-action-bar, .compare-tray, dialog");
      if (!host) return false;
      const pos = getComputedStyle(host).position;
      return pos === "fixed" || pos === "sticky";
    };
    const interactiveEls = [...document.querySelectorAll("button, a[href], input, select, summary, [role='tab']")]
      .filter((el) => !isInteractiveExcluded(el))
      .map((el) => ({ el, rect: clippedVisibleRect(el) }))
      .filter((item) => Boolean(item.rect));

    let overlapCount = 0;
    for (let i = 0; i < interactiveEls.length && overlapCount < 12; i++) {
      const a = interactiveEls[i];
      for (let j = i + 1; j < interactiveEls.length; j++) {
        const b = interactiveEls[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (stickyOrFixedLayer(a.el) !== stickyOrFixedLayer(b.el)) continue;
        const ix = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const iy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (ix > 3 && iy > 3) {
          overlapCount++;
          pushFinding(
            "error",
            "overlap",
            `Interactive elements overlap by ${Math.round(ix)}x${Math.round(iy)}px: ${describeEl(a.el)} vs ${describeEl(b.el)}`,
            describeEl(a.el)
          );
          break;
        }
      }
    }

    // 3. Clipped text inside headings, buttons, tabs, badges, labels
    const clipCandidates = document.querySelectorAll("h1, h2, h3, h4, button, a[href], [role='tab'], .uni-title, .uni-pill, .d-tab-btn, .u-label, .profile-field-label, .badge");
    let clipCount = 0;
    for (const el of clipCandidates) {
      if (clipCount >= 12) break;
      if (!isTrulyVisible(el) || el.classList.contains("uni-card-link-overlay")) continue;
      if (el.closest(".leaflet-container")) continue;
      const cs = getComputedStyle(el);
      const clipsX = cs.overflowX === "hidden" || cs.overflowX === "clip";
      const clipsY = cs.overflowY === "hidden" || cs.overflowY === "clip";
      const allowsEllipsis = cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap";
      if (clipsX && !allowsEllipsis && el.scrollWidth > el.clientWidth + 3) {
        clipCount++;
        pushFinding(
          "error",
          "text-clip",
          `Horizontal text clipping (${el.scrollWidth}px > ${el.clientWidth}px) in ${describeEl(el)}: "${(el.textContent || "").trim().slice(0, 48)}"`,
          describeEl(el)
        );
      } else if (clipsY && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0) {
        clipCount++;
        pushFinding(
          "error",
          "text-clip",
          `Vertical text clipping (${el.scrollHeight}px > ${el.clientHeight}px) in ${describeEl(el)}: "${(el.textContent || "").trim().slice(0, 48)}"`,
          describeEl(el)
        );
      }
    }

    // 4. Touch target sizes on mobile/tablet (<= 768px)
    if (vpWidth <= 768) {
      let touchCount = 0;
      for (const { el, rect } of interactiveEls) {
        if (touchCount >= 15) break;
        if (el.tagName === "A" && el.closest("p, li, dd, td, th, footer, .admissions-reading__source, .admissions-reading__source-list, .admissions-programs__source-list, .guide-doc, .legal-section")) {
          continue;
        }
        if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio" || el.type === "range")) continue;
        const rawRect = rect.raw || rect;
        const minDim = Math.min(rawRect.width, rawRect.height);
        if (minDim < 36) {
          touchCount++;
          pushFinding(
            "error",
            "touch-target",
            `Control too small for touch (${Math.round(rawRect.width)}x${Math.round(rawRect.height)}px < 36px): ${describeEl(el)}`,
            describeEl(el)
          );
        } else if (minDim < 44) {
          touchCount++;
          pushFinding(
            "warning",
            "touch-target",
            `Control below 44px mobile target (${Math.round(rawRect.width)}x${Math.round(rawRect.height)}px): ${describeEl(el)}`,
            describeEl(el)
          );
        }
      }
    }

    // 5. Spacing-stack (gap + same-axis margin) & Zero-gap touching controls
    const JOINED_GROUPS = ".view-toggles, .u-saved-filter, .ui-input-composite, .custom-options, .d-tabs, .admissions-reading__table, .compare-table, nav ul, .footer-meta, .d-gallery-navigation, .navbar-left";
    let zeroGapCount = 0;
    let stackCount = 0;
    for (const parent of document.querySelectorAll("main *, header *")) {
      if (zeroGapCount >= 12 && stackCount >= 12) break;
      if (!isTrulyVisible(parent) || parent.matches(JOINED_GROUPS) || parent.closest(JOINED_GROUPS)) continue;
      const cs = getComputedStyle(parent);
      if (!cs.display.includes("flex") && !cs.display.includes("grid")) continue;
      const rowGap = Number.parseFloat(cs.rowGap) || 0;
      const colGap = Number.parseFloat(cs.columnGap) || 0;
      const children = [...parent.children].filter((c) => isTrulyVisible(c) && !c.classList.contains("uni-card-link-overlay") && c.tagName !== "BR");
      if (children.length < 2) continue;

      const isRow = cs.display.includes("flex") && !cs.flexDirection.startsWith("column");
      const gapAxis = isRow ? colGap : rowGap;
      if (gapAxis > 0 && stackCount < 12) {
        const pRect = parent.getBoundingClientRect();
        const pBottom = pRect.bottom - (Number.parseFloat(cs.paddingBottom) || 0);
        const pRight = pRect.right - (Number.parseFloat(cs.paddingRight) || 0);
        for (let idx = 0; idx < children.length; idx++) {
          const ch = children[idx];
          const chCs = getComputedStyle(ch);
          const chRect = ch.getBoundingClientRect();
          if (isRow) {
            const mr = Number.parseFloat(chCs.marginRight) || 0;
            const ml = Number.parseFloat(chCs.marginLeft) || 0;
            const autoRightPush = idx === children.length - 1 && Math.abs(chRect.right - pRight) < 2 && ml > 1;
            if (!autoRightPush && ((idx < children.length - 1 && mr > 1 && mr <= 40) || (idx > 0 && ml > 1 && ml <= 40))) {
              stackCount++;
              pushFinding("warning", "spacing-stack", `Stacked horizontal margin (${ml}/${mr}px) + gap (${gapAxis}px) inside ${describeEl(parent)} on ${describeEl(ch)}`, describeEl(parent));
              break;
            }
          } else {
            const mt = Number.parseFloat(chCs.marginTop) || 0;
            const mb = Number.parseFloat(chCs.marginBottom) || 0;
            const autoBottomPush = idx === children.length - 1 && Math.abs(chRect.bottom - pBottom) < 2 && mt > 1;
            if (!autoBottomPush && ((idx > 0 && mt > 1 && mt <= 40) || (idx < children.length - 1 && mb > 1 && mb <= 40))) {
              stackCount++;
              pushFinding("warning", "spacing-stack", `Stacked vertical margin (${mt}/${mb}px) + gap (${gapAxis}px) inside ${describeEl(parent)} on ${describeEl(ch)}`, describeEl(parent));
              break;
            }
          }
        }
      }

      if (zeroGapCount < 12) {
        for (let i = 0; i < children.length - 1; i++) {
          const c1 = children[i];
          const c2 = children[i + 1];
          const r1 = c1.getBoundingClientRect();
          const r2 = c2.getBoundingClientRect();
          const bothControls = c1.matches("button, .uni-card, .u-field, input, select, .d-site-link, .uni-status-tooltip")
            && c2.matches("button, .uni-card, .u-field, input, select, .d-site-link, .uni-status-tooltip");
          if (!bothControls) continue;
          const sameRow = Math.abs(r1.top - r2.top) < Math.min(r1.height, r2.height) * 0.7;
          const sameCol = Math.abs(r1.left - r2.left) < Math.min(r1.width, r2.width) * 0.7;
          if (sameRow && r2.left >= r1.right - 0.5 && (r2.left - r1.right) < 1.5) {
            zeroGapCount++;
            pushFinding("warning", "zero-gap", `Zero horizontal gap between ${describeEl(c1)} and ${describeEl(c2)} inside ${describeEl(parent)}`, describeEl(parent));
          } else if (sameCol && r2.top >= r1.bottom - 0.5 && (r2.top - r1.bottom) < 1.5) {
            zeroGapCount++;
            pushFinding("warning", "zero-gap", `Zero vertical gap between ${describeEl(c1)} and ${describeEl(c2)} inside ${describeEl(parent)}`, describeEl(parent));
          }
        }
      }
    }

    return findings;
  }, { label: stepLabel, vpWidth: viewportWidth });
}

async function runAxeAudit(page, stepLabel) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".leaflet-container")
    .analyze();
  const findings = [];
  for (const v of results.violations || []) {
    const severity = (v.impact === "critical" || v.impact === "serious") ? "error" : "warning";
    const sampleTarget = v.nodes?.[0]?.target?.join(" ") || "";
    findings.push({
      severity,
      rule: `axe:${v.id}`,
      step: stepLabel,
      selector: sampleTarget,
      message: `[${v.impact}] ${v.help} (${v.nodes?.length || 0} nodes, e.g. ${sampleTarget})`,
    });
  }
  return findings;
}

async function auditPageCombo({ browser, baseUrl, opts, pageKey, theme, lang }) {
  const spec = pageSpec(pageKey);
  const firstVpWidth = opts.viewports[0] || 1440;
  const firstVp = DEFAULT_VIEWPORTS[firstVpWidth] || { width: firstVpWidth, height: 900 };
  const findings = [];

  const context = await browser.newContext({
    viewport: firstVp,
    reducedMotion: "reduce",
    locale: lang === "rus" ? "ru-RU" : (lang === "kaz" ? "kk-KZ" : "en-US"),
    timezoneId: "UTC",
  });
  await context.addInitScript(({ tourKey, themeKey, langKey, compareKey, profileKey, themeVal, langVal, profileVal, seedCompare }) => {
    localStorage.setItem(tourKey, "1");
    localStorage.setItem(themeKey, themeVal);
    localStorage.setItem(langKey, langVal);
    localStorage.setItem(profileKey, JSON.stringify(profileVal));
    if (seedCompare) {
      localStorage.setItem(compareKey, JSON.stringify(["mit-usa-cambridge", "stanford-university-usa-ca"]));
    } else {
      localStorage.removeItem(compareKey);
    }
  }, {
    tourKey: TOUR_SEEN_KEY,
    themeKey: THEME_KEY,
    langKey: LANG_KEY,
    compareKey: COMPARE_KEY,
    profileKey: PROFILE_KEY,
    themeVal: theme,
    langVal: lang,
    profileVal: AUDIT_PROFILE,
    seedCompare: spec.kind === "compare",
  });

  const page = await context.newPage();
  const baseLabel = `${pageKey}:${theme}:${lang}`;
  page.on("pageerror", (err) => {
    findings.push({ severity: "error", rule: "console-error", step: baseLabel, selector: "window", message: `Uncaught pageerror: ${err.message}` });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (spec.kind === "error-404" && text.includes("404")) return;
      findings.push({ severity: "error", rule: "console-error", step: baseLabel, selector: "console", message: `console.error: ${text}` });
    }
  });

  try {
    await page.goto(`${baseUrl}${spec.url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageReady(page, spec);

    for (const vpWidth of opts.viewports) {
      const vp = DEFAULT_VIEWPORTS[vpWidth] || { width: vpWidth, height: 844 };
      await page.setViewportSize(vp);
      if (spec.kind === "catalog-map") {
        await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      }
      await page.waitForTimeout(90);

      const label = `${pageKey}@${vp.width}:${theme}:${lang}`;
      const shotFile = (suffix = "") => path.join(opts.screenshotsDir, `${pageKey}${suffix}__${vp.width}__${theme}__${lang}.png`);

      if (spec.tabs) {
        const generalBtn = page.locator("#tab-btn-general");
        if ((await generalBtn.count()) > 0) {
          await generalBtn.click();
          await page.waitForTimeout(80);
        }
      }

      findings.push(...await runGeometryAudit(page, label, vp.width));
      const runAxeHere = vp.width === 1440 || vp.width === 390 || opts.viewports.length === 1;
      if (runAxeHere) {
        findings.push(...await runAxeAudit(page, label));
      }
      if (shouldCaptureScreenshot(opts, pageKey, vp.width, theme, lang, "")) {
        await page.screenshot({ path: shotFile(), fullPage: true });
      }

      if (spec.tabs) {
        const tabButtons = ["#tab-btn-programs", "#tab-btn-admission", "#tab-btn-deadlines", "#tab-btn-finance"];
        for (const tabSelector of tabButtons) {
          const btn = page.locator(tabSelector);
          if ((await btn.count()) === 0) continue;
          await btn.click();
          await page.waitForTimeout(100);
          const tabName = tabSelector.replace("#tab-btn-", "");
          const tabLabel = `${label}:${tabName}`;
          findings.push(...await runGeometryAudit(page, tabLabel, vp.width));
          if (runAxeHere) {
            findings.push(...await runAxeAudit(page, tabLabel));
          }
          if (shouldCaptureScreenshot(opts, pageKey, vp.width, theme, lang, `-${tabName}`)) {
            await page.screenshot({ path: shotFile(`-${tabName}`), fullPage: true });
          }
        }
      }
    }
  } finally {
    await context.close();
  }
  return findings;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.screenshotsDir) {
    fs.mkdirSync(opts.screenshotsDir, { recursive: true });
  }
  if (opts.jsonPath) {
    fs.mkdirSync(path.dirname(opts.jsonPath), { recursive: true });
  }

  let baseUrl = opts.baseUrl;
  let backendProc = null;
  let frontendProc = null;

  try {
    if (!baseUrl) {
      const pythonBin = resolvePythonBin();
      const origin = `http://127.0.0.1:${opts.frontendPort}`;
      const backend = spawnQuietProcess(
        pythonBin,
        ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(opts.backendPort)],
        path.join(rootDir, "backend"),
        {
          FRONTEND_ORIGINS: origin,
          AUTO_WARMUP_ON_STARTUP: "0",
          ML_INTEREST_TRANSLATION_ENABLED: "0",
          ML_SEMANTIC_EMBEDDINGS_ENABLED: "0",
          RATE_LIMIT_ENABLED: "0",
          REDIS_URL: "",
        }
      );
      backendProc = backend.child;
      await waitForHttpOk(`http://127.0.0.1:${opts.backendPort}/health`).catch((err) => {
        throw new Error(`${err.message}\nBackend output:\n${backend.getTail()}`);
      });

      const frontend = spawnQuietProcess(
        pythonBin,
        [
          "scripts/frontend_dev_server.py",
          "--host", "127.0.0.1",
          "--port", String(opts.frontendPort),
          "--directory", "frontend",
          "--api-port", String(opts.backendPort),
        ],
        rootDir
      );
      frontendProc = frontend.child;
      baseUrl = origin;
      await waitForHttpOk(`${baseUrl}/index.html`).catch((err) => {
        throw new Error(`${err.message}\nFrontend output:\n${frontend.getTail()}`);
      });
    }

    const jobs = [];
    for (const pageKey of opts.pages) {
      for (const theme of opts.themes) {
        for (const lang of opts.langs) {
          jobs.push({ pageKey, theme, lang });
        }
      }
    }

    const browser = await chromium.launch({ headless: true });
    const allFindings = [];
    let cursor = 0;
    let done = 0;

    try {
      const worker = async () => {
        while (cursor < jobs.length) {
          const job = jobs[cursor++];
          const jobFindings = await auditPageCombo({ browser, baseUrl, opts, ...job });
          allFindings.push(...jobFindings);
          done++;
          if (done % 6 === 0 || done === jobs.length) {
            console.log(`[audit:layout] ${done}/${jobs.length} (${job.pageKey}:${job.theme}:${job.lang})`);
          }
        }
      };
      const workerCount = Math.min(opts.concurrency, jobs.length || 1);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    } finally {
      await browser.close();
    }

    const summary = {
      totalPageLoads: jobs.length,
      totalViewportChecks: jobs.length * opts.viewports.length,
      errors: allFindings.filter((f) => f.severity === "error").length,
      warnings: allFindings.filter((f) => f.severity === "warning").length,
      byRule: {},
    };
    for (const f of allFindings) {
      summary.byRule[f.rule] = (summary.byRule[f.rule] || 0) + 1;
    }

    if (opts.jsonPath) {
      fs.writeFileSync(opts.jsonPath, JSON.stringify({ summary, findings: allFindings }, null, 2) + "\n", "utf8");
    }

    console.log(`[audit:layout] pageLoads=${summary.totalPageLoads} viewportChecks=${summary.totalViewportChecks} errors=${summary.errors} warnings=${summary.warnings}`);
    for (const [rule, count] of Object.entries(summary.byRule).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${rule}: ${count}`);
    }
    const sampleErrors = allFindings.filter((f) => f.severity === "error").slice(0, 25);
    if (sampleErrors.length) {
      console.log("\n[audit:layout] Sample errors:");
      for (const f of sampleErrors) {
        console.log(`  [${f.step}] ${f.rule}: ${f.message}`);
      }
    }

    if (summary.errors > 0 && opts.strict) {
      process.exitCode = 1;
    } else if (summary.errors > 0 && !opts.jsonPath) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.all([killProcessTree(frontendProc), killProcessTree(backendProc)]);
  }
}

main().catch((err) => {
  console.error(`[audit:layout] Fatal error: ${err.stack || err.message}`);
  process.exit(1);
});
