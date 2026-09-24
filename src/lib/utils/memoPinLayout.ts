import type { MemoPinRecord } from "./annotationPersist";
import { parseDataUrl } from "./pinSlides";

export const MEMO_PIN_SIZE = 16;
export const MEMO_PIN_TRIANGLE = 8;
export const MEMO_MAX_CHARS_PER_LINE = 12;
export const MEMO_MAX_LINES = 4;
export const MEMO_BUBBLE_PADDING_X = 8;
export const MEMO_BUBBLE_PADDING_Y = 6;
export const MEMO_LINE_HEIGHT = 16;
export const MEMO_CHAR_WIDTH = 12;
export const MEMO_BUBBLE_GAP = 8;

export type MemoPinOverlayLayout = {
  tipX: number;
  tipY: number;
  head: { cx: number; cy: number; r: number };
  bubble: { x: number; y: number; width: number; height: number };
  lines: string[];
  color: string;
};

export function wrapMemoLines(text: string): string[] {
  const source = text.replace(/\r\n/g, "\n");
  const lines: string[] = [];
  for (const paragraph of source.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    for (let index = 0; index < paragraph.length; index += MEMO_MAX_CHARS_PER_LINE) {
      lines.push(paragraph.slice(index, index + MEMO_MAX_CHARS_PER_LINE));
    }
  }
  if (lines.length === 0) {
    return [""];
  }
  if (lines.length <= MEMO_MAX_LINES) {
    return lines;
  }
  const kept = lines.slice(0, MEMO_MAX_LINES);
  const last = kept[MEMO_MAX_LINES - 1] ?? "";
  kept[MEMO_MAX_LINES - 1] = `${last.slice(0, Math.max(0, MEMO_MAX_CHARS_PER_LINE - 1))}…`;
  return kept;
}

function bubbleSize(lines: string[]): { width: number; height: number } {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
  return {
    width: longest * MEMO_CHAR_WIDTH + MEMO_BUBBLE_PADDING_X * 2,
    height: Math.max(1, lines.length) * MEMO_LINE_HEIGHT + MEMO_BUBBLE_PADDING_Y * 2,
  };
}

export function memoPinLayout(
  nx: number,
  ny: number,
  canvasWidth: number,
  canvasHeight: number,
  text: string,
  color: string,
): MemoPinOverlayLayout {
  const tipX = nx * canvasWidth;
  const tipY = ny * canvasHeight;
  const r = MEMO_PIN_SIZE / 2;
  const head = { cx: tipX, cy: tipY - MEMO_PIN_TRIANGLE - r, r };
  const lines = wrapMemoLines(text);
  const size = bubbleSize(lines);
  let x = head.cx + r + MEMO_BUBBLE_GAP;
  if (x + size.width > canvasWidth) {
    x = head.cx - r - MEMO_BUBBLE_GAP - size.width;
  }
  let y = head.cy - size.height / 2;
  y = Math.min(Math.max(0, y), Math.max(0, canvasHeight - size.height));
  x = Math.min(Math.max(0, x), Math.max(0, canvasWidth - size.width));
  return {
    tipX,
    tipY,
    head,
    bubble: { x, y, width: size.width, height: size.height },
    lines,
    color,
  };
}

function drawMemoPin(ctx: CanvasRenderingContext2D, layout: MemoPinOverlayLayout) {
  const { head, tipX, tipY, bubble, lines, color } = layout;
  ctx.beginPath();
  ctx.moveTo(tipX - 5, tipY - MEMO_PIN_TRIANGLE);
  ctx.lineTo(tipX + 5, tipY - MEMO_PIN_TRIANGLE);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(head.cx, head.cy, head.r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(bubble.x, bubble.y, bubble.width, bubble.height, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `${MEMO_LINE_HEIGHT - 4}px sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  for (const [index, line] of lines.entries()) {
    ctx.fillText(
      line,
      bubble.x + MEMO_BUBBLE_PADDING_X,
      bubble.y + MEMO_BUBBLE_PADDING_Y + index * MEMO_LINE_HEIGHT,
    );
  }
}

export async function renderMemoPinOverlay(
  pins: MemoPinRecord[],
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
  for (const pin of pins) {
    drawMemoPin(
      ctx,
      memoPinLayout(pin.nx, pin.ny, canvas.width, canvas.height, pin.text, pin.color),
    );
  }
  try {
    const { bytes } = parseDataUrl(canvas.toDataURL("image/png"));
    return bytes;
  } catch {
    return null;
  }
}
