import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { embedAnnotationPngOnPdf, exportedPdfPath, suggestedExportName } from "./pdfExport";

const PIXEL_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

describe("suggestedExportName", () => {
  it("appends -annotated before the pdf extension", () => {
    expect(suggestedExportName("floor-plan.pdf")).toBe(
      "floor-plan-annotated.pdf",
    );
  });

  it("still adds a suffix when the name has no extension", () => {
    expect(suggestedExportName("図面")).toBe("図面-annotated.pdf");
  });
});

describe("exportedPdfPath", () => {
  it("writes next to the source pdf under a bp-sync folder", () => {
    expect(exportedPdfPath("/projects/a", "図面/1F.pdf")).toBe("/projects/a/図面/bp-sync/1F.pdf");
    expect(exportedPdfPath("/projects/a", "工程表/週間工程.pdf")).toBe(
      "/projects/a/工程表/bp-sync/週間工程.pdf",
    );
    expect(exportedPdfPath("/projects/a", "A.pdf")).toBe("/projects/a/bp-sync/A.pdf");
  });

  it("normalizes backslashes in the relative pdf path", () => {
    expect(exportedPdfPath("C:/projects/a", "図面\\1F.pdf")).toBe("C:/projects/a/図面/bp-sync/1F.pdf");
  });
});

describe("embedAnnotationPngOnPdf", () => {
  it("keeps page rotation and draws a visual overlay onto a sideways page", async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([200, 400]);
    page.setRotation(degrees(90));
    const bytes = await embedAnnotationPngOnPdf(await source.save(), [
      {
        pageIndex: 0,
        pngBytes: PIXEL_PNG,
        canvasWidth: 400,
        canvasHeight: 200,
      },
    ]);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPage(0).getRotation().angle).toBe(90);
    expect(loaded.getPage(0).getSize()).toEqual({ width: 200, height: 400 });
  });
});
