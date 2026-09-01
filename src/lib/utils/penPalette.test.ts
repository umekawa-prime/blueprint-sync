import { describe, expect, it } from "vitest";
import {
  PEN_COLORS,
  PEN_WIDTHS,
  isPresetColor,
  isPresetWidth,
  thicknessDotSize,
} from "./penPalette";

describe("penPalette", () => {
  it("offers OneNote-like colors including black, red, yellow, and blue", () => {
    expect(PEN_COLORS).toContain("#000000");
    expect(PEN_COLORS).toContain("#E81123");
    expect(PEN_COLORS).toContain("#FFF100");
    expect(PEN_COLORS).toContain("#0078D7");
    expect(PEN_COLORS.length).toBeGreaterThanOrEqual(12);
  });

  it("offers increasing stroke widths from extra-fine to bold", () => {
    expect(PEN_WIDTHS[0]).toBe(1);
    expect(PEN_WIDTHS.at(-1)).toBeGreaterThanOrEqual(8);
    expect([...PEN_WIDTHS].sort((a, b) => a - b)).toEqual(PEN_WIDTHS);
  });

  it("recognizes preset colors case-insensitively", () => {
    expect(isPresetColor("#e81123")).toBe(true);
    expect(isPresetColor("#00ff00")).toBe(false);
  });

  it("recognizes preset widths", () => {
    expect(isPresetWidth(3)).toBe(true);
    expect(isPresetWidth(7)).toBe(false);
  });

  it("maps thickness to a visible preview dot that grows with width", () => {
    expect(thicknessDotSize(1)).toBeLessThan(thicknessDotSize(8));
    expect(thicknessDotSize(3)).toBeGreaterThan(8);
  });
});
