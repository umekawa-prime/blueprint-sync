import type { AnnotationFile } from "$lib/utils/annotationPersist";
import type { EditHistory } from "$lib/utils/editHistory";
import type { ProjectMeta } from "$lib/utils/projectFormat";
import { normalizeFsPath } from "$lib/utils/projectMove";

export type TabPdfState = {
  name: string;
  bytes: Uint8Array | null;
  pageIndex: number;
  zoom: number;
  status: string;
};

export type TabSession = {
  folder: string;
  meta: ProjectMeta | null;
  pdfs: string[];
  currentPdf: string;
  error: string;
  annotations: AnnotationFile;
  history: EditHistory;
  pdf: TabPdfState;
};

export type ProjectTab = {
  id: string;
  folder: string;
  name: string;
  session: TabSession | null;
};

export function sameProjectFolder(a: string, b: string): boolean {
  return normalizeFsPath(a) === normalizeFsPath(b);
}

export function findTabByFolder(tabs: ProjectTab[], folder: string): ProjectTab | undefined {
  return tabs.find((tab) => sameProjectFolder(tab.folder, folder));
}

export function createProjectTab(input: {
  id: string;
  folder: string;
  name: string;
  session?: TabSession | null;
}): ProjectTab {
  return {
    id: input.id,
    folder: input.folder,
    name: input.name,
    session: input.session ?? null,
  };
}

export function rememberLiveTab(
  tabs: ProjectTab[],
  activeTabId: string | null,
  session: TabSession,
): ProjectTab[] {
  if (!activeTabId) {
    return tabs;
  }
  return tabs.map((tab) => (tab.id === activeTabId ? { ...tab, session } : tab));
}

export function closeTabList(
  tabs: ProjectTab[],
  closingId: string,
  activeTabId: string | null,
): { tabs: ProjectTab[]; nextActiveId: string | null; closedLast: boolean } {
  const index = tabs.findIndex((tab) => tab.id === closingId);
  if (index < 0) {
    return { tabs, nextActiveId: activeTabId, closedLast: false };
  }
  const nextTabs = tabs.filter((tab) => tab.id !== closingId);
  if (nextTabs.length === 0) {
    return { tabs: [], nextActiveId: null, closedLast: true };
  }
  if (activeTabId !== closingId) {
    return { tabs: nextTabs, nextActiveId: activeTabId, closedLast: false };
  }
  const neighbor = tabs[index + 1] ?? tabs[index - 1];
  return { tabs: nextTabs, nextActiveId: neighbor.id, closedLast: false };
}
