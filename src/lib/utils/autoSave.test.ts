import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutoSaver } from "./autoSave";

describe("createAutoSaver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid changes into one save after the delay", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const saver = createAutoSaver({ save });
    saver.schedule();
    vi.advanceTimersByTime(1000);
    saver.schedule();
    vi.advanceTimersByTime(1499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("runs one more save when changes arrive during a save", async () => {
    let finish!: (v: boolean) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>((r) => (finish = r)))
      .mockResolvedValue(true);
    const saver = createAutoSaver({ save });
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(1);
    finish(true);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("reports failure and stays dirty", async () => {
    const states: string[] = [];
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const saver = createAutoSaver({ save, onState: (s) => states.push(s) });
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    expect(states).toEqual(["saving", "error"]);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    expect(states.at(-1)).toBe("saved");
  });

  it("treats a thrown save as an error", async () => {
    const states: string[] = [];
    const save = vi.fn().mockRejectedValue(new Error("boom"));
    const saver = createAutoSaver({ save, onState: (s) => states.push(s) });
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    expect(states).toEqual(["saving", "error"]);
  });

  it("flush saves immediately and waits for completion", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const saver = createAutoSaver({ save });
    saver.schedule();
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.pending).toBe(false);
  });

  it("dispose cancels the timer", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const saver = createAutoSaver({ save });
    saver.schedule();
    saver.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
