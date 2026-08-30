import { isTauriRuntime } from "./platform";

export async function openPdfFromDisk(): Promise<{
  name: string;
  bytes: Uint8Array;
} | null> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await invoke<{ name: string; bytes: number[] } | null>(
      "pick_pdf_file",
    );
    if (!selected) {
      return null;
    }
    return { name: selected.name, bytes: Uint8Array.from(selected.bytes) };
  }

  return pickFileInBrowser("application/pdf");
}

export async function savePdfToDisk(
  bytes: Uint8Array,
  defaultName: string,
): Promise<boolean> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>("save_pdf_file", {
      defaultName,
      bytes,
    });
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

async function pickFileInBrowser(
  accept: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve({ name: file.name, bytes: await readFileAsBytes(file) });
    };
    input.click();
  });
}
