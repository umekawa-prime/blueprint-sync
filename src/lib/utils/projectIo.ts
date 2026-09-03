import { invoke } from "@tauri-apps/api/core";
import {
  annotationFileName,
  legacyAnnotationFileName,
  parseProjectJson,
  serializeProjectJson,
  type ProjectMeta,
  type RecentProject,
} from "./projectFormat";
import { parseAnnotations, serializeAnnotations } from "./annotationPersist";
import type { PageObjects } from "./annotationPersist";
import { isTauriRuntime, usesRfdFileDialog } from "./platform";
import { shouldDeleteSourceAfterCopy } from "./projectMove";
import {
  isWebDemo,
  webDelete,
  webHas,
  webListPdfs,
  webPut,
  webReadBytes,
} from "./webDemoFs";

function useWebDemoFs(): boolean {
  return isWebDemo() && !isTauriRuntime();
}

export async function pickFolder(): Promise<string | null> {
  if (useWebDemoFs()) {
    return "/demo";
  }
  if (isTauriRuntime() && !usesRfdFileDialog()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      return typeof selected === "string" ? selected : null;
    } catch {
      return null;
    }
  }
  return invoke<string | null>("pick_folder");
}

export async function initProjectDir(folder: string): Promise<void> {
  if (useWebDemoFs()) {
    return;
  }
  await invoke("init_project_dir", { folder });
}

export async function listProjectPdfs(folder: string): Promise<string[]> {
  if (useWebDemoFs()) {
    return webListPdfs(folder);
  }
  return invoke<string[]>("list_project_pdfs", { folder });
}

export async function copyFileIntoFolder(source: string, folder: string): Promise<string> {
  if (useWebDemoFs()) {
    const name = source.replaceAll("\\", "/").split("/").pop() ?? "file.pdf";
    const dest = `${folder.replace(/\/$/, "")}/${name}`;
    webPut(dest, webReadBytes(source));
    return dest;
  }
  return invoke<string>("copy_file_into_folder", { source, folder });
}

export async function deleteFile(path: string): Promise<void> {
  if (useWebDemoFs()) {
    webDelete(path);
    return;
  }
  await invoke("delete_file", { path });
}

export async function moveFileIntoFolder(source: string, folder: string): Promise<string> {
  const dest = await copyFileIntoFolder(source, folder);
  if (shouldDeleteSourceAfterCopy(source, dest)) {
    try {
      await deleteFile(source);
    } catch {
      // Copy already succeeded; keep the project file even if the original cannot be removed.
    }
  }
  return dest;
}

export async function loadRecentProjects(): Promise<RecentProject[]> {
  if (useWebDemoFs()) {
    return [];
  }
  return invoke<RecentProject[]>("load_recent_projects");
}

export async function saveRecentProjects(items: RecentProject[]): Promise<void> {
  if (useWebDemoFs()) {
    return;
  }
  await invoke("save_recent_projects", { items });
}

export async function pathExists(path: string): Promise<boolean> {
  if (useWebDemoFs()) {
    return webHas(path);
  }
  return invoke<boolean>("path_exists", { path });
}

export async function readTextFile(path: string): Promise<string> {
  if (useWebDemoFs()) {
    return new TextDecoder().decode(webReadBytes(path));
  }
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export async function writeBinaryFile(path: string, bytes: Uint8Array): Promise<void> {
  if (useWebDemoFs()) {
    webPut(path, bytes);
    return;
  }
  await invoke("write_file_bytes", {
    path,
    bytes: Array.from(bytes),
  });
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  await writeBinaryFile(path, new TextEncoder().encode(text));
}

export async function httpGet(url: string): Promise<{
  status: number;
  contentType: string;
  contentDisposition: string;
  bytes: Uint8Array;
}> {
  const raw = await invoke<{
    status: number;
    contentType: string;
    contentDisposition: string;
    bytes: number[];
  }>("http_get", { url });
  return {
    status: raw.status,
    contentType: raw.contentType,
    contentDisposition: raw.contentDisposition,
    bytes: Uint8Array.from(raw.bytes),
  };
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  if (useWebDemoFs()) {
    return webReadBytes(path);
  }
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  return Uint8Array.from(bytes);
}

export function projectJsonPath(folder: string): string {
  return `${folder}/.blueprint-sync/project.json`;
}

export function annotationPath(folder: string, pdfName: string): string {
  return `${folder}/.blueprint-sync/annotations/${annotationFileName(pdfName)}`;
}

export function legacyAnnotationPath(folder: string, pdfName: string): string {
  return `${folder}/.blueprint-sync/annotations/${legacyAnnotationFileName(pdfName)}`;
}

export async function readProjectMeta(folder: string): Promise<ProjectMeta> {
  return parseProjectJson(await readTextFile(projectJsonPath(folder)));
}

export async function writeProjectMeta(folder: string, meta: ProjectMeta): Promise<void> {
  await writeTextFile(projectJsonPath(folder), serializeProjectJson(meta));
}

export async function readAnnotationFile(
  folder: string,
  pdfName: string,
): Promise<Record<number, PageObjects>> {
  const path = annotationPath(folder, pdfName);
  const legacy = legacyAnnotationPath(folder, pdfName);
  if (await pathExists(path)) {
    return parseAnnotations(await readTextFile(path));
  }
  if (legacy !== path && (await pathExists(legacy))) {
    return parseAnnotations(await readTextFile(legacy));
  }
  return {};
}

export async function writeAnnotationFile(
  folder: string,
  pdfName: string,
  byPage: Record<number, PageObjects>,
): Promise<void> {
  await writeTextFile(annotationPath(folder, pdfName), serializeAnnotations(byPage));
}
