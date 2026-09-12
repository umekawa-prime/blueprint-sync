import type { PhotoPinRecord } from "./annotationPersist";

export type NumberedPhotoPin = {
  pin: PhotoPinRecord;
  number: number;
  label: string;
};

export function circledPinLabel(n: number): string {
  if (n >= 1 && n <= 20) {
    return String.fromCharCode(0x245f + n);
  }
  if (n >= 21 && n <= 35) {
    return String.fromCharCode(0x3250 + (n - 20));
  }
  if (n >= 36 && n <= 50) {
    return String.fromCharCode(0x32b0 + (n - 35));
  }
  return `(${n})`;
}

export function nextPinCreatedAt(
  pins: Iterable<{ createdAt?: number }>,
  now = Date.now(),
): number {
  let max = 0;
  for (const pin of pins) {
    if (typeof pin.createdAt === "number" && pin.createdAt > max) {
      max = pin.createdAt;
    }
  }
  return Math.max(now, max + 1);
}

export function backfillPinCreatedAt(
  pins: Record<string, PhotoPinRecord>,
): Record<string, PhotoPinRecord> {
  const filled: Record<string, PhotoPinRecord> = {};
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

export function numberedPins(pins: PhotoPinRecord[]): NumberedPhotoPin[] {
  return [...pins]
    .sort((a, b) => {
      const created = (a.createdAt ?? 0) - (b.createdAt ?? 0);
      if (created !== 0) {
        return created;
      }
      return a.id.localeCompare(b.id);
    })
    .map((pin, index) => {
      const number = index + 1;
      return { pin, number, label: circledPinLabel(number) };
    });
}

export function pinSlideCaption(number: number, title?: string): string {
  const label = circledPinLabel(number);
  const trimmed = title?.trim() ?? "";
  return trimmed ? `${label} ${trimmed}` : label;
}
