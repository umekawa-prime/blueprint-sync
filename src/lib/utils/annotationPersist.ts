import { backfillPinCreatedAt } from "./pinNumbers";

export type PageObjects = Record<string, Record<string, unknown>>;

export type PhotoPinImage = {
  id: string;
  thumbnailDataUrl: string;
  imageDataUrl: string;
};

export type PhotoPinRecord = {
  id: string;
  nx: number;
  ny: number;
  title?: string;
  images: PhotoPinImage[];
  createdAt?: number;
};

export type MemoPinRecord = {
  id: string;
  nx: number;
  ny: number;
  text: string;
  color: string;
  createdAt?: number;
};

export type AnnotationFile = {
  byPage: Record<number, PageObjects>;
  photoPins: Record<number, Record<string, PhotoPinRecord>>;
  memoPins: Record<number, Record<string, MemoPinRecord>>;
  drawingPageCount?: number;
  pinSlideCountByPage?: number[];
};

export const DEFAULT_MEMO_COLOR = "#E81123";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export type AnnotationPersistExtras = {
  drawingPageCount?: number;
  pinSlideCountByPage?: number[];
  memoPins?: Record<number, Record<string, MemoPinRecord>>;
};

function isPageObjects(value: unknown): value is PageObjects {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  for (const objectValue of Object.values(value)) {
    if (typeof objectValue !== "object" || objectValue === null || Array.isArray(objectValue)) {
      return false;
    }
  }
  return true;
}

export function photoPinImageId(pinId: string, index: number): string {
  return `${pinId}-img-${index + 1}`;
}

function parsePhotoPinImage(
  pinId: string,
  index: number,
  value: unknown,
): PhotoPinImage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const image = value as Record<string, unknown>;
  if (typeof image.thumbnailDataUrl !== "string" || typeof image.imageDataUrl !== "string") {
    return null;
  }
  return {
    id: typeof image.id === "string" && image.id ? image.id : photoPinImageId(pinId, index),
    thumbnailDataUrl: image.thumbnailDataUrl,
    imageDataUrl: image.imageDataUrl,
  };
}

// Pins used to hold exactly one photo as flat `thumbnailDataUrl` / `imageDataUrl`
// fields. Projects saved by those builds still have to open here.
function parsePhotoPinImages(pinId: string, record: Record<string, unknown>): PhotoPinImage[] {
  if (Array.isArray(record.images)) {
    const images: PhotoPinImage[] = [];
    for (const value of record.images) {
      const image = parsePhotoPinImage(pinId, images.length, value);
      if (image) {
        images.push(image);
      }
    }
    return images;
  }
  if (typeof record.thumbnailDataUrl === "string" && typeof record.imageDataUrl === "string") {
    return [
      {
        id: photoPinImageId(pinId, 0),
        thumbnailDataUrl: record.thumbnailDataUrl,
        imageDataUrl: record.imageDataUrl,
      },
    ];
  }
  return [];
}

function parsePhotoPin(value: unknown): PhotoPinRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.nx !== "number" || typeof record.ny !== "number") {
    return null;
  }
  if (record.title !== undefined && typeof record.title !== "string") {
    return null;
  }
  if (
    record.createdAt !== undefined &&
    (typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt))
  ) {
    return null;
  }
  const images = parsePhotoPinImages(record.id, record);
  if (images.length === 0) {
    return null;
  }
  return {
    id: record.id,
    nx: record.nx,
    ny: record.ny,
    title: typeof record.title === "string" ? record.title : "",
    images,
    ...(typeof record.createdAt === "number" ? { createdAt: record.createdAt } : {}),
  };
}

function parseMemoPin(value: unknown): MemoPinRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.nx !== "number" || typeof record.ny !== "number") {
    return null;
  }
  if (!Number.isFinite(record.nx) || !Number.isFinite(record.ny)) {
    return null;
  }
  if (typeof record.text !== "string") {
    return null;
  }
  if (
    record.createdAt !== undefined &&
    (typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt))
  ) {
    return null;
  }
  const color = typeof record.color === "string" && HEX_COLOR.test(record.color) ? record.color : DEFAULT_MEMO_COLOR;
  return {
    id: record.id,
    nx: record.nx,
    ny: record.ny,
    text: record.text,
    color,
    ...(typeof record.createdAt === "number" ? { createdAt: record.createdAt } : {}),
  };
}

export function parseMemoPins(value: unknown): Record<number, Record<string, MemoPinRecord>> {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output: Record<number, Record<string, MemoPinRecord>> = {};
  for (const [key, pageValue] of Object.entries(value)) {
    const page = Number(key);
    if (!Number.isInteger(page) || typeof pageValue !== "object" || pageValue === null || Array.isArray(pageValue)) {
      continue;
    }
    const pins: Record<string, MemoPinRecord> = {};
    for (const [id, pin] of Object.entries(pageValue)) {
      const parsed = parseMemoPin(pin);
      if (parsed) {
        pins[id] = parsed;
      }
    }
    output[page] = backfillMemoCreatedAt(pins);
  }
  return output;
}

function backfillMemoCreatedAt(
  pins: Record<string, MemoPinRecord>,
): Record<string, MemoPinRecord> {
  const filled: Record<string, MemoPinRecord> = {};
  let index = 0;
  for (const [id, pin] of Object.entries(pins)) {
    index += 1;
    filled[id] = {
      ...pin,
      createdAt: typeof pin.createdAt === "number" ? pin.createdAt : index,
    };
  }
  return filled;
}

export function parsePhotoPins(value: unknown): Record<number, Record<string, PhotoPinRecord>> {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output: Record<number, Record<string, PhotoPinRecord>> = {};
  for (const [key, pageValue] of Object.entries(value)) {
    const page = Number(key);
    if (!Number.isInteger(page) || typeof pageValue !== "object" || pageValue === null || Array.isArray(pageValue)) {
      continue;
    }
    const pins: Record<string, PhotoPinRecord> = {};
    for (const [id, pin] of Object.entries(pageValue)) {
      const parsed = parsePhotoPin(pin);
      if (parsed) {
        pins[id] = parsed;
      }
    }
    output[page] = backfillPinCreatedAt(pins);
  }
  return output;
}

export function serializeAnnotations(
  byPage: Record<number, PageObjects>,
  photoPins: Record<number, Record<string, PhotoPinRecord>> = {},
  extras?: AnnotationPersistExtras,
): string {
  return JSON.stringify({
    byPage,
    photoPins,
    memoPins: extras?.memoPins ?? {},
    ...(extras?.drawingPageCount != null ? { drawingPageCount: extras.drawingPageCount } : {}),
    ...(extras?.pinSlideCountByPage ? { pinSlideCountByPage: extras.pinSlideCountByPage } : {}),
  });
}

export function parseAnnotations(raw: string): AnnotationFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid annotation file");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid annotation file");
  }
  const byPage = (parsed as { byPage?: unknown }).byPage;
  if (typeof byPage !== "object" || byPage === null || Array.isArray(byPage)) {
    throw new Error("Invalid annotation file");
  }
  const output: Record<number, PageObjects> = {};
  for (const [key, value] of Object.entries(byPage)) {
    const page = Number(key);
    if (!Number.isInteger(page) || !isPageObjects(value)) {
      throw new Error("Invalid annotation file");
    }
    output[page] = value;
  }
  const record = parsed as {
    photoPins?: unknown;
    memoPins?: unknown;
    drawingPageCount?: unknown;
    pinSlideCountByPage?: unknown;
  };
  const drawingPageCount =
    typeof record.drawingPageCount === "number" && Number.isInteger(record.drawingPageCount) && record.drawingPageCount > 0
      ? record.drawingPageCount
      : undefined;
  const pinSlideCountByPage = Array.isArray(record.pinSlideCountByPage)
    ? record.pinSlideCountByPage.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0)
    : undefined;
  return {
    byPage: output,
    photoPins: parsePhotoPins(record.photoPins),
    memoPins: parseMemoPins(record.memoPins),
    ...(drawingPageCount != null ? { drawingPageCount } : {}),
    ...(pinSlideCountByPage && pinSlideCountByPage.length > 0 ? { pinSlideCountByPage } : {}),
  };
}
