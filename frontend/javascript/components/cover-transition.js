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
const UNIVERSITIES_SCROLL_KEY = "unisearch_universities_scroll";
const MIN_VISIBLE_PX = 24;

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

const ACTIVE_TRANSITION_TIMEOUT_MS = 700;

/**
 * Registers an in-flight cover View Transition so async route hydration and photo swaps wait
 * before mutating the live DOM elements participating in the morph.
 * @param {Promise<unknown> | null | undefined} finishedPromise
 */
export function registerActiveCoverTransition(finishedPromise) {
  if (!finishedPromise) return;
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
  return activeCoverTransitionPromise || Promise.resolve();
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

function clearAllCoverTransitionNames() {
  document.querySelectorAll(`.${NAME_CLASS}`).forEach((node) => {
    node.classList.remove(NAME_CLASS);
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

  const bannerEl = document.getElementById("unifitWarningBanner");
  if (bannerEl) {
    bannerEl.hidden = snap.bannerHidden;
    const titleEl = document.getElementById("unifitBannerTitle");
    if (titleEl) titleEl.textContent = snap.bannerTitleText;
    const editEl = document.getElementById("unifitBannerEdit");
    if (editEl) {
      editEl.textContent = snap.bannerEditText;
      if (snap.bannerEditHref) editEl.setAttribute("href", snap.bannerEditHref);
    }
    const legendDetailsEl = document.getElementById("unifitLegendDetails");
    if (legendDetailsEl) {
      legendDetailsEl.hidden = snap.legendDetailsHidden;
      if (legendDetailsEl instanceof HTMLDetailsElement) {
        legendDetailsEl.open = snap.legendDetailsOpen;
      }
    }
    const legendEl = document.getElementById("unifitLegend");
    if (legendEl) {
      legendEl.hidden = snap.legendHidden;
      legendEl.innerHTML = snap.legendHtml;
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
  listClone.querySelectorAll(`.${NAME_CLASS}, .motion-list-item-enter`).forEach((node) => {
    node.classList.remove(NAME_CLASS, "motion-list-item-enter");
    if (node instanceof HTMLElement && node.style.animationDelay) {
      node.style.animationDelay = "";
    }
  });

  const scrollY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
  safeSessionStorage.set(UNIVERSITIES_SCROLL_KEY, String(scrollY));

  const recentEl = document.getElementById("recentlyViewedBar");
  const bannerEl = document.getElementById("unifitWarningBanner");
  const bannerTitleEl = document.getElementById("unifitBannerTitle");
  const bannerEditEl = document.getElementById("unifitBannerEdit");
  const legendDetailsEl = document.getElementById("unifitLegendDetails");
  const legendEl = document.getElementById("unifitLegend");
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
    bannerHidden: Boolean(bannerEl?.hidden ?? true),
    bannerTitleText: bannerTitleEl?.textContent ?? "",
    bannerEditText: bannerEditEl?.textContent ?? "",
    bannerEditHref: bannerEditEl?.getAttribute("href") ?? "",
    legendDetailsHidden: Boolean(legendDetailsEl?.hidden ?? true),
    legendDetailsOpen: Boolean(legendDetailsEl instanceof HTMLDetailsElement && legendDetailsEl.open),
    legendHidden: Boolean(legendEl?.hidden ?? true),
    legendHtml: legendEl?.innerHTML ?? "",
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

  return {
    /** Names the card photo for the outgoing snapshot. */
    markSource() {
      clearAllCoverTransitionNames();
      source.image.classList.add(NAME_CLASS);
    },
    /**
     * Runs inside the transition callback, after the new page DOM is in place. When the detail page
     * cannot mount immediately, the photo lands in the loading skeleton's cover; when mounting
     * directly from cache (`useLoadingCover: false`), it lands straight in `#detailCover`.
     * @param {{ useLoadingCover?: boolean }} [options]
     */
    inject({ useLoadingCover = true } = {}) {
      source.image.classList.remove(NAME_CLASS);
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
      standIn.className = `${HANDOFF_CLASS} ${NAME_CLASS}`;
      standIn.alt = "";
      standIn.decoding = "sync";
      standIn.src = source.src;
      cover.prepend(standIn);
    },
    /**
     * When a cached university mounts directly inside the transition callback, guarantees the live
     * cover keeps the shared transition name (and skips any skeleton fade state).
     */
    ensureMountedTarget() {
      clearLoadingHandoffState();
      document.getElementById("detailCard")?.classList.add("has-cover-handoff");
      if (standIn?.isConnected) {
        standIn.classList.add(NAME_CLASS);
        return;
      }
      clearAllCoverTransitionNames();
      const cover = document.getElementById("detailCover");
      if (!cover || cover.classList.contains("is-photo-missing")) return;
      const preview = cover.querySelector(".d-gallery-preview");
      if (!(preview instanceof HTMLElement) || preview.hidden) return;
      const coverImg = preview.querySelector(".d-gallery-preview-media > img:not([hidden])");
      if (coverImg instanceof HTMLImageElement && coverImg.complete && coverImg.naturalWidth > 0) {
        coverImg.classList.add(NAME_CLASS);
      }
    },
    /** Drops the shared name once the transition is over; the stand-in stays until the photo loads. */
    settle() {
      clearAllCoverTransitionNames();
      clearLoadingHandoffState();
    },
  };
}

/**
 * Returns a reverse handoff from the university page cover back to the catalog card when
 * returning to the same catalog view and both the cover and card image are visible.
 * @param {URL} currentUrl
 * @param {URL} targetUrl
 * @returns {{ markSource: () => void, inject: () => void, settle: () => void, preserveScroll: true } | null}
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

  return {
    preserveScroll: true,
    markSource() {
      clearAllCoverTransitionNames();
      sourceImg.classList.add(NAME_CLASS);
    },
    async inject() {
      sourceImg.classList.remove(NAME_CLASS);
      const listEl = hydrateCatalogFromSnapshot(snap);
      safeSessionStorage.set(UNIVERSITIES_SCROLL_KEY, String(snap.scrollY));
      window.scrollTo({ top: snap.scrollY, left: 0, behavior: "instant" });
      if (!listEl) return;

      const targetCard = Array.from(listEl.querySelectorAll(".uni-card[data-uni-id]"))
        .find((card) => card instanceof HTMLElement && card.dataset.uniId === universityId);
      const targetImg = targetCard?.querySelector("img.uni-media-img");
      if (!(targetImg instanceof HTMLImageElement) || !isVisibleInViewport(targetImg)) return;

      targetImg.loading = "eager";
      targetImg.decoding = "sync";
      targetImg.classList.add(NAME_CLASS);
      if (typeof targetImg.decode === "function") {
        await Promise.race([
          targetImg.decode().catch(() => {}),
          new Promise((resolve) => window.setTimeout(resolve, 80)),
        ]);
      }
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
  const handoffs = cover.querySelectorAll(`.${HANDOFF_CLASS}`);
  let transferName = false;
  handoffs.forEach((node) => {
    if (node.classList.contains(NAME_CLASS)) transferName = true;
    node.remove();
  });
  if (transferName && !cover.classList.contains("is-photo-missing")) {
    const coverImg = cover.querySelector(".d-gallery-preview:not([hidden]) .d-gallery-preview-media > img:not([hidden])");
    if (coverImg instanceof HTMLImageElement && coverImg.complete && coverImg.naturalWidth > 0) {
      coverImg.classList.add(NAME_CLASS);
    }
  }
}
