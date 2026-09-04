export type PageObjects = Record<string, Record<string, unknown>>;

export type PhotoPinRecord = {
  id: string;
  nx: number;
  ny: number;
  thumbnailDataUrl: string;
  imageDataUrl: string;
};

export type AnnotationFile = {
  byPage: Record<number, PageObjects>;
  photoPins: Record<number, Record<string, PhotoPinRecord>>;
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

function isPhotoPinRecord(value: unknown): value is PhotoPinRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.nx === "number" &&
    typeof record.ny === "number" &&
    typeof record.thumbnailDataUrl === "string" &&
    typeof record.imageDataUrl === "string"
  );
}

function parsePhotoPins(value: unknown): Record<number, Record<string, PhotoPinRecord>> {
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
      if (isPhotoPinRecord(pin)) {
        pins[id] = pin;
      }
    }
    output[page] = pins;
  }
  return output;
}

export function serializeAnnotations(
  byPage: Record<number, PageObjects>,
  photoPins: Record<number, Record<string, PhotoPinRecord>> = {},
): string {
  return JSON.stringify({ byPage, photoPins });
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
  return {
    byPage: output,
    photoPins: parsePhotoPins((parsed as { photoPins?: unknown }).photoPins),
  };
}
