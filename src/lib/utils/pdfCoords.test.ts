import { describe, expect, it } from "vitest";
import { fabricToPdfRect, pdfPageSizeFromViewport, pdfPageNumber } from "./pdfCoords";

describe("pdfCoords", () => {
  it("converts a top-left fabric rect into PDF bottom-left coordinates", () => {
    const pdf = fabricToPdfRect(
      { left: 50, top: 40, width: 100, height: 20 },
      { canvasWidth: 400, canvasHeight: 800, pageWidth: 200, pageHeight: 400 },
    );

    expect(pdf).toEqual({
      x: 25,
      y: 370,
      width: 50,
      height: 10,
    });
  });

  it("maps a pdf.js viewport size into PDF point size", () => {
    expect(
      pdfPageSizeFromViewport({ width: 612, height: 792, scale: 1 }),
    ).toEqual({ width: 612, height: 792 });

    expect(
      pdfPageSizeFromViewport({ width: 1224, height: 1584, scale: 2 }),
    ).toEqual({ width: 612, height: 792 });
  });

  it("clamps a leftover drawing page index into a shorter schedule pdf", () => {
    expect(pdfPageNumber(4, 1)).toBe(1);
    expect(pdfPageNumber(0, 3)).toBe(1);
    expect(pdfPageNumber(2, 3)).toBe(3);
    expect(pdfPageNumber(0, 0)).toBe(0);
  });
});
