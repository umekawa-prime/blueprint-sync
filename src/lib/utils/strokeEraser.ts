import { Circle, Group, Polygon, Polyline, type FabricObject } from "fabric";
import { applyObjectTransform, pointsFromPathCommands, type StrokePoint } from "./strokeCaps";
import { SHAPE_ROLE } from "./shapeDraw";
import { indexOfErasableHit, type HitGeometry, type ScenePoint } from "./strokeHit";

type RoleObject = FabricObject & { annotationRole?: unknown };

export function findErasableStroke(
  objects: FabricObject[],
  point: ScenePoint,
): FabricObject | null {
  const index = indexOfErasableHit(
    objects.map((object) => ({
      erasable: isErasableObject(object),
      geometry: geometryForErase(object),
    })),
    point,
  );
  return index === null ? null : objects[index];
}

function isErasableObject(object: FabricObject): boolean {
  return roleOf(object) === SHAPE_ROLE || isPenStroke(object);
}

export function isPenStroke(object: FabricObject): boolean {
  const type = object.type?.toLowerCase();
  return type === "path" || type === "polyline" || type === "group";
}

function geometryForErase(object: FabricObject): HitGeometry {
  if (roleOf(object) === SHAPE_ROLE) {
    return shapeBounds(object);
  }
  return geometryOf(object);
}

function shapeBounds(object: FabricObject): HitGeometry {
  object.setCoords();
  return {
    kind: "polygon",
    points: object.getCoords().map((point) => ({ x: point.x, y: point.y })),
  };
}

function geometryOf(object: FabricObject): HitGeometry {
  const type = object.type?.toLowerCase();
  if (type === "path" || type === "polyline") {
    return {
      kind: "stroke",
      points: centerline(object),
      strokeWidth: object.strokeWidth ?? 1,
    };
  }
  if (type === "circle") {
    const circle = object as Circle;
    const center = circle.getCenterPoint();
    const scale = Math.max(Math.abs(circle.scaleX ?? 1), Math.abs(circle.scaleY ?? 1));
    return {
      kind: "disk",
      center: { x: center.x, y: center.y },
      radius: (circle.radius ?? 0) * scale,
    };
  }
  if (type === "polygon") {
    return { kind: "polygon", points: placedPoints(object as Polygon) };
  }
  if (type === "group") {
    return {
      kind: "group",
      children: (object as Group).getObjects().map((child) => geometryOf(child)),
    };
  }
  return { kind: "ignore" };
}

function centerline(object: FabricObject): StrokePoint[] {
  if (object instanceof Polyline) {
    return placedPoints(object);
  }
  const path = (object as FabricObject & { path?: unknown }).path;
  const offset = (object as FabricObject & { pathOffset?: StrokePoint }).pathOffset ?? {
    x: 0,
    y: 0,
  };
  return applyObjectTransform(pointsFromPathCommands(path), offset, object.calcTransformMatrix());
}

function placedPoints(object: Polyline | Polygon): StrokePoint[] {
  const offset = object.pathOffset ?? { x: 0, y: 0 };
  return applyObjectTransform(object.points ?? [], offset, object.calcTransformMatrix());
}

function roleOf(object: RoleObject): string | undefined {
  return typeof object.annotationRole === "string" ? object.annotationRole : undefined;
}
