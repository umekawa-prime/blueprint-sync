import { describe, expect, it, vi } from "vitest";
import {
  PDF_THUMBNAIL_MAX_WIDTH,
  pdfThumbnailViewport,
  renderPdfThumbnails,
} from "./pdfThumbnails";

describe("pdfThumbnails", () => {
  it("fits a landscape page into the sidebar thumbnail width", () => {
    expect(pdfThumbnailViewport(800, 400, 160)).toEqual({
      scale: 0.2,
      width: 160,
      height: 80,
    });
  });

  it("renders one thumbnail per page in document order", async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const document = {
      getPage: vi.fn(async (pageNumber: number) => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 200 * scale,
          height: 100 * scale,
        }),
        render,
      })),
    };
    const toDataURL = vi.fn(function (this: HTMLCanvasElement) {
      return `data:image/jpeg;base64,page-${this.width}x${this.height}`;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);

    const urls = await renderPdfThumbnails(document, 3);

    expect(document.getPage).toHaveBeenCalledTimes(3);
    expect(document.getPage).toHaveBeenNthCalledWith(1, 1);
    expect(document.getPage).toHaveBeenNthCalledWith(2, 2);
    expect(document.getPage).toHaveBeenNthCalledWith(3, 3);
    expect(render).toHaveBeenCalledTimes(3);
    expect(urls).toEqual([
      `data:image/jpeg;base64,page-${PDF_THUMBNAIL_MAX_WIDTH}x${PDF_THUMBNAIL_MAX_WIDTH / 2}`,
      `data:image/jpeg;base64,page-${PDF_THUMBNAIL_MAX_WIDTH}x${PDF_THUMBNAIL_MAX_WIDTH / 2}`,
      `data:image/jpeg;base64,page-${PDF_THUMBNAIL_MAX_WIDTH}x${PDF_THUMBNAIL_MAX_WIDTH / 2}`,
    ]);
  });

  it("returns no thumbnails when the document has no pages", async () => {
    const document = { getPage: vi.fn() };
    await expect(renderPdfThumbnails(document, 0)).resolves.toEqual([]);
    expect(document.getPage).not.toHaveBeenCalled();
  });
});
