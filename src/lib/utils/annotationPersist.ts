export type PageObjects = Record<string, Record<string, unknown>>;

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

export function serializeAnnotations(byPage: Record<number, PageObjects>): string {
  return JSON.stringify({ byPage });
}

export function parseAnnotations(raw: string): Record<number, PageObjects> {
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
  return output;
}
