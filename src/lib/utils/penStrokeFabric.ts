import { Circle, Group, Polygon, Polyline, type FabricObject } from "fabric";
import {
  applyObjectTransform,
  strokeCaps,
  pointsFromPathCommands,
  type CapPrimitive,
  type CapShape,
  type StrokePoint,
} from "./strokeCaps";

export type PenStrokeStyle = {
  color: string;
  width: number;
  startCap: CapShape;
  endCap: CapShape;
};

export function createStraightStrokeObject(
  points: StrokePoint[],
  style: PenStrokeStyle,
): FabricObject {
  const line = new Polyline(points, {
    fill: "",
    stroke: style.color,
    strokeWidth: style.width,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    objectCaching: false,
  });
  const offset = line.pathOffset ?? { x: 0, y: 0 };
  const canvasPoints = applyObjectTransform(points, offset, line.calcTransformMatrix());
  return withCaps(line, canvasPoints, style);
}

export function decorateDrawnPath(path: FabricObject, style: PenStrokeStyle): FabricObject {
  const commands = (path as FabricObject & { path?: unknown }).path;
  const offset = (path as FabricObject & { pathOffset?: StrokePoint }).pathOffset ?? {
    x: 0,
    y: 0,
  };
  const points = applyObjectTransform(
    pointsFromPathCommands(commands),
    offset,
    path.calcTransformMatrix(),
  );
  return withCaps(path, points, style);
}

function withCaps(base: FabricObject, points: StrokePoint[], style: PenStrokeStyle): FabricObject {
  const caps = strokeCaps({
    points,
    startCap: style.startCap,
    endCap: style.endCap,
    color: style.color,
    width: style.width,
  });
  if (caps.length === 0) {
    return base;
  }
  return new Group([base, ...caps.map(fabricFromCap)], {
    subTargetCheck: false,
    objectCaching: false,
  });
}

function fabricFromCap(cap: CapPrimitive): FabricObject {
  if (cap.kind === "dot") {
    return new Circle({
      left: cap.x,
      top: cap.y,
      radius: cap.radius,
      fill: cap.fill,
      originX: "center",
      originY: "center",
      strokeWidth: 0,
    });
  }
  return new Polygon(cap.points, {
    fill: cap.fill,
    strokeWidth: 0,
    objectCaching: false,
  });
}
