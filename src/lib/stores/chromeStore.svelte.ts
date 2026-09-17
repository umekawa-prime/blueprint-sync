import { todoStore } from "$lib/stores/todoStore.svelte";
import {
  CHROME_LAYOUT_STORAGE_KEY,
  DEFAULT_CHROME_LAYOUT,
  PAGE_SIDEBAR_WIDTH,
  PROJECT_SIDEBAR_WIDTH,
  TODO_PANEL_WIDTH,
  clampSidebarWidth,
  parseChromeLayout,
  serializeChromeLayout,
} from "$lib/utils/chromeLayout";

function readStored() {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_CHROME_LAYOUT };
  }
  return parseChromeLayout(localStorage.getItem(CHROME_LAYOUT_STORAGE_KEY));
}

class ChromeStore {
  projectOpen = $state(DEFAULT_CHROME_LAYOUT.projectOpen);
  projectWidth = $state(DEFAULT_CHROME_LAYOUT.projectWidth);
  pageOpen = $state(DEFAULT_CHROME_LAYOUT.pageOpen);
  pageWidth = $state(DEFAULT_CHROME_LAYOUT.pageWidth);
  todoWidth = $state(DEFAULT_CHROME_LAYOUT.todoWidth);

  constructor() {
    const stored = readStored();
    this.projectOpen = stored.projectOpen;
    this.projectWidth = stored.projectWidth;
    this.pageOpen = stored.pageOpen;
    this.pageWidth = stored.pageWidth;
    this.todoWidth = stored.todoWidth;
    todoStore.panelOpen = stored.todoOpen;
    todoStore.tab = stored.todoTab;
  }

  persist() {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(
      CHROME_LAYOUT_STORAGE_KEY,
      serializeChromeLayout({
        projectOpen: this.projectOpen,
        projectWidth: this.projectWidth,
        pageOpen: this.pageOpen,
        pageWidth: this.pageWidth,
        todoOpen: todoStore.panelOpen,
        todoWidth: this.todoWidth,
        todoTab: todoStore.tab,
      }),
    );
  }

  setProjectOpen(open: boolean) {
    this.projectOpen = open;
    this.persist();
  }

  setProjectWidth(width: number) {
    this.projectWidth = clampSidebarWidth(
      width,
      PROJECT_SIDEBAR_WIDTH.min,
      PROJECT_SIDEBAR_WIDTH.max,
    );
    this.persist();
  }

  setPageOpen(open: boolean) {
    this.pageOpen = open;
    this.persist();
  }

  setPageWidth(width: number) {
    this.pageWidth = clampSidebarWidth(width, PAGE_SIDEBAR_WIDTH.min, PAGE_SIDEBAR_WIDTH.max);
    this.persist();
  }

  setTodoWidth(width: number) {
    this.todoWidth = clampSidebarWidth(width, TODO_PANEL_WIDTH.min, TODO_PANEL_WIDTH.max);
    this.persist();
  }
}

export const chromeStore = new ChromeStore();
