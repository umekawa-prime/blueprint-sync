import { dxfDocumentToPdf, type DxfDocumentJson } from "./dxfToPdf";
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

export async function parseCadToDxf(bytes: Uint8Array): Promise<DxfDocumentJson> {
  if (!isTauriRuntime()) {
    throw new Error("JWW/JWC の変換はデスクトップ版で行えます");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DxfDocumentJson>("parse_cad_to_dxf", { bytes: Array.from(bytes) });
}

export async function convertCadBytesToPdf(
  name: string,
  bytes: Uint8Array,
): Promise<{ pdfName: string; bytes: Uint8Array }> {
  const pdfName = cadPdfBasename(name);
  if (!pdfName) {
    throw new Error("PDFファイル名が不正です");
  }
  const dxf = await parseCadToDxf(bytes);
  return { pdfName, bytes: await dxfDocumentToPdf(dxf) };
}
