// Carries a catalog card photo into the university page cover (and back to the catalog card on
// return) during the router View Transition. The forward stand-in reuses the thumbnail the browser
// already decoded; the reverse handoff restores the last catalog list before the snapshot so the
// return morph only runs when both ends of the photo are visible in the viewport.

import { getPreferredCurrency } from "../currency.js";
import { getCurrentLanguage } from "../i18n.js";
import { readIdListStorage, SAVED_UNIVERSITIES_KEY } from "../pages/shared/cache.js";
import { extractUniversityIdFromLocation, isUniversitiesListPath, isUniversityDetailPath } from "../routes.js";
import { safeSessionStorage } from "../utils/safe-storage.js";

const NAME_CLASS = "vt-uni-cover";
const HANDOFF_CLASS = "d-cover-handoff";
const STAGE_CLASS = "vt-uni-cover-stage";
const CLIP_CLASS = "vt-uni-cover-clip";
const IMG_CLASS = "vt-uni-cover-img";
const HIDDEN_CLASS = "vt-uni-cover-hidden";
const MORPH_TARGET_CLASS = "has-cover-morph";
const UNIVERSITIES_SCROLL_KEY = "unisearch_universities_scroll";
const MIN_VISIBLE_PX = 24;
const DEFAULT_COVER_DURATION_MS = 240;
const DEFAULT_COVER_EASING = "cubic-bezier(0.2, 0, 0, 1)";

/** @type {{ image: HTMLImageElement, src: string, href: string } | null} */
let pendingSource = null;

/**
 * @typedef {{
 *   urlHref: string,
 *   pathSearch: string,
 *   universityId: string,
 *   lang: string,
 *   currency: string,
 *   scrollY: number,
 *   onlySaved: boolean,
 *   listChildren: Element[],
 *   totalText: string,
 *   paginationHtml: string,
 *   listStateHtml: string,
 *   recentHidden: boolean,
 *   recentHtml: string,
 *   bannerHidden: boolean,
 *   bannerTitleText: string,
 *   bannerEditText: string,
 *   bannerEditHref: string,
 *   legendDetailsHidden: boolean,
 *   legendDetailsOpen: boolean,
 *   legendHidden: boolean,
 *   legendHtml: string,
 * }} CatalogReturnSnapshot
 */

/** @type {CatalogReturnSnapshot | null} */
let catalogReturnSnapshot = null;

/** @type {Promise<void> | null} */
let activeCoverTransitionPromise = null;

/** @type {{ stage: HTMLElement, animations: Animation[], play: () => void, dispose: () => void } | null} */
let activeMorph = null;

const ACTIVE_TRANSITION_TIMEOUT_MS = 500;

/**
 * Registers an in-flight cover View Transition so async route hydration and photo swaps wait
 * before mutating the live DOM elements participating in the morph.
 * @param {Promise<unknown> | null | undefined} finishedPromise
 */
export function registerActiveCoverTransition(finishedPromise) {
  if (finishedPromise == null) return;
  let timer = 0;
  const guarded = Promise.race([
    Promise.resolve(finishedPromise).catch(() => {}),
    new Promise((resolve) => {
      timer = window.setTimeout(resolve, ACTIVE_TRANSITION_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timer) window.clearTimeout(timer);
    if (activeCoverTransitionPromise === guarded) {
      activeCoverTransitionPromise = null;
    }
  });
  activeCoverTransitionPromise = guarded;
}

/** @returns {boolean} */
export function isCoverTransitionActive() {
  return Boolean(activeCoverTransitionPromise);
}

/** @returns {Promise<void>} */
export function waitForCoverTransition() {
  return activeCoverTransitionPromise ?? Promise.resolve();
}

/**
 * @param {Element | null} element
 * @returns {boolean}
 */
function isVisibleInViewport(element) {
  if (!(element instanceof Element) || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if (vw <= 0 || vh <= 0) return false;
  const visibleWidth = Math.min(rect.right, vw) - Math.max(rect.left, 0);
  const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
  return visibleWidth >= MIN_VISIBLE_PX && visibleHeight >= MIN_VISIBLE_PX;
}

function parsePositionOffset(token, boxSize, imgSize) {
  const raw = String(token || "").trim().toLowerCase();
  if (!raw || raw === "center") return (boxSize - imgSize) * 0.5;
  if (raw === "left" || raw === "top") return 0;
  if (raw === "right" || raw === "bottom") return boxSize - imgSize;
  if (raw.endsWith("%")) {
    const pct = Number.parseFloat(raw);
    return Number.isFinite(pct) ? (boxSize - imgSize) * (pct / 100) : (boxSize - imgSize) * 0.5;
  }
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : (boxSize - imgSize) * 0.5;
}

/**
 * Computes the rendered image box under `object-fit: cover` and `object-position` in the
 * coordinate space of `rect`.
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} natW
 * @param {number} natH
 * @param {string} [objectPositionCss]
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function computeCoveredImageBox(rect, natW, natH, objectPositionCss = "50% 50%") {
  const scale = Math.max(rect.width / natW, rect.height / natH);
  const width = natW * scale;
  const height = natH * scale;
  const tokens = String(objectPositionCss || "50% 50%").trim().split(/\s+/);
  const offsetX = parsePositionOffset(tokens[0] || "50%", rect.width, width);
  const offsetY = parsePositionOffset(tokens[1] || "50%", rect.height, height);
  return {
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    width,
    height,
  };
}

function readCornerRadii(element) {
  if (!(element instanceof Element)) return "0px 0px 0px 0px";
  const style = getComputedStyle(element);
  return [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ]
    .map((val) => `${Number.parseFloat(val) || 0}px`)
    .join(" ");
}

function readCoverMotionTiming() {
  const rootStyle = getComputedStyle(document.documentElement);
  const rawDuration = rootStyle.getPropertyValue("--motion-medium").trim();
  let duration = DEFAULT_COVER_DURATION_MS;
  if (rawDuration.endsWith("ms")) {
    const parsed = Number.parseFloat(rawDuration);
    if (Number.isFinite(parsed) && parsed > 0) duration = parsed;
  } else if (rawDuration.endsWith("s")) {
    const parsed = Number.parseFloat(rawDuration) * 1000;
    if (Number.isFinite(parsed) && parsed > 0) duration = parsed;
  }
  const easing = rootStyle.getPropertyValue("--motion-ease-standard").trim() || DEFAULT_COVER_EASING;
  return { duration, easing };
}

function captureSnapshotMetrics(img, clipContainer) {
  if (!(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return null;
  }
  const targetBox = clipContainer instanceof Element ? clipContainer : img;
  const rect = targetBox.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    rect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
    natW: img.naturalWidth,
    natH: img.naturalHeight,
    objectPosition: getComputedStyle(img).objectPosition || "50% 50%",
    radius: readCornerRadii(clipContainer || img),
    src: img.currentSrc || img.src,
  };
}

function disposeActiveMorph() {
  if (!activeMorph) return;
  activeMorph.dispose();
  activeMorph = null;
}

function clipInsetValue(rect, cw, ch, radius) {
  return `inset(${rect.top}px ${cw - rect.right}px ${ch - rect.bottom}px ${rect.left}px round ${radius})`;
}

function mountCoverMorph(fromState, toState) {
  disposeActiveMorph();
  if (!fromState || !toState) return null;
  const cw = document.documentElement.clientWidth || window.innerWidth || 0;
  const ch = document.documentElement.clientHeight || window.innerHeight || 0;
  if (cw <= 0 || ch <= 0) return null;

  const fromImgBox = computeCoveredImageBox(fromState.rect, fromState.natW, fromState.natH, fromState.objectPosition);
  const toImgBox = computeCoveredImageBox(toState.rect, fromState.natW, fromState.natH, toState.objectPosition);
  const baseW = Math.max(fromImgBox.width, toImgBox.width);
  const baseH = Math.max(fromImgBox.height, toImgBox.height);
  if (baseW <= 0 || baseH <= 0) return null;

  const fromScale = fromImgBox.width / baseW;
  const toScale = toImgBox.width / baseW;
  const { duration, easing } = readCoverMotionTiming();

  const stage = document.createElement("div");
  stage.className = `${STAGE_CLASS} ${NAME_CLASS}`;
  const clip = document.createElement("div");
  clip.className = CLIP_CLASS;
  const img = document.createElement("img");
  img.className = IMG_CLASS;
  img.alt = "";
  img.decoding = "sync";
  img.src = fromState.src;
  img.style.width = `${baseW}px`;
  img.style.height = `${baseH}px`;

  clip.append(img);
  stage.append(clip);
  document.body.append(stage);

  const clipAnim = clip.animate([
    { clipPath: clipInsetValue(fromState.rect, cw, ch, fromState.radius) },
    { clipPath: clipInsetValue(toState.rect, cw, ch, toState.radius) },
  ], { duration, easing, fill: "both" });
  clipAnim.pause();

  const imgAnim = img.animate([
    { transform: `translate3d(${fromImgBox.left}px, ${fromImgBox.top}px, 0) scale(${fromScale})` },
    { transform: `translate3d(${toImgBox.left}px, ${toImgBox.top}px, 0) scale(${toScale})` },
  ], { duration, easing, fill: "both" });
  imgAnim.pause();

  activeMorph = {
    stage,
    animations: [clipAnim, imgAnim],
    play() {
      clipAnim.play();
      imgAnim.play();
    },
    dispose() {
      clipAnim.cancel();
      imgAnim.cancel();
      stage.remove();
    },
  };
  return activeMorph;
}

function clearAllCoverTransitionNames() {
  disposeActiveMorph();
  document.querySelectorAll(`.${STAGE_CLASS}`).forEach((node) => {
    node.remove();
  });
  document.querySelectorAll(`.${NAME_CLASS}`).forEach((node) => {
    node.classList.remove(NAME_CLASS);
  });
  document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((node) => {
    node.classList.remove(HIDDEN_CLASS);
  });
  document.querySelectorAll(`.${MORPH_TARGET_CLASS}`).forEach((node) => {
    node.classList.remove(MORPH_TARGET_CLASS);
  });
}

function clearLoadingHandoffState() {
  const loading = document.getElementById("detailLoading");
  loading?.classList.remove("has-cover-handoff");
  loading?.querySelector(".d-loading-cover")?.classList.remove("has-cover-handoff");
}

/**
 * Returns the currently visible campus cover image on a university page, or null when missing,
 * switched to map mode, or scrolled outside the viewport.
 * @returns {HTMLImageElement | null}
 */
function findVisibleUniversityCoverImage() {
  const cover = document.getElementById("detailCover");
  if (!cover || cover.classList.contains("is-photo-missing")) return null;
  const preview = cover.querySelector(".d-gallery-preview");
  if (!(preview instanceof HTMLElement) || preview.hidden) return null;
  const img = preview.querySelector(".d-gallery-preview-media > img:not([hidden])")
    || cover.querySelector(`img.${HANDOFF_CLASS}`);
  if (!(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth === 0) return null;
  if ((img.currentSrc || img.src).includes("/gallery/")) return null;
  return isVisibleInViewport(img) ? img : null;
}

/**
 * @param {CatalogReturnSnapshot} snap
 * @returns {HTMLElement | null}
 */
function hydrateCatalogFromSnapshot(snap) {
  const listEl = document.getElementById("universitiesList");
  if (!listEl) return null;

  listEl.replaceChildren(...snap.listChildren);
  listEl.dataset.hydratedFromSnapshot = "1";
  listEl.style.display = "grid";
  listEl.style.visibility = "visible";

  const skeletonEl = document.getElementById("universitiesSkeleton");
  if (skeletonEl) {
    skeletonEl.style.display = "none";
    skeletonEl.setAttribute("aria-hidden", "true");
    skeletonEl.classList.remove("is-fading-out");
  }

  const totalEl = document.getElementById("totalCount");
  if (totalEl) totalEl.textContent = snap.totalText;

  const paginationEl = document.getElementById("pagination");
  if (paginationEl) {
    paginationEl.innerHTML = snap.paginationHtml;
    paginationEl.style.visibility = "visible";
  }

  const listStateEl = document.getElementById("listState");
  if (listStateEl) listStateEl.innerHTML = snap.listStateHtml;

  const recentEl = document.getElementById("recentlyViewedBar");
  if (recentEl) {
    recentEl.hidden = snap.recentHidden;
    if (!snap.recentHidden && snap.recentHtml) {
      recentEl.innerHTML = snap.recentHtml;
    }
  }

  const contextBarEl = document.getElementById("unifitContextBar");
  if (contextBarEl) {
    contextBarEl.hidden = snap.contextBarHidden;
    if (snap.contextBarProfileState) {
      contextBarEl.dataset.profileState = snap.contextBarProfileState;
    } else {
      delete contextBarEl.dataset.profileState;
    }
    const titleEl = document.getElementById("unifitBannerTitle");
    if (titleEl) titleEl.textContent = snap.bannerTitleText;
    const tooltipProfileEl = document.getElementById("unifitTooltipProfile");
    if (tooltipProfileEl) {
      tooltipProfileEl.hidden = snap.tooltipProfileHidden;
      tooltipProfileEl.textContent = snap.tooltipProfileText;
    }
    const editEl = document.getElementById("unifitBannerEdit");
    if (editEl) {
      editEl.textContent = snap.bannerEditText;
      if (snap.bannerEditHref) editEl.setAttribute("href", snap.bannerEditHref);
    }
  }

  return listEl;
}

/**
 * Remembers the photo of the catalog card a navigation link belongs to.
 * @param {HTMLAnchorElement | null} link
 */
export function rememberCoverSource(link) {
  pendingSource = null;
  const image = link?.closest(".uni-card")?.querySelector("img.uni-media-img");
  if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth === 0) return;
  pendingSource = { image, src: image.currentSrc || image.src, href: link.href };
}

/**
 * Captures the active catalog list view before navigating into a university page so returning
 * can restore the grid and morph the cover photo back into its card.
 * @param {URL} currentUrl
 * @param {URL} targetUrl
 */
export function captureCatalogReturnSnapshot(currentUrl, targetUrl) {
  catalogReturnSnapshot = null;
  if (!(currentUrl instanceof URL) || !(targetUrl instanceof URL)) return;
  if (!isUniversitiesListPath(currentUrl.pathname) || !isUniversityDetailPath(targetUrl.pathname)) return;
  const universityId = extractUniversityIdFromLocation(targetUrl);
  if (!universityId) return;

  const listEl = document.getElementById("universitiesList");
  const mapBtn = document.getElementById("viewMapBtn");
  if (!listEl || listEl.style.display === "none" || listEl.style.visibility === "hidden") return;
  if (mapBtn?.classList.contains("active")) return;
  if (!listEl.querySelector(".uni-card:not(.is-skeleton)")) return;

  const listClone = /** @type {HTMLElement} */ (listEl.cloneNode(true));
  listClone.querySelectorAll(`.${NAME_CLASS}, .${HIDDEN_CLASS}, .${MORPH_TARGET_CLASS}, .motion-list-item-enter`).forEach((node) => {
    node.classList.remove(NAME_CLASS, HIDDEN_CLASS, MORPH_TARGET_CLASS, "motion-list-item-enter");
    if (node instanceof HTMLElement && node.style.animationDelay) {
      node.style.animationDelay = "";
    }
  });

  const scrollY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
  safeSessionStorage.set(UNIVERSITIES_SCROLL_KEY, String(scrollY));

  const recentEl = document.getElementById("recentlyViewedBar");
  const contextBarEl = document.getElementById("unifitContextBar");
  const bannerTitleEl = document.getElementById("unifitBannerTitle");
  const tooltipProfileEl = document.getElementById("unifitTooltipProfile");
  const bannerEditEl = document.getElementById("unifitBannerEdit");
  const favBtn = document.querySelector('[data-saved-filter="favorites"]');

  catalogReturnSnapshot = {
    urlHref: currentUrl.href,
    pathSearch: `${currentUrl.pathname}${currentUrl.search}`,
    universityId,
    lang: getCurrentLanguage(),
    currency: getPreferredCurrency(),
    scrollY,
    onlySaved: Boolean(favBtn?.classList.contains("is-active")),
    listChildren: Array.from(listClone.children),
    totalText: document.getElementById("totalCount")?.textContent ?? "",
    paginationHtml: document.getElementById("pagination")?.innerHTML ?? "",
    listStateHtml: document.getElementById("listState")?.innerHTML ?? "",
    recentHidden: Boolean(recentEl?.hidden ?? true),
    recentHtml: recentEl?.innerHTML ?? "",
    contextBarHidden: Boolean(contextBarEl?.hidden ?? true),
    contextBarProfileState: contextBarEl?.dataset.profileState ?? "",
    bannerTitleText: bannerTitleEl?.textContent ?? "",
    tooltipProfileHidden: Boolean(tooltipProfileEl?.hidden ?? true),
    tooltipProfileText: tooltipProfileEl?.textContent ?? "",
    bannerEditText: bannerEditEl?.textContent ?? "",
    bannerEditHref: bannerEditEl?.getAttribute("href") ?? "",
  };
}

/**
 * Returns the exact catalog URL (including search/filter/page params) for `#detailBackBtn`
 * when the current university page was opened from the catalog during this session.
 * @param {string} currentHref
 * @returns {string | null}
 */
export function getCatalogReturnHref(currentHref) {
  const snap = catalogReturnSnapshot;
  if (!snap) return null;
  if (snap.lang !== getCurrentLanguage() || snap.currency !== getPreferredCurrency()) return null;
  try {
    const currentUrl = new URL(currentHref, window.location.href);
    if (!isUniversityDetailPath(currentUrl.pathname)) return null;
    if (extractUniversityIdFromLocation(currentUrl) !== snap.universityId) return null;
    return snap.urlHref;
  } catch {
    return null;
  }
}

/** Clears any stored catalog return snapshot so it cannot apply to a later unrelated route. */
export function clearCatalogReturnSnapshot() {
  catalogReturnSnapshot = null;
}

/**
 * Returns the forward handoff for this navigation when it starts from a remembered card photo,
 * and forgets the source either way.
 * @param {URL} url
 * @returns {{ markSource: () => void, inject: () => void, ensureMountedTarget: () => void, settle: () => void } | null}
 */
export function takeCoverHandoff(url) {
  const source = pendingSource;
  pendingSource = null;
  if (!source || source.href !== url.href || !source.image.isConnected) return null;
  /** @type {HTMLImageElement | null} */
  let standIn = null;
  /** @type {ReturnType<typeof captureSnapshotMetrics>} */
  let fromState = null;

  function buildCoverTargetState(cover, objectPosition) {
    const rect = cover.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      objectPosition: objectPosition || "50% 50%",
      radius: readCornerRadii(cover),
    };
  }

  return {
    /** Captures source geometry and hides the card thumbnail before the outgoing snapshot. */
    markSource() {
      clearAllCoverTransitionNames();
      fromState = captureSnapshotMetrics(source.image, source.image.closest(".uni-media"));
      if (fromState) {
        source.image.classList.add(HIDDEN_CLASS);
      }
    },
    /**
     * Runs inside the transition callback, after the new page DOM is in place. When the detail page
     * cannot mount immediately, the photo lands in the loading skeleton's cover; when mounting
     * directly from cache (`useLoadingCover: false`), it lands straight in `#detailCover`.
     * @param {{ useLoadingCover?: boolean }} [options]
     */
    inject({ useLoadingCover = true } = {}) {
      const loading = document.getElementById("detailLoading");
      const cover = useLoadingCover
        ? loading?.querySelector(".d-loading-cover")
        : document.getElementById("detailCover");
      if (!cover) return;
      if (useLoadingCover && loading) {
        loading.classList.add("is-visible", "has-cover-handoff");
        cover.classList.add("has-cover-handoff");
      } else if (!useLoadingCover) {
        document.getElementById("detailCard")?.classList.add("has-cover-handoff");
      }
      standIn = document.createElement("img");
      standIn.className = HANDOFF_CLASS;
      standIn.alt = "";
      standIn.decoding = "sync";
      standIn.src = source.src;
      cover.prepend(standIn);

      if (useLoadingCover && fromState) {
        cover.classList.add(MORPH_TARGET_CLASS);
        const toState = buildCoverTargetState(cover, getComputedStyle(standIn).objectPosition);
        mountCoverMorph(fromState, toState);
      }
    },
    /**
     * When a cached university mounts directly inside the transition callback, mounts the live
     * morph into `#detailCover` (or clears the handoff when the cover photo is unavailable).
     */
    ensureMountedTarget() {
      clearLoadingHandoffState();
      document.getElementById("detailCard")?.classList.add("has-cover-handoff");
      const cover = document.getElementById("detailCover");
      if (!cover || cover.classList.contains("is-photo-missing")) {
        clearAllCoverTransitionNames();
        return;
      }
      const preview = cover.querySelector(".d-gallery-preview");
      if (!(preview instanceof HTMLElement) || preview.hidden) {
        clearAllCoverTransitionNames();
        return;
      }
      cover.classList.add(MORPH_TARGET_CLASS);
      const coverImg = preview.querySelector(".d-gallery-preview-media > img:not([hidden])");
      const targetPos = coverImg instanceof HTMLImageElement
        ? getComputedStyle(coverImg).objectPosition
        : standIn?.isConnected
          ? getComputedStyle(standIn).objectPosition
          : "50% 50%";
      if (fromState) {
        const toState = buildCoverTargetState(cover, targetPos);
        mountCoverMorph(fromState, toState);
      }
    },
    /** Plays the paused WAAPI morph once `transition.ready` exposes the View Transition pseudo-tree. */
    startOnReady(readyPromise) {
      void Promise.resolve(readyPromise).then(() => activeMorph?.play(), () => {});
    },
    /** Cleans up morph stage and reveals the real cover once the View Transition finishes. */
    settle() {
      clearAllCoverTransitionNames();
      clearLoadingHandoffState();
      document.getElementById("detailCard")?.classList.remove("has-cover-handoff");
    },
  };
}

/**
 * Returns a reverse handoff from the university page cover back to the catalog card when
 * returning to the same catalog view and both the cover and card image are visible.
 * @param {URL} currentUrl
 * @param {URL} targetUrl
 * @returns {{ markSource: () => void, inject: () => Promise<void>, startOnReady: (readyPromise: Promise<void>) => void, settle: () => void, preserveScroll: true } | null}
 */
export function takeReverseCoverHandoff(currentUrl, targetUrl) {
  const snap = catalogReturnSnapshot;
  catalogReturnSnapshot = null;
  if (!snap || !(currentUrl instanceof URL) || !(targetUrl instanceof URL)) return null;
  if (document.body.dataset.page !== "university" || !isUniversitiesListPath(targetUrl.pathname)) return null;
  if (snap.lang !== getCurrentLanguage() || snap.currency !== getPreferredCurrency()) return null;
  if (snap.pathSearch !== `${targetUrl.pathname}${targetUrl.search}`) return null;

  const universityId = extractUniversityIdFromLocation(currentUrl);
  if (!universityId) return null;
  if (snap.onlySaved && !readIdListStorage(SAVED_UNIVERSITIES_KEY).includes(universityId)) return null;

  const sourceImg = findVisibleUniversityCoverImage();
  if (!sourceImg) return null;
  /** @type {ReturnType<typeof captureSnapshotMetrics>} */
  let fromState = null;

  return {
    preserveScroll: true,
    markSource() {
      clearAllCoverTransitionNames();
      fromState = captureSnapshotMetrics(sourceImg, document.getElementById("detailCover"));
      if (fromState) {
        sourceImg.classList.add(HIDDEN_CLASS);
      }
    },
    async inject() {
      const listEl = hydrateCatalogFromSnapshot(snap);
      safeSessionStorage.set(UNIVERSITIES_SCROLL_KEY, String(snap.scrollY));
      window.scrollTo({ top: snap.scrollY, left: 0, behavior: "instant" });
      if (!listEl || !fromState) return;

      const targetCard = Array.from(listEl.querySelectorAll(".uni-card[data-uni-id]"))
        .find((card) => card instanceof HTMLElement && card.dataset.uniId === universityId);
      const targetImg = targetCard?.querySelector("img.uni-media-img");
      if (!(targetImg instanceof HTMLImageElement) || !isVisibleInViewport(targetImg)) return;

      targetImg.loading = "eager";
      targetImg.decoding = "sync";
      if (typeof targetImg.decode === "function") {
        await Promise.race([
          targetImg.decode().catch(() => {}),
          new Promise((resolve) => window.setTimeout(resolve, 80)),
        ]);
      }
      targetImg.classList.add(HIDDEN_CLASS);

      const targetMedia = targetImg.closest(".uni-media") || targetImg;
      const targetRect = targetMedia.getBoundingClientRect();
      if (targetRect.width <= 0 || targetRect.height <= 0) {
        targetImg.classList.remove(HIDDEN_CLASS);
        return;
      }
      const toState = {
        rect: {
          left: targetRect.left,
          top: targetRect.top,
          right: targetRect.right,
          bottom: targetRect.bottom,
          width: targetRect.width,
          height: targetRect.height,
        },
        objectPosition: getComputedStyle(targetImg).objectPosition || "50% 60%",
        radius: readCornerRadii(targetMedia),
      };
      mountCoverMorph(fromState, toState);
    },
    startOnReady(readyPromise) {
      void Promise.resolve(readyPromise).then(() => activeMorph?.play(), () => {});
    },
    settle() {
      clearAllCoverTransitionNames();
    },
  };
}

/**
 * Moves a stand-in photo from the loading skeleton into the mounted cover, under the gallery content.
 * @param {HTMLElement | null} cover
 */
export function adoptCoverHandoff(cover) {
  const standIn = document.querySelector(`.${HANDOFF_CLASS}`);
  if (!cover || !standIn || cover.contains(standIn)) return;
  const previousHost = standIn.closest(`.${MORPH_TARGET_CLASS}`);
  if (previousHost && previousHost !== cover) {
    previousHost.classList.remove(MORPH_TARGET_CLASS);
    cover.classList.add(MORPH_TARGET_CLASS);
  }
  standIn.closest(".has-cover-handoff")?.classList.remove("has-cover-handoff");
  cover.prepend(standIn);
}

/**
 * Removes the stand-in photo (the real cover photo has loaded or is unavailable).
 * @param {HTMLElement | null} cover
 */
export function removeCoverHandoff(cover) {
  if (!cover) return;
  if (isCoverTransitionActive()) {
    void waitForCoverTransition().then(() => removeCoverHandoff(cover));
    return;
  }
  cover.querySelectorAll(`.${HANDOFF_CLASS}`).forEach((node) => {
    node.remove();
  });
}
