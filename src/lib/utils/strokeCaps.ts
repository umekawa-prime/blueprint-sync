export type CapShape = "none" | "dot" | "arrow";

export type StrokePoint = { x: number; y: number };

export type DotCap = {
  kind: "dot";
  x: number;
  y: number;
  radius: number;
  fill: "#000000";
};

export type ArrowCap = {
  kind: "arrow";
  points: [StrokePoint, StrokePoint, StrokePoint];
  fill: string;
};

export type CapPrimitive = DotCap | ArrowCap;

export const DOT_FILL = "#000000";

export function pointsFromPathCommands(path: unknown): StrokePoint[] {
  if (!Array.isArray(path)) {
    return [];
  }
  const points: StrokePoint[] = [];
  for (const command of path) {
    if (!Array.isArray(command) || command.length < 3) {
      continue;
    }
    const x = command[command.length - 2];
    const y = command[command.length - 1];
    if (typeof x !== "number" || typeof y !== "number") {
      continue;
    }
    const last = points.at(-1);
    if (last && last.x === x && last.y === y) {
      continue;
    }
    points.push({ x, y });
  }
  return points;
}

export function applyObjectTransform(
  points: StrokePoint[],
  pathOffset: StrokePoint,
  matrix: readonly number[],
): StrokePoint[] {
  const a = matrix[0] ?? 1;
  const b = matrix[1] ?? 0;
  const c = matrix[2] ?? 0;
  const d = matrix[3] ?? 1;
  const e = matrix[4] ?? 0;
  const f = matrix[5] ?? 0;
  return points.map((point) => {
    const x = point.x - pathOffset.x;
    const y = point.y - pathOffset.y;
    return {
      x: a * x + c * y + e,
      y: b * x + d * y + f,
    };
  });
}

export function strokeCaps(input: {
  points: StrokePoint[];
  startCap: CapShape;
  endCap: CapShape;
  color: string;
  width: number;
}): CapPrimitive[] {
  const points = input.points;
  if (points.length < 2) {
    return [];
  }
  const start = points[0];
  const second = points[1];
  const end = points[points.length - 1];
  const beforeEnd = points[points.length - 2];
  const caps: CapPrimitive[] = [];

  const startCap = capAt(input.startCap, start, {
    x: start.x - second.x,
    y: start.y - second.y,
  }, input.color, input.width);
  if (startCap) {
    caps.push(startCap);
  }

  const endCap = capAt(input.endCap, end, {
    x: end.x - beforeEnd.x,
    y: end.y - beforeEnd.y,
  }, input.color, input.width);
  if (endCap) {
    caps.push(endCap);
  }

  return caps;
}

function capAt(
  shape: CapShape,
  tip: StrokePoint,
  outward: StrokePoint,
  color: string,
  width: number,
): CapPrimitive | null {
  if (shape === "none") {
    return null;
  }
  if (shape === "dot") {
    return {
      kind: "dot",
      x: tip.x,
      y: tip.y,
      radius: Math.max(3, width * 1.25),
      fill: DOT_FILL,
    };
  }
  return {
    kind: "arrow",
    points: arrowTriangle(tip, outward, Math.max(10, width * 4)),
    fill: color,
  };
}

function arrowTriangle(
  tip: StrokePoint,
  outward: StrokePoint,
  size: number,
): [StrokePoint, StrokePoint, StrokePoint] {
  const length = Math.hypot(outward.x, outward.y) || 1;
  const ux = outward.x / length;
  const uy = outward.y / length;
  const px = -uy;
  const py = ux;
  const half = size * 0.45;
  const base = { x: tip.x - ux * size, y: tip.y - uy * size };
  return [
    tip,
    { x: base.x + px * half, y: base.y + py * half },
    { x: base.x - px * half, y: base.y - py * half },
  ];
}
