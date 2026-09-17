import { PDFDocument, degrees } from "pdf-lib";
import { overlayImagePlacement } from "./pdfCoords";

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
    const placement = overlayImagePlacement(width, height, page.getRotation().angle);
    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      ...(placement.rotate ? { rotate: degrees(placement.rotate) } : {}),
    });
  }

  return pdf.save();
}

export const EXPORT_SUBDIR = "bp-sync";

export function exportedPdfPath(projectFolder: string, pdfRelPath: string): string {
  const folder = projectFolder.replace(/[/\\]+$/, "");
  const normalized = pdfRelPath.replaceAll("\\", "/").replace(/^\/+/, "");
  const slash = normalized.lastIndexOf("/");
  const dir = slash >= 0 ? normalized.slice(0, slash) : "";
  const name = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const parent = dir ? `${folder}/${dir}` : folder;
  return `${parent}/${EXPORT_SUBDIR}/${name}`;
}

export function suggestedExportName(originalName: string): string {
  const trimmed = originalName.replace(/\.pdf$/i, "");
  return `${trimmed}-annotated.pdf`;
}
