import { heroIcon } from "../../icons.js";
import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { buildApiUrl, safePathSegment, uniThumbnailSrc } from "../_shared.js";
import { coverCreditHtml, loadPhotoCredits } from "./cover-credit.js";
import { bindGalleryZoom, isPointInVisiblePhoto } from "./gallery-zoom.js";

const DISMISS_MOVE_TOLERANCE_PX = 8;
const VIEWER_DIALOG_ID = "university-photo-viewer";
const NON_DISMISS_SELECTOR = [
  "button",
  "a",
  ".d-cover-credit",
  ".d-gallery-navigation",
  ".d-photo-zoom-controls",
  ".d-gallery-error",
  ".center-loading-spinner",
].join(", ");

function isDismissibleDarkArea(dialog, canvas, clientX, clientY) {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
  const hitTarget = document.elementFromPoint(clientX, clientY);
  if (!(hitTarget instanceof Element) || !dialog.contains(hitTarget)) return false;
  if (hitTarget.closest(NON_DISMISS_SELECTOR)) return false;
  return !isPointInVisiblePhoto(canvas, clientX, clientY);
}

/**
 * Close the full-size viewer on single clicks/taps in the dark area outside the photo and controls.
 * Because the modal dialog fills the viewport, native closedby="any" only sees clicks outside the
 * dialog box; tracking press/release inside the dark backdrop ignores pans, swipes, and pinches.
 */
function bindBackdropDismiss({ dialog, canvas, signal }) {
  let press = null;
  let pendingDismissTimer = null;
  let dismissReady = false;

  function cancelPendingDismiss() {
    clearTimeout(pendingDismissTimer);
    pendingDismissTimer = null;
    dismissReady = false;
  }

  dialog.addEventListener("pointerdown", (event) => {
    cancelPendingDismiss();
    if (!event.isPrimary || event.button !== 0 || !isDismissibleDarkArea(dialog, canvas, event.clientX, event.clientY)) {
      press = null;
      return;
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }, { signal });

  dialog.addEventListener("pointermove", (event) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DISMISS_MOVE_TOLERANCE_PX) {
      press.moved = true;
    }
  }, { signal });

  dialog.addEventListener("pointercancel", (event) => {
    if (press?.id !== event.pointerId) return;
    press = null;
    cancelPendingDismiss();
  }, { signal });

  dialog.addEventListener("pointerup", (event) => {
    if (press?.id !== event.pointerId) return;
    const valid = !press.moved && isDismissibleDarkArea(dialog, canvas, event.clientX, event.clientY);
    press = null;
    if (!valid) return;
    dismissReady = true;
    // Wait for native click first to avoid click-through to the page beneath; fall back if a post-swipe tap omits click.
    pendingDismissTimer = setTimeout(() => {
      pendingDismissTimer = null;
      const shouldClose = dismissReady && dialog.open;
      dismissReady = false;
      if (shouldClose) dialog.close();
    }, 100);
  }, { signal });

  dialog.addEventListener("click", (event) => {
    const shouldClose = dismissReady || (event.detail === 0 && event.target === dialog);
    cancelPendingDismiss();
    if (shouldClose && dialog.open) dialog.close();
  }, { signal });

  dialog.addEventListener("close", () => {
    press = null;
    cancelPendingDismiss();
  }, { signal });

  return cancelPendingDismiss;
}

function photoPosition(index, total) {
  return tFormat("university.gallery.position", { current: index + 1, total }, `Photo ${index + 1} of ${total}`);
}

function galleryButton(action, icon, label) {
  const actionClass = action === "close" ? "d-gallery-button--close" : `d-gallery-button--${action}`;
  const closeCommand = action === "close" ? ` commandfor="${VIEWER_DIALOG_ID}" command="close"` : "";
  return `<button type="button" class="d-gallery-button ${actionClass}" aria-label="${escapeHtmlAttr(label)}"${closeCommand}${action === "close" ? " autofocus" : ""}>
    ${heroIcon(icon, "ui-icon ui-icon--20")}
  </button>`;
}

function navigationHtml() {
  return `<div class="d-gallery-navigation" hidden>
    ${galleryButton("previous", "chevron-left", t("university.gallery.previous", "Previous photo"))}
    ${galleryButton("next", "chevron-right", t("university.gallery.next", "Next photo"))}
    <span class="d-gallery-count" aria-hidden="true"></span>
  </div>`;
}

function displayPhoto(host, photo, alt, { onLoad, onUnavailable, retry } = {}) {
  const image = new Image();
  image.alt = alt;
  image.draggable = false;
  image.hidden = true;
  host.innerHTML = `<span class="center-loading-spinner center-loading-spinner--sm" role="status" aria-label="${escapeHtmlAttr(t("common.loading", "Loading"))}"></span>
    <span class="d-gallery-error" hidden role="status">${escapeHtml(t("university.gallery.unavailable", "Photo unavailable"))}</span>`;
  const [spinner, error] = host.children;
  image.addEventListener("load", () => {
    if (!host.contains(image)) return;
    image.hidden = false;
    spinner.hidden = true;
    onLoad?.(image);
  });
  image.addEventListener("error", () => {
    if (!host.contains(image)) return;
    if (photo.fallback && image.getAttribute("src") !== photo.fallback) {
      image.src = photo.fallback;
      return;
    }
    spinner.hidden = true;
    if (onUnavailable) onUnavailable();
    else error.hidden = false;
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "d-gallery-button d-gallery-retry";
      button.textContent = t("error.retry", "Retry");
      button.addEventListener("click", retry);
      host.append(button);
    }
  });
  host.prepend(image);
  image.src = photo.src;
}

function bindTouchGalleryButtons(gallery, preview, step, signal) {
  let press = null;
  let pendingClick = null;
  let suppressClick = null;

  function cancelPendingClick() {
    clearTimeout(pendingClick?.timer);
    pendingClick = null;
  }

  gallery.addEventListener("pointerdown", (event) => {
    cancelPendingClick();
    suppressClick = event.pointerType === "touch" && !event.isPrimary ? press?.button : null;
    const button = event.target.closest("button");
    press = button && event.pointerType === "touch" && event.isPrimary
      ? { button, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
      : null;
  }, { signal });

  gallery.addEventListener("pointermove", (event) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) {
      press.moved = true;
    }
  }, { signal });

  gallery.addEventListener("pointercancel", (event) => {
    if (press?.id !== event.pointerId) return;
    suppressClick = press.button;
    press = null;
  }, { signal });

  gallery.addEventListener("pointerup", (event) => {
    if (press?.id !== event.pointerId) return;
    const { button, x, y, moved } = press;
    press = null;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (moved || Math.hypot(dx, dy) > 10 || !button.contains(document.elementFromPoint(event.clientX, event.clientY))) {
      suppressClick = button;
      if (button === preview && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      return;
    }

    // Let native clicks take priority. Chromium can omit one after a swipe.
    const timer = setTimeout(() => {
      pendingClick = null;
      if (!button.getClientRects().length || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      suppressClick = button;
      button.click();
    }, 100);
    pendingClick = { button, timer };
  }, { signal });

  gallery.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button && pendingClick?.button === button) cancelPendingClick();
    if (button && suppressClick === button && event.detail) event.stopImmediatePropagation();
  }, { capture: true, signal });

  return cancelPendingClick;
}

export function mountUniversityGallery(cover, universityId) {
  if (!cover) return null;

  const gallery = cover.parentElement;
  const label = t("university.gallery.label", "Campus photos");
  const openLabel = t("university.gallery.open", "Enlarge photo");
  const photos = [{
    src: uniThumbnailSrc(universityId, { forceFull: true }),
    fallback: uniThumbnailSrc(universityId, { forceFull: true, format: "jpg" }),
  }];
  let current = 0;
  const listeners = new AbortController();

  cover.insertAdjacentHTML("beforeend", `<div class="d-cover-placeholder" hidden role="status">
    ${heroIcon("building-office-2", "ui-icon ui-icon--24")}
    <span>${escapeHtml(t("universities.card.photo_unavailable"))}</span>
  </div>
  <button type="button" class="d-gallery-preview" aria-haspopup="dialog" aria-label="${escapeHtmlAttr(openLabel)}">
    <span class="d-gallery-preview-media"></span>
  </button>
    <div class="d-gallery-cover-credit"></div>
    ${navigationHtml()}
    <span class="d-gallery-status sr-only" role="status"></span>`);
  cover.insertAdjacentHTML("afterend", `<dialog id="${VIEWER_DIALOG_ID}" class="d-photo-viewer" closedby="any" aria-label="${escapeHtmlAttr(label)}">
      ${galleryButton("close", "arrow-left", t("common.close", "Close"))}
      <div class="d-gallery-viewer-credit"></div>
      <div class="d-photo-zoom-controls">
        ${galleryButton("zoom-out", "minus", t("university.gallery.zoom_out", "Zoom out"))}
        ${galleryButton("zoom-in", "plus", t("university.gallery.zoom_in", "Zoom in"))}
      </div>
      <div class="d-photo-stage"><div class="d-photo-canvas"></div></div>
      ${navigationHtml()}
      <span class="sr-only" role="status"></span>
    </dialog>`);

  const preview = cover.querySelector(".d-gallery-preview");
  const placeholder = cover.querySelector(".d-cover-placeholder");
  const previewMedia = preview.querySelector(".d-gallery-preview-media");
  const coverCredit = gallery.querySelector(".d-gallery-cover-credit");
  const coverNavigation = gallery.querySelector(".d-gallery-navigation");
  const coverStatus = gallery.querySelector(".d-gallery-status");
  const dialog = gallery.querySelector(".d-photo-viewer");
  const canvas = dialog.querySelector(".d-photo-canvas");
  const close = dialog.querySelector(".d-gallery-button--close");
  const viewerCredit = dialog.querySelector(".d-gallery-viewer-credit");
  const viewerStatus = dialog.querySelector("[role=status]");
  const navigation = [coverNavigation, dialog.querySelector(".d-gallery-navigation")];
  const counters = navigation.map((group) => group.querySelector(".d-gallery-count"));
  const zoom = bindGalleryZoom({
    canvas,
    dialog,
    zoomIn: dialog.querySelector(".d-gallery-button--zoom-in"),
    zoomOut: dialog.querySelector(".d-gallery-button--zoom-out"),
    onSwipe: step,
  });

  function renderPreview() {
    preview.hidden = false;
    placeholder.hidden = true;
    displayPhoto(previewMedia, photos[current], "", {
      onUnavailable: () => {
        placeholder.hidden = false;
        if (photos.length === 1 && !photos[0].credit) preview.hidden = true;
      },
    });
  }

  function renderViewer() {
    zoom.setImage(null);
    dialog.style.removeProperty("--photo-fit-height");
    displayPhoto(canvas, photos[current], photos.length > 1 ? photoPosition(current, photos.length) : label, {
      onLoad: (image) => {
        zoom.setImage(image);
        const heightRatio = image.naturalHeight / image.naturalWidth;
        dialog.style.setProperty("--photo-fit-height",
          `min(${image.naturalHeight}px, calc((100vw - 2 * var(--photo-stage-gutter)) * ${heightRatio}), 100%)`);
      },
      retry: () => {
        close.focus();
        renderViewer();
      },
    });
  }

  function updateLabels() {
    const position = photos.length > 1 ? photoPosition(current, photos.length) : "";
    preview.setAttribute("aria-label", position ? `${openLabel} · ${position}` : openLabel);
    const credit = coverCreditHtml(photos[current].credit);
    coverCredit.innerHTML = credit;
    viewerCredit.innerHTML = credit;
    for (const counter of counters) counter.textContent = `${current + 1} / ${photos.length}`;
  }

  function selectPhoto(index) {
    if (index === current) return;
    current = index;
    renderPreview();
    updateLabels();
    if (dialog.open) renderViewer();
    const status = dialog.open ? viewerStatus : coverStatus;
    status.textContent = photoPosition(current, photos.length);
  }

  function step(direction) {
    if (photos.length === 1) return false;
    selectPhoto((current + direction + photos.length) % photos.length);
    return true;
  }

  for (const area of [gallery, dialog]) {
    area.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest("a")) return;
      const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (direction && step(direction)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { signal: listeners.signal });
  }

  const cancelGalleryTap = bindTouchGalleryButtons(gallery, preview, step, listeners.signal);
  const cancelBackdropDismiss = bindBackdropDismiss({ dialog, canvas, signal: listeners.signal });
  preview.addEventListener("click", () => {
    if (dialog.open || !preview.isConnected || preview.hidden) return;
    renderViewer();
    preview.focus({ preventScroll: true });
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) zoom.setImage(null);
  });

  renderPreview();
  loadPhotoCredits().then((credits) => {
    if (listeners.signal.aborted || !credits) return;
    photos[0].credit = credits.photos?.[universityId];
    for (const [filename, credit] of Object.entries(credits.gallery?.[universityId] || {})) {
      if (!/^[a-z0-9-]+\.jpg$/.test(filename) || !credit?.license) continue;
      const src = buildApiUrl(`universities/assets/gallery/${safePathSegment(universityId)}/${filename}`);
      photos.push({ src, credit });
    }
    if (photos.length > 1) {
      for (const area of navigation) {
        area.hidden = false;
        area.querySelector(".d-gallery-button--previous").addEventListener("click", () => step(-1));
        area.querySelector(".d-gallery-button--next").addEventListener("click", () => step(1));
      }
    }
    updateLabels();
  }).catch((error) => console.warn("gallery_credits_render_failed", error));

  return () => {
    listeners.abort();
    cancelGalleryTap();
    cancelBackdropDismiss();
    zoom.dispose();
    dialog.close();
    dialog.remove();
    coverNavigation.remove();
    coverCredit.remove();
    coverStatus.remove();
    preview.remove();
    placeholder.remove();
  };
}
