/**
 * Lets flows that switch the active drawing/project (or move/delete annotation
 * files) hold autosave off. Without a registered controller (native, tests)
 * it just runs the function.
 */
export interface AutoSaveController {
  /** Cancel any pending timer and wait for an in-flight save. */
  suspend(): Promise<void>;
  /** Called once the outermost suspension ends. */
  resume(): void;
}

let controller: AutoSaveController | null = null;
let depth = 0;
let suspending: Promise<void> = Promise.resolve();

export function registerAutoSaveController(next: AutoSaveController): () => void {
  controller = next;
  return () => {
    if (controller === next) {
      controller = null;
    }
  };
}

export function isAutoSaveSuspended(): boolean {
  return depth > 0;
}

export async function withAutoSaveSuspended<T>(fn: () => Promise<T>): Promise<T> {
  depth += 1;
  const active = controller;
  try {
    if (depth === 1) {
      suspending = active ? active.suspend() : Promise.resolve();
    }
    await suspending;
    return await fn();
  } finally {
    depth -= 1;
    if (depth === 0) {
      active?.resume();
    }
  }
}
