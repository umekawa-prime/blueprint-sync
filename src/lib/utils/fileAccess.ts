import { usesRfdFileDialog } from "./platform";

export type PickedPdf = {
  name: string;
  bytes: Uint8Array;
  path?: string;
};

export async function openPdfsFromDisk(): Promise<PickedPdf[]> {
  if (usesRfdFileDialog()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await invoke<Array<{ name: string; path: string }>>("pick_pdf_files");
    return (selected ?? []).map((item) => ({
      name: item.name,
      path: item.path,
      bytes: new Uint8Array(),
    }));
  }

  return pickFilesInBrowser(".pdf,.zip,application/pdf,application/zip", true);
}

export async function openPdfFromDisk(): Promise<PickedPdf | null> {
  const files = await openPdfsFromDisk();
  return files[0] ?? null;
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

const IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp";

export async function pickImagesFromDisk(): Promise<PickedPdf[]> {
  if (usesRfdFileDialog()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await invoke<Array<{
      name: string;
      path: string;
      bytes: number[];
    }>>("pick_image_files");
    return (selected ?? []).map((item) => ({
      name: item.name,
      path: item.path,
      bytes: Uint8Array.from(item.bytes),
    }));
  }

  return pickFilesInBrowser(IMAGE_ACCEPT, true);
}

export async function pickImageFromDisk(): Promise<PickedPdf | null> {
  const files = await pickImagesFromDisk();
  return files[0] ?? null;
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

export async function pickImportFiles(): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  return pickFilesInBrowser(
    ".pdf,.zip,.bpsync.zip,application/pdf,application/zip",
    true,
  );
}

async function pickFilesInBrowser(
  accept: string,
  multiple: boolean,
): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      const picked = await Promise.all(
        files.map(async (file) => ({ name: file.name, bytes: await readFileAsBytes(file) })),
      );
      resolve(picked);
    };
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}
