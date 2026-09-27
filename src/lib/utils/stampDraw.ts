export const STAMP_PAGE_FRACTION = 0.028;
export const STAMP_MIN_SIZE = 16;

export const STAMP_KINDS = [
  "light",
  "ceiling",
  "downlight",
  "outlet",
  "switch",
  "panel",
] as const;

export type StampKind = (typeof STAMP_KINDS)[number];

export const STAMP_OPTIONS: Array<{ id: StampKind; label: string }> = [
  { id: "light", label: "照明" },
  { id: "ceiling", label: "シーリング" },
  { id: "downlight", label: "ダウンライト" },
  { id: "outlet", label: "コンセント" },
  { id: "switch", label: "スイッチ" },
  { id: "panel", label: "分電盤" },
];

export type StampPoint = { x: number; y: number };

export type StampPrimitive =
  | { kind: "circle"; x: number; y: number; r: number; fill: boolean }
  | { kind: "rect"; left: number; top: number; width: number; height: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number };

export function stampSize(pageWidth: number): number {
  return Math.max(STAMP_MIN_SIZE, pageWidth * STAMP_PAGE_FRACTION);
}

export function stampPrimitives(
  kind: StampKind,
  center: StampPoint,
  size: number,
): StampPrimitive[] {
  const r = size / 2;
  if (kind === "light") {
    return [circle(center, r, false)];
  }
  if (kind === "ceiling") {
    return [circle(center, r, false), circle(center, Math.round(r * 0.55), false)];
  }
  if (kind === "downlight") {
    return [circle(center, r, false), circle(center, Math.round(r * 0.4), true)];
  }
  if (kind === "outlet") {
    const inset = Math.round(r * 0.7);
    return [
      circle(center, r, false),
      {
        kind: "line",
        x1: center.x - inset,
        y1: center.y - inset,
        x2: center.x + inset,
        y2: center.y + inset,
      },
      {
        kind: "line",
        x1: center.x + inset,
        y1: center.y - inset,
        x2: center.x - inset,
        y2: center.y + inset,
      },
    ];
  }
  if (kind === "switch") {
    return [
      {
        kind: "rect",
        left: center.x - r,
        top: center.y - r,
        width: size,
        height: size,
      },
    ];
  }
  const width = Math.round(size * 1.35);
  const left = center.x - width / 2;
  const top = center.y - r;
  return [
    { kind: "rect", left, top, width, height: size },
    { kind: "line", x1: left, y1: top, x2: left + width, y2: top + size },
  ];
}

function circle(center: StampPoint, r: number, fill: boolean): StampPrimitive {
  return { kind: "circle", x: center.x, y: center.y, r, fill };
}
