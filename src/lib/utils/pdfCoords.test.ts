import { describe, expect, it } from "vitest";
import {
  fabricToNormalized,
  fabricToPdfRect,
  normalizedToFabric,
  overlayImagePlacement,
  pdfPageNumber,
  pdfPageOutputScale,
  pdfPageSizeFromViewport,
  type OverlayImagePlacement,
} from "./pdfCoords";

function pngPointToPdf(
  ix: number,
  iy: number,
  placement: OverlayImagePlacement,
): { x: number; y: number } {
  const rad = (placement.rotate * Math.PI) / 180;
  const x = ix * placement.width;
  const y = iy * placement.height;
  return {
    x: placement.x + Math.cos(rad) * x - Math.sin(rad) * y,
    y: placement.y + Math.sin(rad) * x + Math.cos(rad) * y,
  };
}

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

  it("stores a fabric click as a zoom-independent 0-1 pin position", () => {
    expect(fabricToNormalized(100, 50, 400, 200)).toEqual({ nx: 0.25, ny: 0.25 });
    expect(normalizedToFabric(0.25, 0.25, 800, 400)).toEqual({ x: 200, y: 100 });
  });

  it("clamps a leftover drawing page index into a shorter schedule pdf", () => {
    expect(pdfPageNumber(4, 1)).toBe(1);
    expect(pdfPageNumber(0, 3)).toBe(1);
    expect(pdfPageNumber(2, 3)).toBe(3);
    expect(pdfPageNumber(0, 0)).toBe(0);
  });

  it("places a visual overlay onto an unrotated page without extra rotation", () => {
    const placement = overlayImagePlacement(200, 400, 0);
    expect(pngPointToPdf(0, 1, placement)).toEqual({ x: 0, y: 400 });
    expect(pngPointToPdf(1, 0, placement)).toEqual({ x: 200, y: 0 });
  });

  it("maps a pdf.js visual overlay onto a 90-degree page so top-left stays top-left", () => {
    const placement = overlayImagePlacement(200, 400, 90);
    expect(pngPointToPdf(0, 1, placement).x).toBeCloseTo(0);
    expect(pngPointToPdf(0, 1, placement).y).toBeCloseTo(0);
    expect(pngPointToPdf(1, 0, placement).x).toBeCloseTo(200);
    expect(pngPointToPdf(1, 0, placement).y).toBeCloseTo(400);
  });

  it("maps a visual overlay onto 180- and 270-degree pages", () => {
    const turned = overlayImagePlacement(200, 400, 180);
    expect(pngPointToPdf(0, 1, turned).x).toBeCloseTo(200);
    expect(pngPointToPdf(0, 1, turned).y).toBeCloseTo(0);

    const sideways = overlayImagePlacement(200, 400, 270);
    expect(pngPointToPdf(0, 1, sideways).x).toBeCloseTo(200);
    expect(pngPointToPdf(0, 1, sideways).y).toBeCloseTo(400);
  });

  it("raises PDF bitmap density with zoom without changing layout scale", () => {
    expect(pdfPageOutputScale(1, 1)).toBe(1);
    expect(pdfPageOutputScale(2, 1)).toBe(2);
    expect(pdfPageOutputScale(2, 2)).toBe(4);
  });
});
