export type FabricRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasPageMapping = {
  canvasWidth: number;
  canvasHeight: number;
  pageWidth: number;
  pageHeight: number;
};

export type PdfJsViewport = {
  width: number;
  height: number;
  scale: number;
};

export function fabricToPdfRect(
  rect: FabricRect,
  mapping: CanvasPageMapping,
): PdfRect {
  const scaleX = mapping.pageWidth / mapping.canvasWidth;
  const scaleY = mapping.pageHeight / mapping.canvasHeight;
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;
  const x = rect.left * scaleX;
  const y = mapping.pageHeight - rect.top * scaleY - height;

  return { x, y, width, height };
}

export function pdfPageSizeFromViewport(viewport: PdfJsViewport): {
  width: number;
  height: number;
} {
  return {
    width: viewport.width / viewport.scale,
    height: viewport.height / viewport.scale,
  };
}
