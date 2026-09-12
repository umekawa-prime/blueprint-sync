import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { PhotoPinRecord } from "./annotationPersist";
import {
  containInBox,
  drawingPageIndexes,
  extractDrawingPdfBytes,
  pinSlideCounts,
  pinSlideLayout,
  pinSlidePlan,
  appendPhotoPinSlides,
} from "./pinSlides";

function pin(id: string, title = "", createdAt?: number): PhotoPinRecord {
  return {
    id,
    nx: 0.5,
    ny: 0.5,
    title,
    thumbnailDataUrl: "data:image/jpeg;base64,aaa",
    imageDataUrl: "data:image/jpeg;base64,bbb",
    ...(createdAt != null ? { createdAt } : {}),
  };
}

describe("pinSlidePlan", () => {
  it("places each pin slide immediately after its drawing page", () => {
    expect(
      pinSlidePlan(2, {
        0: { a: pin("a", "基礎"), b: pin("b", "配管") },
        1: { c: pin("c") },
      }),
    ).toEqual([
      { kind: "drawing", pageIndex: 0 },
      { kind: "pin", pageIndex: 0, pin: pin("a", "基礎"), number: 1, caption: "① 基礎" },
      { kind: "pin", pageIndex: 0, pin: pin("b", "配管"), number: 2, caption: "② 配管" },
      { kind: "drawing", pageIndex: 1 },
      { kind: "pin", pageIndex: 1, pin: pin("c"), number: 1, caption: "①" },
    ]);
  });

  it("orders pin slides by createdAt, not object insertion", () => {
    expect(
      pinSlidePlan(1, {
        0: { later: pin("later", "後", 200), earlier: pin("earlier", "先", 50) },
      }),
    ).toEqual([
      { kind: "drawing", pageIndex: 0 },
      { kind: "pin", pageIndex: 0, pin: pin("earlier", "先", 50), number: 1, caption: "① 先" },
      { kind: "pin", pageIndex: 0, pin: pin("later", "後", 200), number: 2, caption: "② 後" },
    ]);
  });

  it("keeps a drawing page even when it has no pins", () => {
    expect(pinSlidePlan(1, {})).toEqual([{ kind: "drawing", pageIndex: 0 }]);
  });
});

describe("pinSlideCounts and drawingPageIndexes", () => {
  it("counts pins per drawing page for save/reload", () => {
    expect(pinSlideCounts(2, { 0: { a: pin("a") }, 1: {} })).toEqual([1, 0]);
  });

  it("maps interleaved PDF pages back to drawing pages", () => {
    expect(drawingPageIndexes(2, [2, 1])).toEqual([0, 3]);
  });
});

describe("pinSlideLayout", () => {
  it("reserves a title band and a contained image area", () => {
    const layout = pinSlideLayout(400, 600, true);
    expect(layout.image.width).toBeLessThan(400);
    expect(layout.image.height).toBeLessThan(600);
    expect(layout.title.height).toBeGreaterThan(0);
    expect(layout.image.y + layout.image.height).toBeLessThanOrEqual(layout.title.y);
  });

  it("gives the photo more room when the title is empty", () => {
    const withTitle = pinSlideLayout(400, 600, true);
    const without = pinSlideLayout(400, 600, false);
    expect(without.image.height).toBeGreaterThan(withTitle.image.height);
  });
});

describe("containInBox", () => {
  it("fits a landscape photo inside the slide image box", () => {
    expect(containInBox(1600, 900, 300, 200)).toEqual({ width: 300, height: 168.75 });
  });
});

describe("extractDrawingPdfBytes", () => {
  it("copies only the original drawing pages out of an interleaved export", async () => {
    const source = await PDFDocument.create();
    source.addPage([100, 200]);
    source.addPage([110, 210]);
    source.addPage([120, 220]);
    source.addPage([130, 230]);
    const bytes = await source.save();

    const extracted = await extractDrawingPdfBytes(bytes, 2, [1, 1]);
    const pdf = await PDFDocument.load(extracted);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 100, height: 200 });
    expect(pdf.getPage(1).getSize()).toEqual({ width: 120, height: 220 });
  });
});

describe("appendPhotoPinSlides", () => {
  it("inserts one slide per pin immediately after the drawing page", async () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const source = await PDFDocument.create();
    source.addPage([200, 300]);
    source.addPage([200, 300]);
    const withPins = await appendPhotoPinSlides(
      await source.save(),
      {
        0: {
          a: {
            id: "a",
            nx: 0.5,
            ny: 0.5,
            title: "基礎",
            thumbnailDataUrl: tinyPng,
            imageDataUrl: tinyPng,
          },
        },
      },
      2,
    );
    const pdf = await PDFDocument.load(withPins);
    expect(pdf.getPageCount()).toBe(3);
  });
});
