export const PDF_THUMBNAIL_MAX_WIDTH = 144;

type ThumbnailPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<unknown> };
};

type ThumbnailDocument = {
  getPage: (pageNumber: number) => Promise<unknown>;
};

export function pdfThumbnailViewport(
  pageWidth: number,
  pageHeight: number,
  maxWidth: number,
): { scale: number; width: number; height: number } {
  const scale = maxWidth / pageWidth;
  return {
    scale,
    width: Math.max(1, Math.floor(pageWidth * scale)),
    height: Math.max(1, Math.floor(pageHeight * scale)),
  };
}

export async function renderPdfPageThumbnail(
  page: ThumbnailPage,
  maxWidth = PDF_THUMBNAIL_MAX_WIDTH,
): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const fitted = pdfThumbnailViewport(base.width, base.height, maxWidth);
  const viewport = page.getViewport({ scale: fitted.scale });
  const canvas = document.createElement("canvas");
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get 2D context for PDF thumbnail");
  }
  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function renderPdfThumbnails(
  document: ThumbnailDocument,
  pageCount: number,
  maxWidth = PDF_THUMBNAIL_MAX_WIDTH,
): Promise<string[]> {
  const urls: string[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = (await document.getPage(pageNumber)) as ThumbnailPage;
    urls.push(await renderPdfPageThumbnail(page, maxWidth));
  }
  return urls;
}
