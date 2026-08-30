export type PageObjects = Record<string, Record<string, unknown>>;

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
    if (!Number.isInteger(page) || typeof value !== "object" || value === null) {
      throw new Error("Invalid annotation file");
    }
    output[page] = value as PageObjects;
  }
  return output;
}
