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

function hasCadExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jww") ||
    lower.endsWith(".jwc") ||
    lower.endsWith(".dxf") ||
    lower.endsWith(".dfx")
  );
}

export function isCadDrawingBasename(name: string): boolean {
  return isSafeBasename(name) && hasCadExtension(name);
}

export function cadPdfBasename(name: string): string | null {
  if (!isCadDrawingBasename(name)) {
    return null;
  }
  return name.replace(/\.(jww|jwc|dxf|dfx)$/i, ".pdf");
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
    throw new Error("CAD の変換はデスクトップ版で行えます");
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

export async function openCadFileInJwCad(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Jw_cad は Windows のデスクトップ版で開けます");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_cad_in_jwcad", { path });
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
