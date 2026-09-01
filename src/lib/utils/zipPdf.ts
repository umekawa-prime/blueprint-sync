import { unzipSync } from "fflate";
import { isProjectPdfBasename } from "./projectFormat";

export type ZipPdfEntry = {
  name: string;
  bytes: Uint8Array;
};

export function isZipBasename(name: string): boolean {
  return Boolean(
    name &&
      name.toLowerCase().endsWith(".zip") &&
      !name.startsWith(".") &&
      !name.includes("/") &&
      !name.includes("\\") &&
      !name.includes(".."),
  );
}

function zipEntryBasename(entryPath: string): string | null {
  const normalized = entryPath.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.endsWith("/") ||
    normalized.startsWith("/") ||
    normalized.includes("..")
  ) {
    return null;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "__MACOSX" || part.startsWith("."))) {
    return null;
  }
  const basename = parts.at(-1);
  if (!basename || !isProjectPdfBasename(basename)) {
    return null;
  }
  return basename;
}

export function pdfEntriesFromZip(bytes: Uint8Array): ZipPdfEntry[] {
  const files = unzipSync(bytes);
  const seen = new Set<string>();
  const entries: ZipPdfEntry[] = [];
  for (const [path, data] of Object.entries(files)) {
    const name = zipEntryBasename(path);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    entries.push({ name, bytes: data });
  }
  return entries;
}
