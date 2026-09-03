import type { Tool } from "$lib/stores/toolStore.svelte";

export type ScenePoint = { x: number; y: number };

export type PointerCanvas = {
  getScenePoint: (event: Event) => ScenePoint;
};

export function pointerFromEvent(canvas: PointerCanvas, event: Event): ScenePoint {
  const point = canvas.getScenePoint(event);
  return { x: point.x, y: point.y };
}

export function shouldCaptureViewportPointer(tool: Tool): boolean {
  return tool === "pan";
}

export function toolForPointerType(pointerType: string, current: Tool): Tool {
  if (pointerType === "pen" && current !== "text") {
    return "pen";
  }
  return current;
}

export function shouldCommitToolOnPointerDown(_pointerType: string): boolean {
  return true;
}
