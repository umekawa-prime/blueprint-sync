import { describe, expect, it } from "vitest";
import { STAMP_OPTIONS, stampPrimitives, stampSize } from "./stampDraw";

describe("stampSize", () => {
  it("uses 2.8% of the page width, with a 16px floor", () => {
    expect(stampSize(1000)).toBe(28);
    expect(stampSize(100)).toBe(16);
  });
});

describe("STAMP_OPTIONS", () => {
  it("lists the six electrical marks in palette order", () => {
    expect(STAMP_OPTIONS.map((option) => [option.id, option.label])).toEqual([
      ["light", "照明"],
      ["ceiling", "シーリング"],
      ["downlight", "ダウンライト"],
      ["outlet", "コンセント"],
      ["switch", "スイッチ"],
      ["panel", "分電盤"],
    ]);
  });
});

describe("stampPrimitives", () => {
  const center = { x: 100, y: 50 };
  const size = 40;

  it("draws a lighting circle, concentric ceiling, and filled downlight", () => {
    expect(stampPrimitives("light", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
    ]);
    expect(stampPrimitives("ceiling", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
      { kind: "circle", x: 100, y: 50, r: 11, fill: false },
    ]);
    expect(stampPrimitives("downlight", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
      { kind: "circle", x: 100, y: 50, r: 8, fill: true },
    ]);
  });

  it("draws outlet X, switch square, and panel rectangle with a diagonal", () => {
    expect(stampPrimitives("outlet", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
      { kind: "line", x1: 86, y1: 36, x2: 114, y2: 64 },
      { kind: "line", x1: 114, y1: 36, x2: 86, y2: 64 },
    ]);
    expect(stampPrimitives("switch", center, size)).toEqual([
      { kind: "rect", left: 80, top: 30, width: 40, height: 40 },
    ]);
    expect(stampPrimitives("panel", center, size)).toEqual([
      { kind: "rect", left: 73, top: 30, width: 54, height: 40 },
      { kind: "line", x1: 73, y1: 30, x2: 127, y2: 70 },
    ]);
  });
});
