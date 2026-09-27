import type { Tool } from "$lib/stores/toolStore.svelte";
import { isShapeTool, isStampTool } from "$lib/utils/drawingTools";

export type ScenePoint = { x: number; y: number };

export type PointerCanvas = {
  getScenePoint: (event: PointerEvent) => ScenePoint;
};

export function pointerFromEvent(canvas: PointerCanvas, event: PointerEvent): ScenePoint {
  const point = canvas.getScenePoint(event);
  return { x: point.x, y: point.y };
}

export function shouldCaptureViewportPointer(tool: Tool, button = 0): boolean {
  return tool === "pan" || button === 1;
}

export function toolForPointerType(pointerType: string, current: Tool): Tool {
  if (pointerType === "eraser" && (current === "pen" || current === "eraser")) {
    return "eraser";
  }
  if (
    pointerType === "pen" &&
    current !== "text" &&
    !isShapeTool(current) &&
    !isStampTool(current)
  ) {
    return "pen";
  }
  return current;
}

export function shouldCommitToolOnPointerDown(_pointerType: string): boolean {
  return true;
}
