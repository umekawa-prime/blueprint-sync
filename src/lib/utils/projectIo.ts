import { invoke } from "@tauri-apps/api/core";
import {
  annotationFileName,
  parseProjectJson,
  serializeProjectJson,
  type ProjectMeta,
  type RecentProject,
} from "./projectFormat";
import { parseAnnotations, serializeAnnotations } from "./annotationPersist";
import type { PageObjects } from "./annotationPersist";
import { isTauriRuntime, usesRfdFileDialog } from "./platform";

export async function pickFolder(): Promise<string | null> {
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
  await invoke("init_project_dir", { folder });
}

export async function listProjectPdfs(folder: string): Promise<string[]> {
  return invoke<string[]>("list_project_pdfs", { folder });
}

export async function copyFileIntoFolder(source: string, folder: string): Promise<string> {
  return invoke<string>("copy_file_into_folder", { source, folder });
}

export async function loadRecentProjects(): Promise<RecentProject[]> {
  return invoke<RecentProject[]>("load_recent_projects");
}

export async function saveRecentProjects(items: RecentProject[]): Promise<void> {
  await invoke("save_recent_projects", { items });
}

export async function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

export async function readTextFile(path: string): Promise<string> {
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  await invoke("write_file_bytes", {
    path,
    bytes: Array.from(new TextEncoder().encode(text)),
  });
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  return Uint8Array.from(bytes);
}

export function projectJsonPath(folder: string): string {
  return `${folder}/.blueprint-sync/project.json`;
}

export function annotationPath(folder: string, pdfName: string): string {
  return `${folder}/.blueprint-sync/annotations/${annotationFileName(pdfName)}`;
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
  if (!(await pathExists(path))) {
    return {};
  }
  return parseAnnotations(await readTextFile(path));
}

export async function writeAnnotationFile(
  folder: string,
  pdfName: string,
  byPage: Record<number, PageObjects>,
): Promise<void> {
  await writeTextFile(annotationPath(folder, pdfName), serializeAnnotations(byPage));
}
