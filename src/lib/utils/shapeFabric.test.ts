import { describe, expect, it } from "vitest";
import { Polyline } from "fabric";
import { createShapeObject } from "./shapeFabric";
import { SHAPE_ROLE } from "./shapeDraw";
import { createStraightStrokeObject } from "./penStrokeFabric";
import { findErasableStroke } from "./strokeEraser";

const style = { color: "#E81123", width: 4 };

describe("createShapeObject", () => {
  it("marks a dragged rectangle, ellipse, and arrow as a shape", () => {
    for (const kind of ["rect", "ellipse", "arrow"] as const) {
      const object = createShapeObject(kind, { x: 10, y: 20 }, { x: 80, y: 60 }, style);
      expect(object).not.toBeNull();
      expect((object as { annotationRole?: string }).annotationRole).toBe(SHAPE_ROLE);
      expect(object?.toObject(["annotationRole"]).annotationRole).toBe(SHAPE_ROLE);
    }
  });

  it("returns nothing for a tiny drag", () => {
    expect(createShapeObject("rect", { x: 0, y: 0 }, { x: 2, y: 1 }, style)).toBeNull();
  });
});

describe("findErasableStroke", () => {
  it("removes a whole pen stroke or shape", () => {
    const pen = new Polyline(
      [
        { x: 0, y: 10 },
        { x: 40, y: 10 },
      ],
      { stroke: "#111", strokeWidth: 4, fill: "", objectCaching: false },
    );
    const rect = createShapeObject("rect", { x: 0, y: 70 }, { x: 40, y: 100 }, style);
    const ellipse = createShapeObject("ellipse", { x: 0, y: 110 }, { x: 40, y: 150 }, style);
    const arrow = createShapeObject("arrow", { x: 0, y: 170 }, { x: 40, y: 170 }, style);
    const capped = createStraightStrokeObject(
      [
        { x: 0, y: 40 },
        { x: 40, y: 40 },
      ],
      { color: "#111", width: 4, startCap: "none", endCap: "arrow" },
    );
    expect(rect).not.toBeNull();
    expect(ellipse).not.toBeNull();
    expect(arrow).not.toBeNull();
    const objects = [pen, arrow!, rect!, ellipse!, capped];

    expect(findErasableStroke(objects, { x: 20, y: 11 })).toBe(pen);
    expect(findErasableStroke(objects, { x: 20, y: 40 })).toBe(capped);
    expect(findErasableStroke(objects, { x: 20, y: 170 })).toBe(arrow);
    expect(findErasableStroke(objects, { x: 20, y: 85 })).toBe(rect);
    expect(findErasableStroke(objects, { x: 20, y: 130 })).toBe(ellipse);
  });
});
