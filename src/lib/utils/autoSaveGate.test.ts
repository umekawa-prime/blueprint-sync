import { afterEach, describe, expect, it, vi } from "vitest";
import { createAutoSaver } from "./autoSave";
import {
  isAutoSaveSuspended,
  registerAutoSaveController,
  withAutoSaveSuspended,
} from "./autoSaveGate";

function wire(save: () => Promise<boolean>, dirty: () => boolean = () => true) {
  const saver = createAutoSaver({
    save: async () => (isAutoSaveSuspended() || !dirty() ? true : save()),
  });
  const off = registerAutoSaveController({
    suspend: async () => {
      saver.cancel();
      await saver.idle();
    },
    resume: () => {
      if (dirty()) saver.schedule();
    },
  });
  return { saver, off };
}

describe("withAutoSaveSuspended", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs fn directly with no controller", async () => {
    expect(await withAutoSaveSuspended(async () => 3)).toBe(3);
  });

  it("cancels a pending timer so nothing is written during fn", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(true);
    const { saver, off } = wire(save);
    saver.schedule();
    await withAutoSaveSuspended(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      expect(save).not.toHaveBeenCalled();
    });
    off();
    saver.dispose();
  });

  it("awaits an in-flight save before running fn", async () => {
    vi.useFakeTimers();
    let finish!: (v: boolean) => void;
    const save = vi.fn().mockImplementation(() => new Promise<boolean>((r) => (finish = r)));
    const { saver, off } = wire(save);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    const order: string[] = [];
    const run = withAutoSaveSuspended(async () => {
      order.push("fn");
    });
    await Promise.resolve();
    expect(order).toEqual([]);
    finish(true);
    await run;
    expect(order).toEqual(["fn"]);
    off();
    saver.dispose();
  });

  it("supports nesting without deadlock", async () => {
    const out = await withAutoSaveSuspended(async () =>
      withAutoSaveSuspended(async () => {
        expect(isAutoSaveSuspended()).toBe(true);
        return "ok";
      }),
    );
    expect(out).toBe("ok");
    expect(isAutoSaveSuspended()).toBe(false);
  });

  it("reschedules on resume when dirty", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(true);
    const { saver, off } = wire(save);
    await withAutoSaveSuspended(async () => {});
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(1);
    off();
    saver.dispose();
  });

  it("skips the write when not dirty", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(true);
    const { saver, off } = wire(save, () => false);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    off();
    saver.dispose();
  });
});
