import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireFolderLock, releaseFolderLock } from "./folderLock";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function installMemoryLocks() {
  const held = new Set<string>();
  const locks = {
    request: vi.fn(
      async (
        name: string,
        _opts: { ifAvailable: boolean },
        cb: (lock: object | null) => Promise<void>,
      ) => {
        if (held.has(name)) {
          return cb(null);
        }
        held.add(name);
        try {
          return await cb({});
        } finally {
          held.delete(name);
        }
      },
    ),
  };
  vi.stubGlobal("navigator", { locks });
  return locks;
}

describe("folderLock", () => {
  beforeEach(() => {
    installMemoryLocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets only one holder lock a folder until released", async () => {
    const first = await acquireFolderLock("fsa://r1");
    expect(first).not.toBeNull();
    expect(await acquireFolderLock("fsa://r1/")).toBeNull();
    first!.release();
    await flush();
    expect(await acquireFolderLock("fsa://r1")).not.toBeNull();
    releaseFolderLock("fsa://r1");
  });

  it("releases a held lock by folder path", async () => {
    expect(await acquireFolderLock("fsa://r2")).not.toBeNull();
    releaseFolderLock("fsa://r2/");
    await flush();
    expect(await acquireFolderLock("fsa://r2")).not.toBeNull();
    releaseFolderLock("fsa://r2");
  });

  it("always succeeds when navigator.locks is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const a = await acquireFolderLock("fsa://r3");
    const b = await acquireFolderLock("fsa://r3");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
});
