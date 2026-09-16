import type { PhotoPinRecord } from "./annotationPersist";
import { numberedPins } from "./pinNumbers";
import { parseDataUrl } from "./pinSlides";

export const PIN_MARKER_SIZE = 44;
export const PIN_MARKER_TRIANGLE = 10;
const NUMBER_OFFSET = 16;

export type PinMarkerLayout = {
  tipX: number;
  tipY: number;
  circle: { cx: number; cy: number; r: number };
  number: { x: number; y: number };
};

export function pinMarkerLayout(
  nx: number,
  ny: number,
  canvasWidth: number,
  canvasHeight: number,
): PinMarkerLayout {
  const tipX = nx * canvasWidth;
  const tipY = ny * canvasHeight;
  const r = PIN_MARKER_SIZE / 2;
  return {
    tipX,
    tipY,
    circle: { cx: tipX, cy: tipY - PIN_MARKER_TRIANGLE - r, r },
    number: { x: tipX, y: tipY + NUMBER_OFFSET },
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawPinMarker(
  ctx: CanvasRenderingContext2D,
  layout: PinMarkerLayout,
  label: string,
  thumbnail: HTMLImageElement | null,
) {
  const { circle, tipX, tipY, number } = layout;
  ctx.save();
  ctx.beginPath();
  ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#64748b";
  ctx.fill();
  if (thumbnail) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(
      thumbnail,
      circle.cx - circle.r,
      circle.cy - circle.r,
      circle.r * 2,
      circle.r * 2,
    );
    ctx.restore();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(tipX - 6, tipY - PIN_MARKER_TRIANGLE);
  ctx.lineTo(tipX + 6, tipY - PIN_MARKER_TRIANGLE);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(label).width;
  const padX = 7;
  const pillH = 16;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(number.x - textWidth / 2 - padX, number.y - pillH / 2, textWidth + padX * 2, pillH, 999);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, number.x, number.y);
}

export async function renderPinMarkerOverlay(
  pins: PhotoPinRecord[],
  canvasWidth: number,
  canvasHeight: number,
): Promise<Uint8Array | null> {
  if (pins.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(canvasWidth));
  canvas.height = Math.max(1, Math.round(canvasHeight));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  for (const item of numberedPins(pins)) {
    const layout = pinMarkerLayout(item.pin.nx, item.pin.ny, canvas.width, canvas.height);
    const cover = item.pin.images[0];
    const thumbnail = cover ? await loadImage(cover.thumbnailDataUrl) : null;
    drawPinMarker(ctx, layout, item.label, thumbnail);
  }
  try {
    const { bytes } = parseDataUrl(canvas.toDataURL("image/png"));
    return bytes;
  } catch {
    return null;
  }
}
