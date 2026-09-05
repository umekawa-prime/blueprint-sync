import { unzipSync, zipSync } from "fflate";
import { parseProjectJson, type ProjectMeta } from "./projectFormat";

export const BPSYNC_SUFFIX = ".bpsync.zip";

export type UnpackProjectResult =
  | { kind: "project"; meta: ProjectMeta; files: Record<string, Uint8Array> }
  | { kind: "pdfs" }
  | { kind: "invalid"; reason: string };

export function sanitizeShareBaseName(name: string): string {
  const cleaned = name.replace(/[/\\:\0-\x1f]/g, "").trim();
  return cleaned || "project";
}

export function bpsyncFileName(projectName: string): string {
  return `${sanitizeShareBaseName(projectName)}${BPSYNC_SUFFIX}`;
}

export function isSafeProjectZipPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.endsWith("/") ||
    normalized.startsWith("/") ||
    normalized.includes("..")
  ) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    return false;
  }
  return parts.every((part) => part === ".blueprint-sync" || !part.startsWith(".")) &&
    !parts.includes("__MACOSX");
}

export function packProjectZip(files: Record<string, Uint8Array>): Uint8Array {
  const zipped: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (!isSafeProjectZipPath(path)) {
      continue;
    }
    zipped[path] = bytes;
  }
  return zipSync(zipped);
}

export function unpackProjectZip(bytes: Uint8Array): UnpackProjectResult {
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(bytes);
  } catch {
    return { kind: "invalid", reason: "ZIPが壊れています" };
  }

  const files: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(extracted)) {
    const normalized = path.replaceAll("\\", "/");
    if (!normalized || normalized.endsWith("/")) {
      continue;
    }
    if (normalized.includes("..")) {
      return { kind: "invalid", reason: "ZIPのパスが不正です" };
    }
    if (!isSafeProjectZipPath(normalized)) {
      continue;
    }
    files[normalized] = data;
  }

  const metaBytes = files[".blueprint-sync/project.json"];
  if (!metaBytes) {
    return { kind: "pdfs" };
  }
  try {
    const meta = parseProjectJson(new TextDecoder().decode(metaBytes));
    return { kind: "project", meta, files };
  } catch {
    return {
      kind: "invalid",
      reason: "project.json が見つからないか、内容が不正です",
    };
  }
}
