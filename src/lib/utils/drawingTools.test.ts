import { describe, expect, it } from "vitest";
import { drawingTools, isPenMode, isShapeTool } from "./drawingTools";

describe("drawingTools", () => {
  it("keeps shape tools visible beside the usual tools", () => {
    expect(drawingTools("select").map((tool) => tool.id)).toEqual([
      "select",
      "pen",
      "text",
      "pan",
      "rect",
      "ellipse",
      "arrow",
    ]);
    expect(drawingTools("rect").map((tool) => tool.label)).toContain("矩形");
    expect(drawingTools("ellipse").map((tool) => tool.label)).toContain("楕円");
    expect(drawingTools("arrow").map((tool) => tool.label)).toContain("矢印線");
  });

  it("shows only pen and eraser while drawing freehand", () => {
    for (const tool of ["pen", "eraser"] as const) {
      expect(drawingTools(tool).map((item) => item.id)).toEqual(["pen", "eraser"]);
      expect(isPenMode(tool)).toBe(true);
    }
    expect(isPenMode("select")).toBe(false);
    expect(isPenMode("rect")).toBe(false);
  });
});

describe("isShapeTool", () => {
  it("names the three drag tools", () => {
    expect(isShapeTool("rect")).toBe(true);
    expect(isShapeTool("ellipse")).toBe(true);
    expect(isShapeTool("arrow")).toBe(true);
    expect(isShapeTool("pen")).toBe(false);
    expect(isShapeTool("eraser")).toBe(false);
  });
});
