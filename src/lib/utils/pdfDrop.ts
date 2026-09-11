import { isCadDrawingBasename } from "./cadImport";

export function isDroppedPdfFile(file: { name: string; type?: string }): boolean {
  if (file.type === "application/pdf") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".pdf");
}

export function isDroppedZipFile(file: { name: string; type?: string }): boolean {
  if (file.type === "application/zip" || file.type === "application/x-zip-compressed") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".zip");
}

export function isDroppedCadFile(file: { name: string }): boolean {
  const name = file.name.split(/[/\\]/).pop() ?? file.name;
  return isCadDrawingBasename(name);
}

export function firstDroppedPdf(
  files: ArrayLike<File> | null | undefined,
): File | null {
  if (!files) {
    return null;
  }
  return Array.from(files).find(isDroppedPdfFile) ?? null;
}

export function firstDroppedPdfOrZip(
  files: ArrayLike<File> | null | undefined,
): File | null {
  if (!files) {
    return null;
  }
  return Array.from(files).find(
    (file) => isDroppedPdfFile(file) || isDroppedZipFile(file) || isDroppedCadFile(file),
  ) ?? null;
}

export function filePathsFromUriList(uriList: string): string[] {
  const paths: string[] = [];
  for (const raw of uriList.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const path = pathFromDroppedUri(line);
    if (path) {
      paths.push(path);
    }
  }
  return paths;
}

function pathFromDroppedUri(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:") {
      return null;
    }
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(path)) {
      path = path.slice(1);
    }
    return path;
  } catch {
    return null;
  }
}

export function isDroppedImportPath(path: string): boolean {
  const name = path.split(/[/\\]/).pop() ?? "";
  return (
    isDroppedPdfFile({ name, type: "" }) ||
    isDroppedZipFile({ name, type: "" }) ||
    isCadDrawingBasename(name)
  );
}

export function firstDroppedImportPath(paths: string[]): string | null {
  return paths.find(isDroppedImportPath) ?? null;
}
