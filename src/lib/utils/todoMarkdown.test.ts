import { describe, expect, it } from "vitest";
import {
  TODO_STATUSES,
  addTodoItem,
  emptyTodoMarkdown,
  filterTodos,
  isTodoDraftDirty,
  isTodoOverdue,
  nextTodoKey,
  parseTodoMarkdown,
  serializeTodoMarkdown,
  statusLabel,
  todoKeyPrefix,
  type TodoItem,
} from "./todoMarkdown";

const sample: TodoItem[] = [
  {
    key: "DEMO-1",
    title: "現場で寸法確認",
    status: "open",
    due: "2026-09-20",
    description: "A1 と照合する",
  },
  {
    key: "DEMO-2",
    title: "図面を修正する",
    status: "in_progress",
    due: null,
    description: "",
  },
  {
    key: "DEMO-3",
    title: "キックオフ",
    status: "resolved",
    due: null,
    description: "",
  },
  {
    key: "DEMO-4",
    title: "提出",
    status: "closed",
    due: "2026-08-01",
    description: "",
  },
];

describe("todoKeyPrefix", () => {
  it("uses ascii letters from the project name, otherwise TODO", () => {
    expect(todoKeyPrefix("DemoSite")).toBe("DEMOSITE");
    expect(todoKeyPrefix("現場A-12")).toBe("A12");
    expect(todoKeyPrefix("現場")).toBe("TODO");
  });
});

describe("parseTodoMarkdown", () => {
  it("reads backlog-style headings, keys, due dates, and descriptions", () => {
    const markdown = `# TODO

## 未対応
- [ ] DEMO-1 現場で寸法確認 期限:2026-09-20
  A1 と照合する

## 処理中
- [ ] DEMO-2 図面を修正する

## 処理済み
- [x] DEMO-3 キックオフ

## 完了
- [x] DEMO-4 提出 期限:2026-08-01
`;
    expect(parseTodoMarkdown(markdown, "DEMO")).toEqual(sample);
  });

  it("treats a missing file body as an empty list", () => {
    expect(parseTodoMarkdown("", "DEMO")).toEqual([]);
    expect(parseTodoMarkdown(emptyTodoMarkdown(), "DEMO")).toEqual([]);
  });
});

describe("serializeTodoMarkdown", () => {
  it("round-trips items through TODO.md", () => {
    const markdown = serializeTodoMarkdown(sample, "DEMO");
    expect(markdown).toContain("## 未対応");
    expect(markdown).toContain("## 処理中");
    expect(markdown).toContain("DEMO-1 現場で寸法確認 期限:2026-09-20");
    expect(parseTodoMarkdown(markdown, "DEMO")).toEqual(sample);
  });
});

describe("nextTodoKey and addTodoItem", () => {
  it("assigns the next key in the project prefix", () => {
    expect(nextTodoKey(sample, "DEMO")).toBe("DEMO-5");
    expect(nextTodoKey([], "TODO")).toBe("TODO-1");
    const added = addTodoItem([], "DEMO", "新規課題");
    expect(added).toEqual([
      {
        key: "DEMO-1",
        title: "新規課題",
        status: "open",
        due: null,
        description: "",
      },
    ]);
  });
});

describe("filterTodos", () => {
  it("defaults to unfinished items like Backlog 完了以外", () => {
    expect(filterTodos(sample, "active", "").map((item) => item.key)).toEqual([
      "DEMO-1",
      "DEMO-2",
      "DEMO-3",
    ]);
    expect(filterTodos(sample, "closed", "").map((item) => item.key)).toEqual(["DEMO-4"]);
    expect(filterTodos(sample, "all", "図面").map((item) => item.key)).toEqual(["DEMO-2"]);
  });
});

describe("statusLabel and overdue", () => {
  it("uses Backlog status names and flags past due open work", () => {
    expect(TODO_STATUSES.map(statusLabel)).toEqual(["未対応", "処理中", "処理済み", "完了"]);
    expect(isTodoOverdue(sample[0], "2026-09-21")).toBe(true);
    expect(isTodoOverdue(sample[3], "2026-09-21")).toBe(false);
    expect(isTodoOverdue(sample[1], "2026-09-21")).toBe(false);
  });
});

describe("isTodoDraftDirty", () => {
  it("detects unsaved edits in the issue form", () => {
    expect(isTodoDraftDirty(sample[0], { ...sample[0] })).toBe(false);
    expect(
      isTodoDraftDirty(sample[0], {
        title: "現場で寸法確認",
        status: "open",
        due: "2026-09-21",
        description: "A1 と照合する",
      }),
    ).toBe(true);
    expect(
      isTodoDraftDirty(sample[1], {
        title: "図面を修正する",
        status: "in_progress",
        due: null,
        description: "メモ",
      }),
    ).toBe(true);
  });
});
