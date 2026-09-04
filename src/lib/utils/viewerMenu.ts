export const LONG_PRESS_MS = 500;
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.1;

export function shouldOpenViewerMenu(event: {
  type: string;
  button: number;
  pointerType?: string;
}): boolean {
  return event.type === "contextmenu" || event.button === 2;
}

export function shouldStartLongPress(event: {
  pointerType: string;
  button: number;
}): boolean {
  return event.button === 0 && event.pointerType === "touch";
}

export function menuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, viewportWidth - menuWidth)),
    y: Math.min(Math.max(0, y), Math.max(0, viewportHeight - menuHeight)),
  };
}

export function zoomStep(current: number, direction: 1 | -1): number {
  const next = Number((current + direction * ZOOM_STEP).toFixed(2));
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
}

export function viewerMenuSize(itemCount: number): { width: number; height: number } {
  return {
    width: 180,
    height: 8 + itemCount * 40,
  };
}
