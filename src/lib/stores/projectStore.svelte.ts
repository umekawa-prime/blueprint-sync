import type { ProjectMeta, RecentProject } from "$lib/utils/projectFormat";
import type { ProjectTab } from "$lib/utils/projectTabs";

class ProjectStore {
  folder = $state("");
  meta = $state<ProjectMeta | null>(null);
  pdfs = $state<string[]>([]);
  currentPdf = $state("");
  error = $state("");
  recents = $state<RecentProject[]>([]);
  sandboxProjects = $state<RecentProject[]>([]);
  tabs = $state<ProjectTab[]>([]);
  activeTabId = $state<string | null>(null);
  bootstrapped = $state(false);

  get isOpen() {
    return Boolean(this.folder && this.meta);
  }

  reset() {
    this.folder = "";
    this.meta = null;
    this.pdfs = [];
    this.currentPdf = "";
    this.error = "";
    this.tabs = [];
    this.activeTabId = null;
  }
}

export const projectStore = new ProjectStore();
