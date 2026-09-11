export type ProjectLink = {
  id: string;
  title: string;
  url: string;
};

export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: string;
  links: ProjectLink[];
};

export type RecentProject = {
  id?: string;
  name: string;
  path: string;
};

export function isAllowedLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLink(value: unknown): ProjectLink | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.url !== "string" ||
    !isAllowedLinkUrl(value.url)
  ) {
    return null;
  }
  return { id: value.id, title: value.title, url: value.url };
}

export function parseProjectJson(raw: string): ProjectMeta {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid project.json");
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.name !== "string" ||
    typeof parsed.createdAt !== "string" ||
    !Array.isArray(parsed.links)
  ) {
    throw new Error("Invalid project.json");
  }
  return {
    id: parsed.id,
    name: parsed.name,
    createdAt: parsed.createdAt,
    links: parsed.links.map(parseLink).filter((link): link is ProjectLink => link !== null),
  };
}

export function serializeProjectJson(meta: ProjectMeta): string {
  return JSON.stringify(meta, null, 2);
}

export function folderDisplayName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  const last = parts.at(-1) ?? "";
  return last || "無題プロジェクト";
}

export function createProjectMeta(name: string, now = new Date()): ProjectMeta {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "無題プロジェクト",
    createdAt: now.toISOString(),
    links: [],
  };
}

export type ProjectPdfKind = "drawing" | "schedule" | "cad";

export const PROJECT_PDF_DIRS: Record<ProjectPdfKind, string> = {
  drawing: "図面",
  schedule: "工程表",
  cad: "図面JWW",
};

function normalizeRelPath(relPath: string): string {
  return relPath.replaceAll("\\", "/");
}

export function isProjectPdfBasename(pdfName: string): boolean {
  return Boolean(
    pdfName &&
      pdfName.toLowerCase().endsWith(".pdf") &&
      !pdfName.startsWith(".") &&
      !pdfName.includes("/") &&
      !pdfName.includes("\\") &&
      !pdfName.includes(".."),
  );
}

function isCadSourceBasename(name: string): boolean {
  const lower = name.toLowerCase();
  return Boolean(
    name &&
      (lower.endsWith(".jww") || lower.endsWith(".jwc")) &&
      !name.startsWith(".") &&
      !name.includes("/") &&
      !name.includes("\\") &&
      !name.includes(".."),
  );
}

export function isProjectCadRelPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === PROJECT_PDF_DIRS.cad && isCadSourceBasename(parts[1]);
}

export function isProjectFileRelPath(relPath: string): boolean {
  return isProjectPdfRelPath(relPath) || isProjectCadRelPath(relPath);
}

export function listCadFiles(names: string[]): string[] {
  return names.filter((name) => isProjectCadRelPath(name));
}

export function listSidebarCadFiles(names: string[]): string[] {
  return names.filter(
    (name) => isProjectCadRelPath(name) || (isProjectPdfRelPath(name) && projectPdfKind(name) === "cad"),
  );
}

export function pairedDrawingPdfRelPath(relPath: string): string | null {
  if (!isProjectCadRelPath(relPath)) {
    return null;
  }
  const pdfName = projectPdfDisplayName(relPath).replace(/\.(jww|jwc)$/i, ".pdf");
  return joinProjectPdfRelPath("drawing", pdfName);
}

export function projectRenameStem(relPath: string): string {
  return projectFileStem(projectPdfDisplayName(relPath));
}

function projectFileExtension(basename: string): string | null {
  const match = basename.match(/\.(pdf|jww|jwc)$/i);
  return match ? match[0] : null;
}

function projectFileStem(basename: string): string {
  return basename.replace(/\.(pdf|jww|jwc)$/i, "");
}

export function renamedProjectRelPath(relPath: string, nextName: string): string | null {
  if (!isProjectFileRelPath(relPath)) {
    return null;
  }
  const display = projectPdfDisplayName(relPath);
  const ext = projectFileExtension(display);
  if (!ext) {
    return null;
  }
  let stem = nextName.trim();
  const typedExt = projectFileExtension(stem);
  if (typedExt) {
    if (typedExt.toLowerCase() !== ext.toLowerCase()) {
      return null;
    }
    stem = projectFileStem(stem);
  }
  if (
    !stem ||
    stem.startsWith(".") ||
    stem.includes("/") ||
    stem.includes("\\") ||
    stem.includes("..")
  ) {
    return null;
  }
  const slash = normalizeRelPath(relPath).lastIndexOf("/");
  const dir = slash >= 0 ? normalizeRelPath(relPath).slice(0, slash) : "";
  const nextBase = `${stem}${ext}`;
  return dir ? `${dir}/${nextBase}` : nextBase;
}

export function isProjectPdfRelPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 1) {
    return isProjectPdfBasename(parts[0]);
  }
  if (parts.length === 2) {
    return (
      (parts[0] === PROJECT_PDF_DIRS.drawing ||
        parts[0] === PROJECT_PDF_DIRS.schedule ||
        parts[0] === PROJECT_PDF_DIRS.cad) &&
      isProjectPdfBasename(parts[1])
    );
  }
  return false;
}

export function projectPdfKind(relPath: string): ProjectPdfKind {
  const normalized = normalizeRelPath(relPath);
  if (normalized.startsWith(`${PROJECT_PDF_DIRS.cad}/`)) {
    return "cad";
  }
  if (normalized.startsWith(`${PROJECT_PDF_DIRS.schedule}/`)) {
    return "schedule";
  }
  return "drawing";
}

export function joinProjectPdfRelPath(kind: ProjectPdfKind, basename: string): string {
  return `${PROJECT_PDF_DIRS[kind]}/${basename}`;
}

export function projectPdfKindDir(projectFolder: string, kind: ProjectPdfKind): string {
  return `${projectFolder}/${PROJECT_PDF_DIRS[kind]}`;
}

export function projectPdfDisplayName(relPath: string): string {
  const parts = normalizeRelPath(relPath).split("/").filter(Boolean);
  return parts.at(-1) ?? relPath;
}

export function listPdfsOfKind(names: string[], kind: ProjectPdfKind): string[] {
  return names.filter((name) => isProjectPdfRelPath(name) && projectPdfKind(name) === kind);
}

export function annotationFileName(pdfName: string): string {
  if (!isProjectPdfRelPath(pdfName)) {
    throw new Error("Invalid annotation file name");
  }
  return `${normalizeRelPath(pdfName).replaceAll("/", "__")}.json`;
}

export function legacyAnnotationFileName(pdfName: string): string {
  if (!isProjectPdfRelPath(pdfName)) {
    throw new Error("Invalid annotation file name");
  }
  return `${normalizeRelPath(pdfName)}.json`;
}

export function listPdfFileNames(names: string[]): string[] {
  return names
    .filter((name) => isProjectPdfBasename(name))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function rememberRecent(
  current: RecentProject[],
  next: RecentProject,
  max = 8,
): RecentProject[] {
  return [next, ...current.filter((item) => item.path !== next.path)].slice(0, max);
}

export function dropRecent(current: RecentProject[], path: string): RecentProject[] {
  return current.filter((item) => item.path !== path);
}

export function displayLinkTitle(link: ProjectLink): string {
  return link.title.trim() || link.url;
}
