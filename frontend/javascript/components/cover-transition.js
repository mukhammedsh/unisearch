// Carries a catalog card photo into the university page cover during the router View Transition
// (stage 3 of docs/superpowers/specs/2026-11-25-motion-system-design.md). The stand-in reuses the
// thumbnail the browser already decoded, so navigation never waits for it; the gallery removes it
// once the full photo has loaded.

const NAME_CLASS = "vt-uni-cover";
const HANDOFF_CLASS = "d-cover-handoff";

/** @type {{ image: HTMLImageElement, src: string, href: string } | null} */
let pendingSource = null;

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
 * Returns the handoff for this navigation when it starts from a remembered card photo, and forgets
 * the source either way.
 * @param {URL} url
 * @returns {{ markSource: () => void, inject: () => void, settle: () => void } | null}
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
      source.image.classList.add(NAME_CLASS);
    },
    /**
     * Runs inside the transition callback, after the new page DOM is in place. The detail card stays
     * hidden until its data arrives, so the photo lands in the loading skeleton's cover, which has the
     * same box; the gallery adopts it into the real cover when the page mounts.
     */
    inject() {
      source.image.classList.remove(NAME_CLASS);
      const loading = document.getElementById("detailLoading");
      const cover = loading?.querySelector(".d-loading-cover");
      if (!cover) return;
      loading.classList.add("is-visible");
      cover.classList.add("has-cover-handoff");
      standIn = document.createElement("img");
      standIn.className = `${HANDOFF_CLASS} ${NAME_CLASS}`;
      standIn.alt = "";
      standIn.decoding = "sync";
      standIn.src = source.src;
      cover.prepend(standIn);
    },
    /** Drops the shared name once the transition is over; the stand-in stays until the photo loads. */
    settle() {
      source.image.classList.remove(NAME_CLASS);
      standIn?.classList.remove(NAME_CLASS);
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
  cover?.querySelectorAll(`.${HANDOFF_CLASS}`).forEach((node) => node.remove());
}
