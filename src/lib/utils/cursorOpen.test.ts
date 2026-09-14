import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke, mockIsTauri } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockIsTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./platform", () => ({
  isTauriRuntime: () => mockIsTauri(),
}));

import { projectStore } from "$lib/stores/projectStore.svelte";
import { openCurrentProjectInCursor, openFolderInCursor } from "./cursorOpen";

describe("openFolderInCursor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue(undefined);
  });

  it("asks rust to open the project folder in Cursor", async () => {
    await openFolderInCursor("C:/projects/現場A");
    expect(mockInvoke).toHaveBeenCalledWith("open_folder_in_cursor", {
      path: "C:/projects/現場A",
    });
  });

  it("refuses to launch Cursor outside the desktop runtime", async () => {
    mockIsTauri.mockReturnValue(false);
    await expect(openFolderInCursor("C:/projects/現場A")).rejects.toThrow(
      "Cursor で開くのはデスクトップ版で使えます",
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("refuses an empty folder path", async () => {
    await expect(openFolderInCursor("")).rejects.toThrow("プロジェクトが開いていません");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("openCurrentProjectInCursor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue(undefined);
    projectStore.reset();
  });

  it("opens the folder currently loaded in the project store", async () => {
    projectStore.folder = "C:/projects/現場A";
    await openCurrentProjectInCursor();
    expect(mockInvoke).toHaveBeenCalledWith("open_folder_in_cursor", {
      path: "C:/projects/現場A",
    });
  });

  it("refuses when no project is open", async () => {
    await expect(openCurrentProjectInCursor()).rejects.toThrow("プロジェクトが開いていません");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
