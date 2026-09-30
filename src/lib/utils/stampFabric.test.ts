import { describe, expect, it } from "vitest";
import { createStampObject } from "./stampFabric";
import { SHAPE_ROLE } from "./shapeDraw";
import { findErasableStroke } from "./strokeEraser";
import { STAMP_KINDS } from "./stampDraw";

describe("createStampObject", () => {
  it("marks every stamp as a shape Group centered on the click", () => {
    const object = createStampObject("light", { x: 80, y: 40 }, 1000, {
      color: "#E81123",
      width: 3,
    });
    expect(object.type?.toLowerCase()).toBe("group");
    expect(object.left).toBe(80);
    expect(object.top).toBe(40);
    expect((object as { annotationRole?: string }).annotationRole).toBe(SHAPE_ROLE);
    expect(object.toObject(["annotationRole"]).annotationRole).toBe(SHAPE_ROLE);
    expect(findErasableStroke([object], { x: 80, y: 40 })).toBe(object);
  });

  it("builds each electrical kind as a shape the eraser can remove", () => {
    for (const kind of STAMP_KINDS) {
      const object = createStampObject(kind, { x: 10, y: 20 }, 800, {
        color: "#000000",
        width: 2,
      });
      expect((object as { annotationRole?: string }).annotationRole).toBe(SHAPE_ROLE);
      expect(findErasableStroke([object], { x: 10, y: 20 })).toBe(object);
    }
  });
});
