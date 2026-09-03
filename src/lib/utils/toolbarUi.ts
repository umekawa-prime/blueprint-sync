const TOOLBAR_BTN_BASE =
  "rounded-md border px-[0.7rem] py-[0.35rem] text-xs touch-manipulation";

export function toolbarToolClass(active: boolean): string {
  if (active) {
    return `${TOOLBAR_BTN_BASE} border-cyan-400 bg-cyan-950 text-cyan-200`;
  }
  return `${TOOLBAR_BTN_BASE} border-slate-700 bg-slate-800 text-slate-200 hover:border-cyan-400 hover:text-cyan-200`;
}
