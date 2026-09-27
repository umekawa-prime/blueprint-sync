export type ScenePoint = { x: number; y: number };

export type HitGeometry =
  | { kind: "stroke"; points: ScenePoint[]; strokeWidth: number }
  | { kind: "disk"; center: ScenePoint; radius: number }
  | { kind: "polygon"; points: ScenePoint[] }
  | { kind: "group"; children: HitGeometry[] }
  | { kind: "ignore" };

export type HitItem = {
  erasable: boolean;
  geometry: HitGeometry;
};

export function hitShapeContains(geometry: HitGeometry, point: ScenePoint): boolean {
  if (geometry.kind === "ignore") {
    return false;
  }
  if (geometry.kind === "group") {
    return geometry.children.some((child) => hitShapeContains(child, point));
  }
  if (geometry.kind === "disk") {
    return Math.hypot(point.x - geometry.center.x, point.y - geometry.center.y) <= geometry.radius;
  }
  if (geometry.kind === "polygon") {
    return pointInPolygon(point, geometry.points) || nearPolyline(point, geometry.points, 1);
  }
  return nearPolyline(point, geometry.points, Math.max(geometry.strokeWidth / 2, 0));
}

export function indexOfErasableHit(items: HitItem[], point: ScenePoint): number | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.erasable && hitShapeContains(item.geometry, point)) {
      return index;
    }
  }
  return null;
}

function nearPolyline(point: ScenePoint, points: ScenePoint[], radius: number): boolean {
  if (points.length === 0) {
    return false;
  }
  if (points.length === 1) {
    return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= radius;
  }
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(point, points[index - 1], points[index]) <= radius) {
      return true;
    }
  }
  return false;
}

function distanceToSegment(point: ScenePoint, start: ScenePoint, end: ScenePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function pointInPolygon(point: ScenePoint, polygon: ScenePoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const prior = polygon[previous];
    const crosses =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y || 1) + current.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}
