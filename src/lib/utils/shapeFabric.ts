import { Ellipse, Rect, type FabricObject } from "fabric";
import { createStraightStrokeObject } from "./penStrokeFabric";
import { arrowPoints, SHAPE_ROLE, shapeBox, type ScenePoint } from "./shapeDraw";

export type ShapeKind = "rect" | "ellipse" | "arrow";

export type ShapeStyle = {
  color: string;
  width: number;
};

export function createShapeObject(
  kind: ShapeKind,
  start: ScenePoint,
  end: ScenePoint,
  style: ShapeStyle,
): FabricObject | null {
  if (kind === "arrow") {
    const points = arrowPoints(start, end);
    if (!points) {
      return null;
    }
    const object = createStraightStrokeObject(points, {
      color: style.color,
      width: style.width,
      startCap: "none",
      endCap: "arrow",
    });
    markShape(object);
    return object;
  }

  const box = shapeBox(start, end);
  if (!box) {
    return null;
  }
  if (kind === "rect") {
    const object = new Rect({
      left: box.left,
      top: box.top,
      width: Math.max(box.width, 1),
      height: Math.max(box.height, 1),
      originX: "left",
      originY: "top",
      fill: "transparent",
      stroke: style.color,
      strokeWidth: style.width,
      strokeUniform: true,
      objectCaching: false,
    });
    markShape(object);
    return object;
  }

  const object = new Ellipse({
    left: box.left + box.width / 2,
    top: box.top + box.height / 2,
    rx: Math.max(box.width / 2, 0.5),
    ry: Math.max(box.height / 2, 0.5),
    originX: "center",
    originY: "center",
    fill: "transparent",
    stroke: style.color,
    strokeWidth: style.width,
    strokeUniform: true,
    objectCaching: false,
  });
  markShape(object);
  return object;
}

function markShape(object: FabricObject) {
  Object.assign(object, { annotationRole: SHAPE_ROLE });
}
