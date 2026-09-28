import { describe, expect, it } from "vitest";
import { drawingTools, isPenMode, isShapeTool, isStampTool } from "./drawingTools";

describe("drawingTools", () => {
  it("keeps stamp and drag shape tools visible beside the usual tools", () => {
    expect(drawingTools("select").map((tool) => tool.id)).toEqual([
      "select",
      "stamp",
      "pen",
      "eraser",
      "text",
      "pan",
      "rect",
      "ellipse",
      "arrow",
    ]);
    expect(drawingTools("select").map((tool) => tool.label)).toContain("図形");
    expect(drawingTools("rect").map((tool) => tool.label)).toContain("矩形");
    expect(drawingTools("ellipse").map((tool) => tool.label)).toContain("楕円");
    expect(drawingTools("arrow").map((tool) => tool.label)).toContain("矢印線");
  });

  it("keeps select and the other tools visible while the pen or eraser is active", () => {
    const ids = ["select", "stamp", "pen", "eraser", "text", "pan", "rect", "ellipse", "arrow"];
    for (const tool of ["select", "pen", "eraser", "rect", "stamp"] as const) {
      expect(drawingTools(tool).map((item) => item.id)).toEqual(ids);
      expect(isPenMode(tool)).toBe(tool === "pen" || tool === "eraser");
    }
  });
});

describe("isShapeTool", () => {
  it("names the three drag tools and not the stamp", () => {
    expect(isShapeTool("rect")).toBe(true);
    expect(isShapeTool("ellipse")).toBe(true);
    expect(isShapeTool("arrow")).toBe(true);
    expect(isShapeTool("stamp")).toBe(false);
    expect(isShapeTool("pen")).toBe(false);
    expect(isShapeTool("eraser")).toBe(false);
  });
});

describe("isStampTool", () => {
  it("names only the electrical stamp tool", () => {
    expect(isStampTool("stamp")).toBe(true);
    expect(isStampTool("rect")).toBe(false);
    expect(isStampTool("select")).toBe(false);
  });
});
