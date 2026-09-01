export function isDroppedPdfFile(file: { name: string; type?: string }): boolean {
  if (file.type === "application/pdf") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".pdf");
}

export function firstDroppedPdf(
  files: ArrayLike<File> | null | undefined,
): File | null {
  if (!files) {
    return null;
  }
  return Array.from(files).find(isDroppedPdfFile) ?? null;
}
