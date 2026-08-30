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

function parseLink(value: unknown): ProjectLink {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.url !== "string"
  ) {
    throw new Error("Invalid project.json");
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
    links: parsed.links.map(parseLink),
  };
}

export function serializeProjectJson(meta: ProjectMeta): string {
  return JSON.stringify(meta, null, 2);
}

export function createProjectMeta(name: string, now = new Date()): ProjectMeta {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "無題プロジェクト",
    createdAt: now.toISOString(),
    links: [],
  };
}

export function annotationFileName(pdfName: string): string {
  if (
    !pdfName ||
    pdfName.includes("/") ||
    pdfName.includes("\\") ||
    pdfName.includes("..") ||
    !pdfName.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Invalid annotation file name");
  }
  return `${pdfName}.json`;
}

export function listPdfFileNames(names: string[]): string[] {
  return names
    .filter((name) => name.toLowerCase().endsWith(".pdf") && !name.startsWith("."))
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
