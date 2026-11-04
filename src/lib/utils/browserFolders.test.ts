import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDirectory, readMemoryTree, setPermission } from "./testing/memoryDirectoryHandle";
import {
  browserFolderName,
  browserFs,
  clearHandleCacheForTest,
  folderAccess,
  loadWebValue,
  pickBrowserFolder,
  registerRootHandle,
  resolveRootHandle,
  resetBrowserFoldersForTest,
  saveWebValue,
} from "./browserFolders";

describe("browserFolders", () => {
  beforeEach(async () => {
    await resetBrowserFoldersForTest();
  });

  it("registers a handle and resolves it by its virtual path", async () => {
    const root = createMemoryDirectory("現場A");
    const path = await registerRootHandle(root);
    expect(path).toMatch(/^fsa:\/\/[0-9a-f-]{36}$/);
    expect(await browserFolderName(path)).toBe("現場A");
    expect(await browserFolderName(`${path}/子`)).toBe("子");
    await browserFs.writeBytes(`${path}/x.txt`, new TextEncoder().encode("x"));
    expect(await readMemoryTree(root)).toEqual({ "x.txt": "x" });
  });

  it("reports prompt without requesting, and requests when asked", async () => {
    const root = createMemoryDirectory();
    const path = await registerRootHandle(root);
    setPermission(root, "prompt");
    expect(await folderAccess(path, false)).toBe("prompt");
    setPermission(root, "prompt", { onRequest: "granted" });
    expect(await folderAccess(path, true)).toBe("granted");
    expect(await folderAccess("fsa://00000000-0000-0000-0000-000000000000", false)).toBe("missing");
  });

  it("round-trips recents and session", async () => {
    expect(await loadWebValue("recents", [])).toEqual([]);
    await saveWebValue("recents", [{ name: "A", path: "fsa://x" }]);
    expect(await loadWebValue("recents", [])).toEqual([{ name: "A", path: "fsa://x" }]);
  });

  it("returns null when the folder dialog is cancelled", async () => {
    window.showDirectoryPicker = vi.fn().mockRejectedValue(new DOMException("x", "AbortError"));
    expect(await pickBrowserFolder()).toBeNull();
  });

  it("resolves a persisted handle from IndexedDB after the cache is cleared", async () => {
    const clonable = { kind: "directory", name: "保存済み" } as unknown as FileSystemDirectoryHandle;
    const path = await registerRootHandle(clonable);
    clearHandleCacheForTest();
    const rootId = path.slice("fsa://".length);
    const resolved = await resolveRootHandle(rootId);
    expect(resolved).not.toBe(clonable);
    expect(resolved.name).toBe("保存済み");
    expect(await browserFolderName(path)).toBe("保存済み");
  });

  it("rejects for an unknown root id", async () => {
    await expect(resolveRootHandle("unknown-id")).rejects.toThrow(
      "フォルダが見つかりません。もう一度選んでください",
    );
  });

  it("propagates non-clone persistence errors", async () => {
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      await expect(registerRootHandle(createMemoryDirectory())).rejects.toThrow("full");
    } finally {
      spy.mockRestore();
    }
  });
});
