import { usesRfdFileDialog } from "./platform";

export async function openPdfFromDisk(): Promise<{
  name: string;
  bytes: Uint8Array;
  path?: string;
} | null> {
  if (usesRfdFileDialog()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await invoke<{
      name: string;
      path: string;
      bytes: number[];
    } | null>("pick_pdf_file");
    if (!selected) {
      return null;
    }
    return {
      name: selected.name,
      path: selected.path,
      bytes: Uint8Array.from(selected.bytes),
    };
  }

  return pickFileInBrowser(".pdf,.zip,application/pdf,application/zip");
}

export async function savePdfToDisk(
  bytes: Uint8Array,
  defaultName: string,
  defaultDir?: string,
): Promise<boolean> {
  if (usesRfdFileDialog()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>("save_pdf_file", {
      defaultName,
      bytes,
      defaultDir: defaultDir ?? null,
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

export async function pickImageFromDisk(): Promise<{
  name: string;
  bytes: Uint8Array;
  path?: string;
} | null> {
  if (usesRfdFileDialog()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await invoke<{
      name: string;
      path: string;
      bytes: number[];
    } | null>("pick_image_file");
    if (!selected) {
      return null;
    }
    return {
      name: selected.name,
      path: selected.path,
      bytes: Uint8Array.from(selected.bytes),
    };
  }

  return pickFileInBrowser("image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp");
}

export function imageMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".bmp")) {
    return "image/bmp";
  }
  return "image/jpeg";
}

export function imageBlobFromPicked(picked: { name: string; bytes: Uint8Array }): Blob {
  return new Blob([picked.bytes], { type: imageMimeFromName(picked.name) });
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
