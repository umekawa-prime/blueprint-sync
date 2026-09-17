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

export type OverlayImagePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
};

export const PDF_DISPLAY_SCALE = 1.2;

export function pdfPageOutputScale(zoom: number, devicePixelRatio: number): number {
  return Math.max(zoom, 0.01) * (devicePixelRatio || 1);
}

export function overlayImagePlacement(
  pageWidth: number,
  pageHeight: number,
  rotation: number,
): OverlayImagePlacement {
  const angle = ((Math.round(rotation) % 360) + 360) % 360;
  switch (angle) {
    case 90:
      return { x: pageWidth, y: 0, width: pageHeight, height: pageWidth, rotate: 90 };
    case 180:
      return {
        x: pageWidth,
        y: pageHeight,
        width: pageWidth,
        height: pageHeight,
        rotate: 180,
      };
    case 270:
      return { x: 0, y: pageHeight, width: pageHeight, height: pageWidth, rotate: 270 };
    default:
      return { x: 0, y: 0, width: pageWidth, height: pageHeight, rotate: 0 };
  }
}

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

export function pdfPageNumber(pageIndex: number, pageCount: number): number {
  if (pageCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(pageIndex, 0), pageCount - 1) + 1;
}

export function fabricToNormalized(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
): { nx: number; ny: number } {
  return {
    nx: canvasWidth === 0 ? 0 : x / canvasWidth,
    ny: canvasHeight === 0 ? 0 : y / canvasHeight,
  };
}

export function normalizedToFabric(
  nx: number,
  ny: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: nx * canvasWidth,
    y: ny * canvasHeight,
  };
}
