import { Circle, Group, Polyline, Rect, type FabricObject } from "fabric";
import { SHAPE_ROLE } from "./shapeDraw";
import { stampPrimitives, stampSize, type StampKind, type StampPrimitive } from "./stampDraw";

export type StampStyle = {
  color: string;
  width: number;
};

export function createStampObject(
  kind: StampKind,
  center: { x: number; y: number },
  pageWidth: number,
  style: StampStyle,
): FabricObject {
  const size = stampSize(pageWidth);
  const parts = stampPrimitives(kind, { x: 0, y: 0 }, size).map((primitive) =>
    fabricFromPrimitive(primitive, style),
  );
  const object = new Group(parts, {
    left: center.x,
    top: center.y,
    originX: "center",
    originY: "center",
    subTargetCheck: false,
    objectCaching: false,
  });
  Object.assign(object, { annotationRole: SHAPE_ROLE });
  return object;
}

function fabricFromPrimitive(primitive: StampPrimitive, style: StampStyle): FabricObject {
  if (primitive.kind === "circle") {
    return new Circle({
      left: primitive.x,
      top: primitive.y,
      radius: primitive.r,
      originX: "center",
      originY: "center",
      fill: primitive.fill ? style.color : "transparent",
      stroke: primitive.fill ? undefined : style.color,
      strokeWidth: primitive.fill ? 0 : style.width,
      strokeUniform: true,
      objectCaching: false,
    });
  }
  if (primitive.kind === "rect") {
    return new Rect({
      left: primitive.left,
      top: primitive.top,
      width: primitive.width,
      height: primitive.height,
      originX: "left",
      originY: "top",
      fill: "transparent",
      stroke: style.color,
      strokeWidth: style.width,
      strokeUniform: true,
      objectCaching: false,
    });
  }
  return new Polyline(
    [
      { x: primitive.x1, y: primitive.y1 },
      { x: primitive.x2, y: primitive.y2 },
    ],
    {
      fill: "",
      stroke: style.color,
      strokeWidth: style.width,
      strokeLineCap: "round",
      objectCaching: false,
    },
  );
}
