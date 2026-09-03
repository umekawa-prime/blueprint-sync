import { isProjectPdfRelPath } from "./projectFormat";

const files = new Map<string, Uint8Array>();
let enabled = false;

export const WEB_DEMO_FOLDER = "/demo";

function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

export function isWebDemo(): boolean {
  return enabled;
}

export function resetWebDemo(): void {
  enabled = false;
  files.clear();
}

export function enableWebDemo(): void {
  enabled = true;
}

export function webPut(path: string, bytes: Uint8Array): void {
  files.set(normalize(path), bytes);
}

export function webReadBytes(path: string): Uint8Array {
  const bytes = files.get(normalize(path));
  if (!bytes) {
    throw new Error(`ファイルがありません: ${path}`);
  }
  return bytes;
}

export function webHas(path: string): boolean {
  return files.has(normalize(path));
}

export function webDelete(path: string): void {
  files.delete(normalize(path));
}

export function webListPdfs(folder: string): string[] {
  const prefix = `${normalize(folder)}/`;
  const names: string[] = [];
  for (const key of files.keys()) {
    if (!key.startsWith(prefix) || !key.toLowerCase().endsWith(".pdf")) {
      continue;
    }
    const rel = key.slice(prefix.length);
    if (isProjectPdfRelPath(rel)) {
      names.push(rel);
    }
  }
  return names.sort((a, b) => a.localeCompare(b, "ja"));
}
