const MAX_ZOOM = 4;
const ZOOM_STEP = 1.5;
const ORIGIN = { x: 0, y: 0 };
const FIT = { scale: 1, ...ORIGIN };

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function bindGalleryZoom({ canvas, dialog, zoomIn, zoomOut, onSwipe }) {
  const pointers = new Map();
  let image = null;
  let view = FIT;
  let gesture = null;
  let canSwipe = false;

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
    canvas.classList.remove("is-zoomed");
    zoomIn.setAttribute("aria-disabled", String(!image));
    zoomOut.setAttribute("aria-disabled", "true");
  }

  const observer = new ResizeObserver(() => apply(view.scale, view.x, view.y));
  observer.observe(canvas);

  canvas.addEventListener("pointerdown", (event) => {
    if (!image || event.button !== 0 || pointers.size >= 2) return;
    canSwipe = pointers.size === 0 && event.pointerType === "touch" && view.scale === 1;
    pointers.set(event.pointerId, pointFor(event));
    canvas.setPointerCapture(event.pointerId);
    gesture = { ...measureGesture(), view };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, pointFor(event));
    const { center, distance } = measureGesture();
    if (pointers.size === 2) {
      const scale = gesture.view.scale * distance / Math.max(1, gesture.distance);
      zoomAt(gesture.view, scale, viewPoint(gesture.center), viewPoint(center));
    } else if (view.scale > 1) {
      apply(view.scale, gesture.view.x + center.x - gesture.center.x, gesture.view.y + center.y - gesture.center.y);
    }
  });

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const swipe = event.type === "pointerup" && canSwipe && pointers.size === 1;
    const start = gesture.center;
    pointers.delete(event.pointerId);
    gesture = pointers.size ? { ...measureGesture(), view } : null;
    canSwipe = false;
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
    if (image) zoomAt(view, view.scale > 1 ? 1 : 2.5, viewPoint(pointFor(event)));
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
