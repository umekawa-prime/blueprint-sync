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
  return Array.from(files).find((file) => isDroppedPdfFile(file) || isDroppedZipFile(file)) ?? null;
}
