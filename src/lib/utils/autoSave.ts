export const AUTO_SAVE_DELAY_MS = 1500;

export type AutoSaveState = "idle" | "saving" | "saved" | "error";

export function createAutoSaver(opts: {
  save: () => Promise<boolean>;
  delayMs?: number;
  onState?: (s: AutoSaveState) => void;
}) {
  const delayMs = opts.delayMs ?? AUTO_SAVE_DELAY_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let disposed = false;

  async function runOnce(): Promise<void> {
    opts.onState?.("saving");
    let ok = false;
    try {
      ok = await opts.save();
    } catch {
      ok = false;
    }
    opts.onState?.(ok ? "saved" : "error");
  }

  function start(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await runOnce();
        } while (again && !disposed);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    schedule() {
      if (disposed) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void start();
      }, delayMs);
    },
    async flush() {
      if (timer !== null) {
        clearTimer();
        await start();
        return;
      }
      if (running) await running;
    },
    /** Drop a waiting timer without saving. */
    cancel() {
      clearTimer();
    },
    /** Resolves once no save is in flight. */
    async idle() {
      while (running) await running;
    },
    get pending() {
      return timer !== null || running !== null;
    },
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}
