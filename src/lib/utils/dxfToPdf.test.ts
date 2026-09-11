import { describe, expect, it } from "vitest";
import { dxfDocumentToPdf, type DxfDocumentJson } from "./dxfToPdf";

function lineDoc(): DxfDocumentJson {
  return {
    layers: [{ name: "0", color: 7, line_type: "CONTINUOUS", frozen: false, locked: false }],
    entities: [
      {
        type: "LINE",
        layer: "0",
        color: 1,
        line_type: "CONTINUOUS",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 50,
      },
    ],
    blocks: [],
    unsupported_entities: [],
  };
}

describe("dxfDocumentToPdf", () => {
  it("draws a vector pdf page large enough for the line bbox plus margin", async () => {
    const bytes = await dxfDocumentToPdf(lineDoc());
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    expect(header.startsWith("%PDF")).toBe(true);

    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    const mmToPt = 72 / 25.4;
    expect(width).toBeGreaterThan(100 * mmToPt);
    expect(height).toBeGreaterThan(50 * mmToPt);
  });

  it("skips frozen-layer geometry so hidden cad layers stay off the page", async () => {
    const bytes = await dxfDocumentToPdf({
      layers: [{ name: "HID", color: 7, line_type: "CONTINUOUS", frozen: true, locked: false }],
      entities: [
        {
          type: "LINE",
          layer: "HID",
          color: 1,
          line_type: "CONTINUOUS",
          x1: 0,
          y1: 0,
          x2: 1000,
          y2: 1000,
        },
      ],
      blocks: [],
      unsupported_entities: [],
    });
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes);
    const { width, height } = pdf.getPage(0).getSize();
    const a4Width = (210 * 72) / 25.4;
    expect(width).toBeCloseTo(a4Width, 0);
    expect(height).toBeGreaterThan(400);
  });
});
