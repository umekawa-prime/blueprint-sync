import { PDFDocument } from "pdf-lib";
import { fabricToPdfRect } from "./pdfCoords";

export async function embedAnnotationPngOnPdf(
  originalPdf: Uint8Array,
  pages: Array<{
    pageIndex: number;
    pngBytes: Uint8Array;
    canvasWidth: number;
    canvasHeight: number;
  }>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdf);

  for (const overlay of pages) {
    const page = pdf.getPage(overlay.pageIndex);
    const { width, height } = page.getSize();
    const image = await pdf.embedPng(overlay.pngBytes);
    const rect = fabricToPdfRect(
      {
        left: 0,
        top: 0,
        width: overlay.canvasWidth,
        height: overlay.canvasHeight,
      },
      {
        canvasWidth: overlay.canvasWidth,
        canvasHeight: overlay.canvasHeight,
        pageWidth: width,
        pageHeight: height,
      },
    );
    page.drawImage(image, rect);
  }

  return pdf.save();
}

export function suggestedExportName(originalName: string): string {
  const trimmed = originalName.replace(/\.pdf$/i, "");
  return `${trimmed}-annotated.pdf`;
}
