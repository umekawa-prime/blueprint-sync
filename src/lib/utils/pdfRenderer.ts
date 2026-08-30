import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdfDocument(
  data: Uint8Array,
): Promise<PDFDocumentProxy> {
  const loadingTask = getDocument({ data: data.slice() });
  return loadingTask.promise;
}

export async function renderPdfPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ width: number; height: number }> {
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get 2D context for PDF canvas");
  }

  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const transform =
    outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
    transform,
  }).promise;

  return { width: viewport.width, height: viewport.height };
}
