import { PDFDocument, rgb } from "pdf-lib";
import type { PhotoPinImage, PhotoPinRecord } from "./annotationPersist";
import { numberedPins, pinSlideCaption } from "./pinNumbers";

export type PinSlideStep =
  | { kind: "drawing"; pageIndex: number }
  | {
      kind: "pin";
      pageIndex: number;
      pin: PhotoPinRecord;
      image: PhotoPinImage;
      number: number;
      caption: string;
    };

export type SlideRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function pinSlidePlan(
  drawingPageCount: number,
  pinsByPage: Record<number, Record<string, PhotoPinRecord>>,
): PinSlideStep[] {
  const steps: PinSlideStep[] = [];
  for (let pageIndex = 0; pageIndex < drawingPageCount; pageIndex += 1) {
    steps.push({ kind: "drawing", pageIndex });
    for (const item of numberedPins(Object.values(pinsByPage[pageIndex] ?? {}))) {
      for (const [imageIndex, image] of item.pin.images.entries()) {
        steps.push({
          kind: "pin",
          pageIndex,
          pin: item.pin,
          image,
          number: item.number,
          caption: pinSlideCaption(
            item.number,
            item.pin.title,
            imageIndex,
            item.pin.images.length,
          ),
        });
      }
    }
  }
  return steps;
}

export function pinSlideCounts(
  drawingPageCount: number,
  pinsByPage: Record<number, Record<string, PhotoPinRecord>>,
): number[] {
  return Array.from({ length: drawingPageCount }, (_, pageIndex) =>
    Object.values(pinsByPage[pageIndex] ?? {}).reduce((total, pin) => total + pin.images.length, 0),
  );
}

export function drawingPageIndexes(
  drawingPageCount: number,
  pinSlideCountByPage: number[],
): number[] {
  const indexes: number[] = [];
  let cursor = 0;
  for (let pageIndex = 0; pageIndex < drawingPageCount; pageIndex += 1) {
    indexes.push(cursor);
    cursor += 1 + (pinSlideCountByPage[pageIndex] ?? 0);
  }
  return indexes;
}

export function pinSlideLayout(
  pageWidth: number,
  pageHeight: number,
  hasTitle: boolean,
): { margin: number; titleHeight: number; title: SlideRect; image: SlideRect } {
  const margin = Math.min(pageWidth, pageHeight) * 0.06;
  const titleHeight = hasTitle ? pageHeight * 0.08 : 0;
  const gap = hasTitle ? margin * 0.4 : 0;
  const title: SlideRect = {
    x: margin,
    y: pageHeight - margin - titleHeight,
    width: pageWidth - margin * 2,
    height: titleHeight,
  };
  const image: SlideRect = {
    x: margin,
    y: margin,
    width: pageWidth - margin * 2,
    height: hasTitle ? Math.max(0, title.y - gap - margin) : pageHeight - margin * 2,
  };
  return { margin, titleHeight, title, image };
}

export function containInBox(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: boxWidth, height: boxHeight };
  }
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) {
    throw new Error("画像データを読めませんでした");
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { mime: match[1], bytes };
}

export async function extractDrawingPdfBytes(
  pdfBytes: Uint8Array,
  drawingPageCount: number,
  pinSlideCountByPage: number[],
): Promise<Uint8Array> {
  const source = await PDFDocument.load(pdfBytes);
  const indexes = drawingPageIndexes(drawingPageCount, pinSlideCountByPage);
  if (indexes.some((index) => index < 0 || index >= source.getPageCount())) {
    return pdfBytes;
  }
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, indexes);
  for (const page of copied) {
    output.addPage(page);
  }
  return output.save();
}

async function embedPinImage(pdf: PDFDocument, dataUrl: string) {
  const { mime, bytes } = parseDataUrl(dataUrl);
  if (mime.includes("png")) {
    return pdf.embedPng(bytes);
  }
  return pdf.embedJpg(bytes);
}

async function embedTitlePng(
  pdf: PDFDocument,
  title: string,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * 2));
  canvas.height = Math.max(1, Math.round(height * 2));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = "#0f172a";
  ctx.font = `${Math.floor(canvas.height * 0.55)}px "Noto Sans JP Variable", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(title, 0, canvas.height / 2, canvas.width);
  const { bytes } = parseDataUrl(canvas.toDataURL("image/png"));
  return pdf.embedPng(bytes);
}

export async function appendPhotoPinSlides(
  pdfBytes: Uint8Array,
  pinsByPage: Record<number, Record<string, PhotoPinRecord>>,
  drawingPageCount: number,
): Promise<Uint8Array> {
  const source = await PDFDocument.load(pdfBytes);
  const output = await PDFDocument.create();
  const plan = pinSlidePlan(drawingPageCount, pinsByPage);

  for (const step of plan) {
    if (step.kind === "drawing") {
      const [page] = await output.copyPages(source, [step.pageIndex]);
      output.addPage(page);
      continue;
    }
    const template = source.getPage(step.pageIndex);
    const { width, height } = template.getSize();
    const page = output.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    const caption = step.caption;
    const layout = pinSlideLayout(width, height, caption.length > 0);
    if (caption) {
      const titleImage = await embedTitlePng(output, caption, layout.title.width, layout.title.height);
      if (titleImage) {
        page.drawImage(titleImage, layout.title);
      }
    }
    const photo = await embedPinImage(output, step.image.imageDataUrl);
    const fitted = containInBox(photo.width, photo.height, layout.image.width, layout.image.height);
    page.drawImage(photo, {
      x: layout.image.x + (layout.image.width - fitted.width) / 2,
      y: layout.image.y + (layout.image.height - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height,
    });
  }

  return output.save();
}
