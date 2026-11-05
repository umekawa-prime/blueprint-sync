// Keeps the browser from zooming the whole page so toolbars and buttons stay
// the same size. Drawings zoom inside PdfViewer with their own camera instead.

type ZoomKeyEvent = Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "key" | "code">;

const ZOOM_KEYS = new Set(["+", "=", "-", "_", "0", ";", "^"]);
const ZOOM_CODES = new Set(["NumpadAdd", "NumpadSubtract", "Numpad0"]);

export function isPageZoomKey(event: ZoomKeyEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return false;
  }
  return ZOOM_KEYS.has(event.key) || ZOOM_CODES.has(event.code);
}

export function isPageZoomWheel(event: Pick<WheelEvent, "ctrlKey" | "metaKey">): boolean {
  return event.ctrlKey || event.metaKey;
}

/** Blocks keyboard, ctrl+wheel / touchpad pinch, and touchscreen pinch page zoom. */
export function installPageZoomGuard(target: Window = window): () => void {
  const root = target.document.documentElement;
  const previousTouchAction = root.style.touchAction;
  // Scrolling stays native; only the page-level pinch-zoom is removed.
  root.style.touchAction = "pan-x pan-y";

  const onKeyDown = (event: KeyboardEvent) => {
    if (isPageZoomKey(event)) {
      event.preventDefault();
    }
  };
  const onWheel = (event: WheelEvent) => {
    if (isPageZoomWheel(event)) {
      event.preventDefault();
    }
  };
  // iOS Safari ignores user-scalable=no and fires its own gesture events.
  const onGesture = (event: Event) => {
    event.preventDefault();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("wheel", onWheel, { passive: false });
  target.addEventListener("gesturestart", onGesture, { passive: false });
  target.addEventListener("gesturechange", onGesture, { passive: false });

  return () => {
    root.style.touchAction = previousTouchAction;
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("wheel", onWheel);
    target.removeEventListener("gesturestart", onGesture);
    target.removeEventListener("gesturechange", onGesture);
  };
}
