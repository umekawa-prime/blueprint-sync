export const MIN_SHAPE_DRAG = 6;

export const SHAPE_ROLE = "shape";

export type ScenePoint = { x: number; y: number };

export type ShapeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function shapeBox(start: ScenePoint, end: ScenePoint): ShapeBox | null {
  if (dragLength(start, end) < MIN_SHAPE_DRAG) {
    return null;
  }
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function arrowPoints(start: ScenePoint, end: ScenePoint): [ScenePoint, ScenePoint] | null {
  if (dragLength(start, end) < MIN_SHAPE_DRAG) {
    return null;
  }
  return [start, end];
}

function dragLength(start: ScenePoint, end: ScenePoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}
