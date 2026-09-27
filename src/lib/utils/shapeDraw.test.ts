import { describe, expect, it } from "vitest";
import { MIN_SHAPE_DRAG, arrowPoints, shapeBox } from "./shapeDraw";

describe("shape drag", () => {
  it("drops a drag shorter than the minimum", () => {
    const end = { x: 10 + MIN_SHAPE_DRAG - 0.1, y: 20 };
    expect(shapeBox({ x: 10, y: 20 }, end)).toBeNull();
    expect(arrowPoints({ x: 10, y: 20 }, end)).toBeNull();
  });

  it("uses the press and release points as opposite corners", () => {
    expect(shapeBox({ x: 40, y: 10 }, { x: 10, y: 30 })).toEqual({
      left: 10,
      top: 10,
      width: 30,
      height: 20,
    });
  });

  it("aims the arrow from the press point toward the release point", () => {
    expect(arrowPoints({ x: 5, y: 8 }, { x: 50, y: 8 })).toEqual([
      { x: 5, y: 8 },
      { x: 50, y: 8 },
    ]);
  });
});
