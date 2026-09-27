import { isProjectFileRelPath, projectPdfDisplayName } from "./projectFormat";

export type FileSearchOpenPlan =
  | { kind: "project"; relPath: string }
  | { kind: "cad"; relPath: string }
  | { kind: "external"; relPath: string };

function normalizeRelPath(relPath: string): string {
  return relPath.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function isSearchableProjectFile(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts[0] === ".blueprint-sync") {
    return false;
  }
  return parts.every((part) => part !== "." && part !== ".." && !part.startsWith(".") && part !== "__MACOSX");
}

export function filterProjectFileNames(files: string[], query: string): string[] {
  const pool = files.map(normalizeRelPath).filter(isSearchableProjectFile);
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matched =
    tokens.length === 0
      ? pool
      : pool.filter((rel) => {
          const name = (rel.split("/").pop() ?? rel).toLowerCase();
          const haystack = `${name}\n${rel.toLowerCase()}`;
          return tokens.every((token) => haystack.includes(token));
        });
  return [...matched].sort((a, b) => a.localeCompare(b, "ja"));
}

function isCadRelPath(relPath: string): boolean {
  const name = relPath.split("/").pop() ?? relPath;
  return /\.(jww|jwc|dxf|dfx)$/i.test(name);
}

export function fileSearchOpenPlan(relPath: string): FileSearchOpenPlan | null {
  const normalized = normalizeRelPath(relPath);
  if (!isSearchableProjectFile(normalized)) {
    return null;
  }
  if (isProjectFileRelPath(normalized)) {
    return { kind: "project", relPath: normalized };
  }
  if (isCadRelPath(normalized)) {
    return { kind: "cad", relPath: normalized };
  }
  return { kind: "external", relPath: normalized };
}

export function projectFileAbsolutePath(folder: string, relPath: string): string | null {
  const plan = fileSearchOpenPlan(relPath);
  if (!plan) {
    return null;
  }
  const root = folder.replace(/[/\\]+$/, "");
  if (!root) {
    return null;
  }
  return `${root}/${plan.relPath}`;
}

export function fileSearchLabel(relPath: string): { name: string; folder: string } {
  const normalized = normalizeRelPath(relPath);
  const name = projectPdfDisplayName(normalized);
  const slash = normalized.lastIndexOf("/");
  return { name, folder: slash >= 0 ? normalized.slice(0, slash) : "" };
}
