import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPathExists, mockReadTextFile, mockWriteTextFile } = vi.hoisted(() => ({
  mockPathExists: vi.fn(),
  mockReadTextFile: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

vi.mock("./projectIo", () => ({
  pathExists: mockPathExists,
  readTextFile: mockReadTextFile,
  writeTextFile: mockWriteTextFile,
}));

import { projectStore } from "$lib/stores/projectStore.svelte";
import { todoStore } from "$lib/stores/todoStore.svelte";
import {
  addProjectTodo,
  loadProjectTodos,
  removeProjectTodo,
  resetTodoState,
  updateProjectTodo,
} from "./todoActions";

describe("todoActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTodoState();
    projectStore.reset();
    projectStore.folder = "/work/現場A";
    projectStore.meta = {
      id: "p1",
      name: "DemoSite",
      createdAt: "2026-09-14T00:00:00.000Z",
      status: "open",
      links: [],
    };
  });

  it("creates TODO.md when the project has none yet", async () => {
    mockPathExists.mockResolvedValue(false);

    await loadProjectTodos();

    expect(mockWriteTextFile).toHaveBeenCalledWith("/work/現場A/TODO.md", expect.stringContaining("# TODO"));
    expect(todoStore.items).toEqual([]);
  });

  it("loads existing issues and can add, update, and remove them", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(`# TODO

## 未対応
- [ ] DEMOSITE-1 既存課題
`);

    await loadProjectTodos();
    expect(todoStore.items).toHaveLength(1);
    expect(todoStore.items[0]?.title).toBe("既存課題");

    await addProjectTodo("図面確認");
    expect(todoStore.items.map((item) => item.key)).toEqual(["DEMOSITE-1", "DEMOSITE-2"]);
    expect(mockWriteTextFile).toHaveBeenCalled();

    await updateProjectTodo("DEMOSITE-2", { status: "in_progress", due: "2026-09-30" });
    expect(todoStore.items[1]).toMatchObject({
      status: "in_progress",
      due: "2026-09-30",
    });

    await removeProjectTodo("DEMOSITE-1");
    expect(todoStore.items.map((item) => item.key)).toEqual(["DEMOSITE-2"]);
  });
});
