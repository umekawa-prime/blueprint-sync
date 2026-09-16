import { normalizeFsPath } from "./projectMove";

export type OpenSession = {
  folders: string[];
  activeFolder: string | null;
};

function sameFolder(a: string, b: string): boolean {
  return normalizeFsPath(a) === normalizeFsPath(b);
}

export const EMPTY_OPEN_SESSION: OpenSession = { folders: [], activeFolder: null };

function uniqueFolders(folders: string[]): string[] {
  const result: string[] = [];
  for (const folder of folders) {
    const trimmed = folder.trim();
    if (!trimmed) {
      continue;
    }
    if (result.some((existing) => sameFolder(existing, trimmed))) {
      continue;
    }
    result.push(trimmed);
  }
  return result;
}

function activeIfOpen(folders: string[], activeFolder: string | null): string | null {
  if (!activeFolder) {
    return null;
  }
  return folders.find((folder) => sameFolder(folder, activeFolder)) ?? null;
}

export function parseOpenSession(raw: string): OpenSession {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return EMPTY_OPEN_SESSION;
    }
    const foldersRaw = (parsed as { folders?: unknown }).folders;
    const activeRaw = (parsed as { activeFolder?: unknown }).activeFolder;
    const folders = uniqueFolders(
      Array.isArray(foldersRaw)
        ? foldersRaw.filter((item): item is string => typeof item === "string")
        : [],
    );
    const activeFolder = typeof activeRaw === "string" ? activeRaw : null;
    return { folders, activeFolder: activeIfOpen(folders, activeFolder) };
  } catch {
    return EMPTY_OPEN_SESSION;
  }
}

export function serializeOpenSession(session: OpenSession): string {
  return JSON.stringify({
    folders: uniqueFolders(session.folders),
    activeFolder: activeIfOpen(uniqueFolders(session.folders), session.activeFolder),
  });
}

export function captureOpenSession(input: {
  tabs: { folder: string }[];
  activeFolder: string | null;
}): OpenSession {
  const folders = uniqueFolders(input.tabs.map((tab) => tab.folder));
  return {
    folders,
    activeFolder: folders.length === 0 ? null : activeIfOpen(folders, input.activeFolder),
  };
}
