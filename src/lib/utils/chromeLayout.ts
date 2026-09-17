export const PHONE_MAX_WIDTH = 767;

export const SAFE_AREA_PADDING_STYLE = {
  paddingTop: "env(safe-area-inset-top, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  paddingLeft: "env(safe-area-inset-left, 0px)",
} as const;

export function safeAreaPaddingCss(
  style: typeof SAFE_AREA_PADDING_STYLE = SAFE_AREA_PADDING_STYLE,
): string {
  return [
    `padding-top:${style.paddingTop}`,
    `padding-right:${style.paddingRight}`,
    `padding-bottom:${style.paddingBottom}`,
    `padding-left:${style.paddingLeft}`,
  ].join(";");
}

export function isPhoneWidth(width: number): boolean {
  return width <= PHONE_MAX_WIDTH;
}

export function isTabletWidth(width: number): boolean {
  return width > PHONE_MAX_WIDTH;
}

export const CAMERA_OVERLAY_CLASS =
  "fixed inset-0 z-[80] flex items-center justify-center bg-slate-950 p-4";

export function drawingLayerHiddenClass(cameraOpen: boolean): string {
  return cameraOpen ? "hidden" : "";
}

export function pageSidebarClass(isPhone: boolean): string {
  if (isPhone) {
    return "flex h-28 shrink-0 flex-row gap-2 overflow-x-auto border-t border-slate-700 bg-slate-900 px-2 py-2";
  }
  return "flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto border-r border-slate-700 bg-slate-900 px-2 py-2";
}

export function todoPanelClass(isPhone: boolean): string {
  if (isPhone) {
    return "absolute inset-0 z-30 flex flex-col bg-[#2c333a] text-slate-100";
  }
  return "flex h-full min-h-0 w-full flex-col border-l border-slate-700 bg-[#2c333a] text-slate-100";
}

export type SidebarSide = "left" | "right";

export const SIDEBAR_RAIL_WIDTH = 28;
export const SIDEBAR_COLLAPSE_WIDTH = 80;

export const PROJECT_SIDEBAR_WIDTH = { default: 288, min: 200, max: 480 } as const;
export const PAGE_SIDEBAR_WIDTH = { default: 144, min: 96, max: 280 } as const;
export const TODO_PANEL_WIDTH = { default: 352, min: 240, max: 560 } as const;

export type ChromeTodoTab = "todo" | "note";

export type ChromeLayoutState = {
  projectOpen: boolean;
  projectWidth: number;
  pageOpen: boolean;
  pageWidth: number;
  todoOpen: boolean;
  todoWidth: number;
  todoTab: ChromeTodoTab;
};

export const DEFAULT_CHROME_LAYOUT: ChromeLayoutState = {
  projectOpen: true,
  projectWidth: PROJECT_SIDEBAR_WIDTH.default,
  pageOpen: true,
  pageWidth: PAGE_SIDEBAR_WIDTH.default,
  todoOpen: false,
  todoWidth: TODO_PANEL_WIDTH.default,
  todoTab: "todo",
};

export const CHROME_LAYOUT_STORAGE_KEY = "blueprint-sync.chromeLayout";

export function clampSidebarWidth(width: number, min: number, max: number): number {
  if (!Number.isFinite(width)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(width)));
}

export function sidebarLayoutAfterDrag(
  startWidth: number,
  startX: number,
  currentX: number,
  side: SidebarSide,
  min: number,
  max: number,
): { open: boolean; width: number } {
  const raw = side === "left" ? startWidth + (currentX - startX) : startWidth - (currentX - startX);
  if (raw < SIDEBAR_COLLAPSE_WIDTH) {
    return { open: false, width: startWidth };
  }
  return { open: true, width: clampSidebarWidth(raw, min, max) };
}

export function sidebarFrameStyle(open: boolean, width: number): string {
  return `width:${open ? width : SIDEBAR_RAIL_WIDTH}px`;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readWidth(value: unknown, fallback: number, min: number, max: number): number {
  return clampSidebarWidth(typeof value === "number" ? value : fallback, min, max);
}

function readTodoTab(value: unknown): ChromeTodoTab {
  return value === "note" ? "note" : "todo";
}

export function parseChromeLayout(raw: string | null): ChromeLayoutState {
  if (!raw) {
    return { ...DEFAULT_CHROME_LAYOUT };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_CHROME_LAYOUT };
    }
    const value = parsed as Record<string, unknown>;
    return {
      projectOpen: readBoolean(value.projectOpen, DEFAULT_CHROME_LAYOUT.projectOpen),
      projectWidth: readWidth(
        value.projectWidth,
        DEFAULT_CHROME_LAYOUT.projectWidth,
        PROJECT_SIDEBAR_WIDTH.min,
        PROJECT_SIDEBAR_WIDTH.max,
      ),
      pageOpen: readBoolean(value.pageOpen, DEFAULT_CHROME_LAYOUT.pageOpen),
      pageWidth: readWidth(
        value.pageWidth,
        DEFAULT_CHROME_LAYOUT.pageWidth,
        PAGE_SIDEBAR_WIDTH.min,
        PAGE_SIDEBAR_WIDTH.max,
      ),
      todoOpen: readBoolean(value.todoOpen, DEFAULT_CHROME_LAYOUT.todoOpen),
      todoWidth: readWidth(
        value.todoWidth,
        DEFAULT_CHROME_LAYOUT.todoWidth,
        TODO_PANEL_WIDTH.min,
        TODO_PANEL_WIDTH.max,
      ),
      todoTab: readTodoTab(value.todoTab),
    };
  } catch {
    return { ...DEFAULT_CHROME_LAYOUT };
  }
}

export function serializeChromeLayout(state: ChromeLayoutState): string {
  return JSON.stringify({
    projectOpen: state.projectOpen,
    projectWidth: clampSidebarWidth(
      state.projectWidth,
      PROJECT_SIDEBAR_WIDTH.min,
      PROJECT_SIDEBAR_WIDTH.max,
    ),
    pageOpen: state.pageOpen,
    pageWidth: clampSidebarWidth(state.pageWidth, PAGE_SIDEBAR_WIDTH.min, PAGE_SIDEBAR_WIDTH.max),
    todoOpen: state.todoOpen,
    todoWidth: clampSidebarWidth(state.todoWidth, TODO_PANEL_WIDTH.min, TODO_PANEL_WIDTH.max),
    todoTab: readTodoTab(state.todoTab),
  });
}
