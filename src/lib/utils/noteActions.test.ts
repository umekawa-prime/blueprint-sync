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
import { noteStore } from "$lib/stores/noteStore.svelte";
import { todoStore } from "$lib/stores/todoStore.svelte";
import { emptyTodoMarkdown } from "./todoMarkdown";
import {
  loadProjectNotes,
  moveProjectNote,
  promoteNoteLine,
  resetNoteState,
  saveProjectNotes,
  splitProjectNote,
  updateProjectNoteText,
} from "./noteActions";
import { loadProjectTodos, resetTodoState } from "./todoActions";

describe("noteActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNoteState();
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

  it("creates NOTE.md when the project has none yet", async () => {
    mockPathExists.mockResolvedValue(false);

    await loadProjectNotes();

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      "/work/現場A/NOTE.md",
      expect.stringContaining("# NOTE"),
    );
    expect(noteStore.lines).toHaveLength(1);
    expect(noteStore.lines[0]?.text).toBe("");
  });

  it("loads existing lines and can update, split, reorder, and save them", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(`# NOTE

- 現場で寸法を確認する
- 明日の朝礼で共有
`);

    await loadProjectNotes();
    expect(noteStore.lines.map((line) => line.text)).toEqual([
      "現場で寸法を確認する",
      "明日の朝礼で共有",
    ]);

    const firstId = noteStore.lines[0]?.id ?? "";
    await updateProjectNoteText(firstId, "現場で寸法を再確認する");
    expect(noteStore.lines[0]?.text).toBe("現場で寸法を再確認する");

    await splitProjectNote(firstId, 2);
    expect(noteStore.lines.map((line) => line.text)).toEqual([
      "現場",
      "で寸法を再確認する",
      "明日の朝礼で共有",
    ]);

    await moveProjectNote(0, 2);
    expect(noteStore.lines.map((line) => line.text)).toEqual([
      "で寸法を再確認する",
      "明日の朝礼で共有",
      "現場",
    ]);

    expect(mockWriteTextFile).toHaveBeenCalled();
    await saveProjectNotes();
    const saved = mockWriteTextFile.mock.calls.at(-1)?.[1] as string;
    expect(saved).toContain("- 明日の朝礼で共有");
  });

  it("promotes a line into TODO.md and keeps the line with the new key", async () => {
    mockPathExists.mockImplementation(async (path: string) => path.endsWith("TODO.md"));
    mockReadTextFile.mockResolvedValue(emptyTodoMarkdown());
    await loadProjectTodos();
    mockPathExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(`# NOTE

- 現場で寸法を確認する
`);
    await loadProjectNotes();

    const id = noteStore.lines[0]?.id ?? "";
    await promoteNoteLine(id);

    expect(todoStore.items.map((item) => item.title)).toEqual(["現場で寸法を確認する"]);
    expect(noteStore.lines[0]?.todoKey).toBe("DEMOSITE-1");
    expect(noteStore.lines[0]?.text).toBe("現場で寸法を確認する");
    expect(todoStore.tab).toBe("note");
  });

  it("opens the linked issue instead of creating a duplicate", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadTextFile.mockImplementation(async (path: string) => {
      if (String(path).endsWith("TODO.md")) {
        return `# TODO

## 未対応
- [ ] DEMOSITE-1 現場で寸法を確認する
`;
      }
      return `# NOTE

- 現場で寸法を確認する DEMOSITE-1
`;
    });
    await loadProjectTodos();
    await loadProjectNotes();

    const id = noteStore.lines[0]?.id ?? "";
    await promoteNoteLine(id);

    expect(todoStore.items).toHaveLength(1);
    expect(todoStore.tab).toBe("todo");
    expect(todoStore.selectedKey).toBe("DEMOSITE-1");
    expect(todoStore.panelOpen).toBe(true);
  });

  it("creates a replacement issue when the stored key is missing", async () => {
    mockPathExists.mockResolvedValue(true);
    mockReadTextFile.mockImplementation(async (path: string) => {
      if (String(path).endsWith("TODO.md")) {
        return emptyTodoMarkdown();
      }
      return `# NOTE

- 現場で寸法を確認する DEMOSITE-9
`;
    });
    await loadProjectTodos();
    await loadProjectNotes();

    const id = noteStore.lines[0]?.id ?? "";
    await promoteNoteLine(id);

    expect(todoStore.items.map((item) => item.key)).toEqual(["DEMOSITE-1"]);
    expect(noteStore.lines[0]?.todoKey).toBe("DEMOSITE-1");
    expect(todoStore.tab).toBe("note");
  });
});
