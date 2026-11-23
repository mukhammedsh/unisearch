const MAX_ZOOM = 4;
const ZOOM_STEP = 1.5;
const ORIGIN = { x: 0, y: 0 };
const FIT = { scale: 1, ...ORIGIN };

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

/**
 * Check whether viewport coordinates fall within the visible rendered photo inside the canvas.
 */
export function isPointInVisiblePhoto(canvas, clientX, clientY) {
  const image = canvas?.querySelector("img:not([hidden])");
  if (!image || !image.naturalWidth || !image.naturalHeight) return false;
  const box = image.getBoundingClientRect();
  const bounds = canvas.getBoundingClientRect();
  if (!box.width || !box.height || !bounds.width || !bounds.height) return false;
  const fitScale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * fitScale;
  const height = image.naturalHeight * fitScale;
  const left = Math.max(box.left + (box.width - width) / 2, bounds.left);
  const top = Math.max(box.top + (box.height - height) / 2, bounds.top);
  const right = Math.min(box.left + (box.width + width) / 2, bounds.right);
  const bottom = Math.min(box.top + (box.height + height) / 2, bounds.bottom);
  return left < right && top < bottom && clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

export function bindGalleryZoom({ canvas, dialog, zoomIn, zoomOut, onSwipe }) {
  const pointers = new Map();
  let image = null;
  let view = FIT;
  let gesture = null;
  let canSwipe = false;

  function updatePhotoHover(point) {
    const over = Boolean(image) && Boolean(point) && isPointInVisiblePhoto(canvas, point.x, point.y);
    canvas.classList.toggle("is-over-photo", over);
  }

  function apply(scale, x, y) {
    if (!image || !canvas.clientWidth || !canvas.clientHeight) return;
    const maxX = Math.max(0, (image.offsetWidth * scale - canvas.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - canvas.clientHeight) / 2);
    view = { scale, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
    image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${scale})`;
    canvas.classList.toggle("is-zoomed", scale > 1);
    zoomIn.setAttribute("aria-disabled", String(scale >= MAX_ZOOM));
    zoomOut.setAttribute("aria-disabled", String(scale <= 1));
  }

  function viewPoint(point) {
    const rect = canvas.getBoundingClientRect();
    return { x: point.x - rect.left - rect.width / 2, y: point.y - rect.top - rect.height / 2 };
  }

  function zoomAt(startView, targetScale, origin, destination = origin) {
    const scale = clamp(targetScale, 1, MAX_ZOOM);
    const ratio = scale / startView.scale;
    apply(scale, destination.x - (origin.x - startView.x) * ratio, destination.y - (origin.y - startView.y) * ratio);
  }

  function pointFor(event) {
    return { x: event.clientX, y: event.clientY };
  }

  function measureGesture() {
    const [first, second] = pointers.values();
    if (!second) return { center: first, distance: 0 };
    return {
      center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      distance: Math.hypot(first.x - second.x, first.y - second.y),
    };
  }

  function setImage(nextImage) {
    image = nextImage;
    view = FIT;
    gesture = null;
    pointers.clear();
    canSwipe = false;
    canvas.classList.toggle("can-zoom", Boolean(image));
    canvas.classList.remove("is-zoomed", "is-over-photo", "is-dragging");
    zoomIn.setAttribute("aria-disabled", String(!image));
    zoomOut.setAttribute("aria-disabled", "true");
  }

  const observer = new ResizeObserver(() => apply(view.scale, view.x, view.y));
  observer.observe(canvas);

  canvas.addEventListener("pointerdown", (event) => {
    if (!image || event.button !== 0 || pointers.size >= 2) return;
    const point = pointFor(event);
    updatePhotoHover(point);
    canSwipe = pointers.size === 0 && event.pointerType === "touch" && view.scale === 1;
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    gesture = { ...measureGesture(), view };
    if (pointers.size === 1 && view.scale > 1) canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = pointFor(event);
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") updatePhotoHover(point);
      return;
    }
    pointers.set(event.pointerId, point);
    const { center, distance } = measureGesture();
    if (pointers.size === 2) {
      canvas.classList.remove("is-dragging");
      const scale = gesture.view.scale * distance / Math.max(1, gesture.distance);
      zoomAt(gesture.view, scale, viewPoint(gesture.center), viewPoint(center));
    } else if (view.scale > 1) {
      apply(view.scale, gesture.view.x + center.x - gesture.center.x, gesture.view.y + center.y - gesture.center.y);
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (!pointers.size) canvas.classList.remove("is-over-photo");
  });

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const swipe = event.type === "pointerup" && canSwipe && pointers.size === 1;
    const start = gesture.center;
    pointers.delete(event.pointerId);
    gesture = pointers.size ? { ...measureGesture(), view } : null;
    canSwipe = false;
    if (!pointers.size) {
      canvas.classList.remove("is-dragging");
      if (event.pointerType === "mouse") updatePhotoHover(pointFor(event));
    }
    if (swipe) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
    }
  }

  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(event, finishPointer);
  }

  canvas.addEventListener("wheel", (event) => {
    if (!image || !event.deltaY) return;
    event.preventDefault();
    const pixels = event.deltaY * ([1, 16, canvas.clientHeight][event.deltaMode] || 1);
    const factor = Math.exp(clamp(-pixels * 0.003, -0.45, 0.45));
    zoomAt(view, view.scale * factor, viewPoint(pointFor(event)));
  }, { passive: false });

  canvas.addEventListener("dblclick", (event) => {
    if (image && isPointInVisiblePhoto(canvas, event.clientX, event.clientY)) {
      zoomAt(view, view.scale > 1 ? 1 : 2.5, viewPoint(pointFor(event)));
    }
  });

  zoomIn.addEventListener("click", () => zoomAt(view, view.scale * ZOOM_STEP, ORIGIN));
  zoomOut.addEventListener("click", () => zoomAt(view, view.scale / ZOOM_STEP, ORIGIN));

  dialog.addEventListener("keydown", (event) => {
    if (!image || event.altKey || event.ctrlKey || event.metaKey || event.target.closest("a")) return;
    if (event.key === "+" || event.key === "=") {
      zoomAt(view, view.scale * ZOOM_STEP, ORIGIN);
    } else if (event.key === "-") {
      zoomAt(view, view.scale / ZOOM_STEP, ORIGIN);
    } else if (event.key === "0") {
      apply(1, 0, 0);
    } else if (event.shiftKey && view.scale > 1 && event.key.startsWith("Arrow")) {
      const dx = event.key === "ArrowLeft" ? 48 : event.key === "ArrowRight" ? -48 : 0;
      const dy = event.key === "ArrowUp" ? 48 : event.key === "ArrowDown" ? -48 : 0;
      apply(view.scale, view.x + dx, view.y + dy);
    } else {
      return;
    }
    event.preventDefault();
  });

  return { setImage, dispose: () => observer.disconnect() };
}
