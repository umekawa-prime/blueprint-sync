import type { ProjectMeta, RecentProject } from "$lib/utils/projectFormat";

class ProjectStore {
  folder = $state("");
  meta = $state<ProjectMeta | null>(null);
  pdfs = $state<string[]>([]);
  currentPdf = $state("");
  error = $state("");
  recents = $state<RecentProject[]>([]);

  get isOpen() {
    return Boolean(this.folder && this.meta);
  }

  reset() {
    this.folder = "";
    this.meta = null;
    this.pdfs = [];
    this.currentPdf = "";
    this.error = "";
  }
}

export const projectStore = new ProjectStore();
