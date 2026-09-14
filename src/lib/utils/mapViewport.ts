import { ZOOM_MAX, ZOOM_MIN } from "./viewerMenu";

export type MapCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type WheelGesture = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
};

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(zoom.toFixed(3))));
}

export function panBy(camera: MapCamera, dx: number, dy: number): MapCamera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

export function zoomAroundPoint(
  camera: MapCamera,
  viewportX: number,
  viewportY: number,
  nextZoom: number,
): MapCamera {
  const zoom = clampZoom(nextZoom);
  if (camera.zoom === 0) {
    return { ...camera, zoom };
  }
  const factor = zoom / camera.zoom;
  return {
    x: viewportX - (viewportX - camera.x) * factor,
    y: viewportY - (viewportY - camera.y) * factor,
    zoom,
  };
}

export function cameraCssTransform(camera: MapCamera, renderedZoom: number): string {
  const scale = renderedZoom === 0 ? 1 : camera.zoom / renderedZoom;
  return `translate(${camera.x}px, ${camera.y}px) scale(${scale})`;
}

export function wheelIntent(event: WheelGesture): "zoom" | "pan" {
  if (event.ctrlKey || event.metaKey) {
    return "zoom";
  }
  if (event.deltaMode !== 0) {
    return "zoom";
  }
  if (Math.abs(event.deltaX) < 0.5 && Math.abs(event.deltaY) >= 40) {
    return "zoom";
  }
  return "pan";
}

export function shouldHandleWheelAsViewport(
  event: WheelGesture,
  overViewport: boolean,
): boolean {
  return overViewport || event.ctrlKey || event.metaKey;
}

export function zoomAfterWheel(current: number, deltaY: number): number {
  // Precision-touchpad pinch is ctrl+wheel with |deltaY| of about 1–10.
  // Mouse notches are ~100–120. Keep mouse gain, boost the tiny pinch ticks.
  const sensitivity = Math.abs(deltaY) < 40 ? 0.02 : 0.0025;
  return clampZoom(current * Math.exp(-deltaY * sensitivity));
}

export function applyWheel(
  camera: MapCamera,
  event: WheelGesture,
  origin: { x: number; y: number },
): MapCamera {
  if (wheelIntent(event) === "zoom") {
    return zoomAroundPoint(camera, origin.x, origin.y, zoomAfterWheel(camera.zoom, event.deltaY));
  }
  return panBy(camera, -event.deltaX, -event.deltaY);
}

export function pinchCamera(
  start: { zoom: number; x: number; y: number; cx: number; cy: number },
  current: { cx: number; cy: number; scale: number },
): MapCamera {
  const zoomed = zoomAroundPoint(
    { x: start.x, y: start.y, zoom: start.zoom },
    start.cx,
    start.cy,
    start.zoom * current.scale,
  );
  return panBy(zoomed, current.cx - start.cx, current.cy - start.cy);
}

export function centerInViewport(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  renderedZoom: number,
): MapCamera {
  const scale = renderedZoom === 0 ? 1 : zoom / renderedZoom;
  return {
    x: (viewportWidth - contentWidth * scale) / 2,
    y: (viewportHeight - contentHeight * scale) / 2,
    zoom,
  };
}

export function clampCamera(
  camera: MapCamera,
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  renderedZoom: number,
  margin = 80,
): MapCamera {
  const scale = renderedZoom === 0 ? 1 : camera.zoom / renderedZoom;
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    ...camera,
    x: Math.min(viewportWidth - margin, Math.max(margin - width, camera.x)),
    y: Math.min(viewportHeight - margin, Math.max(margin - height, camera.y)),
  };
}

export function shouldPanWithPointer(
  tool: string,
  button: number,
  pointerType = "mouse",
): boolean {
  if (button === 1) {
    return true;
  }
  if (button !== 0) {
    return false;
  }
  if (tool === "pan") {
    return true;
  }
  return tool === "select" && pointerType === "touch";
}

export function scaleSerializedObject(
  object: Record<string, unknown>,
  factor: number,
): Record<string, unknown> {
  const next = { ...object };
  for (const key of ["left", "top", "scaleX", "scaleY"] as const) {
    const value = next[key];
    if (typeof value === "number") {
      next[key] = value * factor;
    }
  }
  return next;
}

export function scaleSerializedObjects(
  objects: Record<string, Record<string, unknown>>,
  factor: number,
): Record<string, Record<string, unknown>> {
  const next: Record<string, Record<string, unknown>> = {};
  for (const [id, object] of Object.entries(objects)) {
    next[id] = scaleSerializedObject(object, factor);
  }
  return next;
}
