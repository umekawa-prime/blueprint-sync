import { isTauriRuntime } from "./platform";

function isSafeBasename(name: string): boolean {
  return Boolean(
    name &&
      !name.startsWith(".") &&
      !name.includes("/") &&
      !name.includes("\\") &&
      !name.includes(".."),
  );
}

export function isCadDrawingBasename(name: string): boolean {
  const lower = name.toLowerCase();
  return isSafeBasename(name) && (lower.endsWith(".jww") || lower.endsWith(".jwc"));
}

export function cadPdfBasename(name: string): string | null {
  if (!isCadDrawingBasename(name)) {
    return null;
  }
  return name.replace(/\.(jww|jwc)$/i, ".pdf");
}

export async function convertCadBytesToPdf(
  name: string,
  bytes: Uint8Array,
): Promise<{ pdfName: string; bytes: Uint8Array }> {
  const pdfName = cadPdfBasename(name);
  if (!pdfName) {
    throw new Error("PDFファイル名が不正です");
  }
  if (!isTauriRuntime()) {
    throw new Error("JWW/JWC の変換はデスクトップ版で行えます");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const pdfBytes = await invoke<number[] | Uint8Array | ArrayBuffer>("convert_cad_to_pdf", {
    bytes: Array.from(bytes),
  });
  const converted =
    pdfBytes instanceof ArrayBuffer
      ? new Uint8Array(pdfBytes)
      : Uint8Array.from(pdfBytes);
  return { pdfName, bytes: converted };
}

export async function bytesForStandaloneViewer(
  name: string,
  bytes: Uint8Array,
): Promise<{ name: string; bytes: Uint8Array }> {
  if (isCadDrawingBasename(name)) {
    const converted = await convertCadBytesToPdf(name, bytes);
    return { name: converted.pdfName, bytes: converted.bytes };
  }
  return { name, bytes };
}
