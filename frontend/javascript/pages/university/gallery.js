import { heroIcon } from "../../icons.js";
import { t, tFormat } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr } from "../../utils.js";
import { buildApiUrl, safePathSegment, uniThumbnailSrc } from "../_shared.js";
import { coverCreditHtml, loadPhotoCredits } from "./cover-credit.js";
import { bindGalleryZoom } from "./gallery-zoom.js";

function photoPosition(index, total) {
  return tFormat("university.gallery.position", { current: index + 1, total }, `Photo ${index + 1} of ${total}`);
}

function galleryButton(action, icon, label) {
  return `<button type="button" class="d-gallery-button d-gallery-button--${action}" aria-label="${escapeHtmlAttr(label)}"${action === "close" ? " autofocus" : ""}>
    ${heroIcon(icon, "ui-icon ui-icon--20")}
  </button>`;
}

function navigationHtml(label) {
  return `<div class="d-gallery-navigation" hidden>
    <div class="d-gallery-control d-gallery-control--previous">
      ${galleryButton("previous", "chevron-left", t("university.gallery.previous", "Previous photo"))}
    </div>
    <div class="d-gallery-dots" role="group" aria-label="${escapeHtmlAttr(label)}"></div>
    <div class="d-gallery-control d-gallery-control--next">
      ${galleryButton("next", "chevron-right", t("university.gallery.next", "Next photo"))}
    </div>
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
    error.hidden = false;
    onUnavailable?.();
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

  cover.insertAdjacentHTML("beforeend", `<button type="button" class="d-gallery-preview" aria-haspopup="dialog" aria-label="${escapeHtmlAttr(openLabel)}">
    <span class="d-gallery-preview-media"></span>
    <span class="d-gallery-zoom">${heroIcon("magnifying-glass", "ui-icon ui-icon--20")}</span>
  </button>`);
  cover.insertAdjacentHTML("afterend", `${navigationHtml(label)}
    <div class="d-gallery-cover-credit"></div>
    <span class="d-gallery-status sr-only" role="status"></span>
    <dialog class="d-photo-viewer" aria-label="${escapeHtmlAttr(label)}">
      ${galleryButton("close", "x-mark", t("common.close", "Close"))}
      <div class="d-photo-zoom-controls">
        ${galleryButton("zoom-out", "minus", t("university.gallery.zoom_out", "Zoom out"))}
        ${galleryButton("zoom-in", "plus", t("university.gallery.zoom_in", "Zoom in"))}
      </div>
      <div class="d-photo-stage"><div class="d-photo-canvas"></div></div>
      <div class="d-photo-footer">
        ${navigationHtml(label)}
        <div class="d-gallery-viewer-credit"></div>
      </div>
      <span class="sr-only" role="status"></span>
    </dialog>`);

  const preview = cover.querySelector(".d-gallery-preview");
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
  const dots = navigation.map((group) => group.querySelector(".d-gallery-dots"));
  const zoom = bindGalleryZoom({
    canvas,
    dialog,
    zoomIn: dialog.querySelector(".d-gallery-button--zoom-in"),
    zoomOut: dialog.querySelector(".d-gallery-button--zoom-out"),
    onSwipe: step,
  });

  function renderPreview() {
    preview.hidden = false;
    displayPhoto(previewMedia, photos[current], "", {
      onUnavailable: () => {
        if (photos.length === 1 && !photos[0].credit) preview.hidden = true;
      },
    });
  }

  function renderViewer() {
    zoom.setImage(null);
    displayPhoto(canvas, photos[current], photos.length > 1 ? photoPosition(current, photos.length) : label, {
      onLoad: zoom.setImage,
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
    for (const group of dots) {
      group.querySelector("[aria-current]")?.removeAttribute("aria-current");
      group.children[current]?.setAttribute("aria-current", "true");
    }
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
  preview.addEventListener("click", () => {
    if (dialog.open || !preview.isConnected || preview.hidden) return;
    renderViewer();
    preview.focus({ preventScroll: true });
    dialog.showModal();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (!dialog.open) zoom.setImage(null);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
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
      for (const group of dots) {
        for (const [index] of photos.entries()) {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", photoPosition(index, photos.length));
          button.addEventListener("click", () => selectPhoto(index));
          group.append(button);
        }
      }
    }
    updateLabels();
  }).catch((error) => console.warn("gallery_credits_render_failed", error));

  return () => {
    listeners.abort();
    cancelGalleryTap();
    zoom.dispose();
    dialog.close();
    dialog.remove();
    coverNavigation.remove();
    coverCredit.remove();
    coverStatus.remove();
    preview.remove();
  };
}
