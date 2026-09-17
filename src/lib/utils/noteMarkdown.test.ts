import { describe, expect, it } from "vitest";
import {
  attachNoteTodoKey,
  createNoteLine,
  emptyNoteMarkdown,
  ensureNoteLines,
  moveNoteLine,
  parseNoteMarkdown,
  removeNoteLineIfEmpty,
  serializeNoteMarkdown,
  splitNoteLine,
  type NoteLine,
} from "./noteMarkdown";

function texts(lines: NoteLine[]): string[] {
  return lines.map((line) => line.text);
}

function keys(lines: NoteLine[]): Array<string | null> {
  return lines.map((line) => line.todoKey);
}

describe("parseNoteMarkdown", () => {
  it("reads one list item per line and a trailing issue key", () => {
    const markdown = `# NOTE

- 現場で寸法を確認する
- 図面の赤字を反映する SITE-4
- 明日の朝礼で共有
`;
    const lines = parseNoteMarkdown(markdown);
    expect(texts(lines)).toEqual([
      "現場で寸法を確認する",
      "図面の赤字を反映する",
      "明日の朝礼で共有",
    ]);
    expect(keys(lines)).toEqual([null, "SITE-4", null]);
    expect(new Set(lines.map((line) => line.id)).size).toBe(3);
  });

  it("treats a missing file body as no lines", () => {
    expect(parseNoteMarkdown("")).toEqual([]);
    expect(parseNoteMarkdown("# NOTE\n\n")).toEqual([]);
  });

  it("reads a plain line that is not a list item", () => {
    const lines = parseNoteMarkdown("# NOTE\n\n手書きメモ\n");
    expect(texts(lines)).toEqual(["手書きメモ"]);
    expect(keys(lines)).toEqual([null]);
  });
});

describe("serializeNoteMarkdown", () => {
  it("round-trips lines through NOTE.md", () => {
    const original: NoteLine[] = [
      createNoteLine("現場で寸法を確認する"),
      createNoteLine("図面の赤字を反映する", "SITE-4"),
      createNoteLine("明日の朝礼で共有"),
    ];
    const markdown = serializeNoteMarkdown(original);
    expect(markdown).toContain("# NOTE");
    expect(markdown).toContain("- 図面の赤字を反映する SITE-4");
    const parsed = parseNoteMarkdown(markdown);
    expect(texts(parsed)).toEqual(texts(original));
    expect(keys(parsed)).toEqual(keys(original));
  });

  it("writes an empty placeholder line for a blank note", () => {
    expect(emptyNoteMarkdown()).toContain("# NOTE");
    expect(serializeNoteMarkdown(ensureNoteLines([]))).toMatch(/-\s*$/m);
  });
});

describe("ensureNoteLines", () => {
  it("keeps at least one editable line", () => {
    const ensured = ensureNoteLines([]);
    expect(ensured).toHaveLength(1);
    expect(ensured[0]?.text).toBe("");
    expect(ensured[0]?.todoKey).toBeNull();
    const existing = [createNoteLine("残す")];
    expect(ensureNoteLines(existing)).toEqual(existing);
  });
});

describe("moveNoteLine", () => {
  it("reorders a line like a Notion block drag", () => {
    const lines = [
      createNoteLine("A"),
      createNoteLine("B"),
      createNoteLine("C"),
    ];
    expect(texts(moveNoteLine(lines, 0, 2))).toEqual(["B", "C", "A"]);
    expect(texts(moveNoteLine(lines, 2, 0))).toEqual(["C", "A", "B"]);
    expect(moveNoteLine(lines, 1, 1)).toEqual(lines);
  });
});

describe("splitNoteLine", () => {
  it("splits at the caret and focuses the new line below", () => {
    const first = createNoteLine("現場確認");
    const result = splitNoteLine([first], first.id, 2);
    expect(texts(result.lines)).toEqual(["現場", "確認"]);
    expect(result.lines[0]?.id).toBe(first.id);
    expect(result.focusId).toBe(result.lines[1]?.id);
    expect(result.focusId).not.toBe(first.id);
  });

  it("keeps an attached issue key on the original line", () => {
    const first = createNoteLine("図面の赤字", "SITE-4");
    const result = splitNoteLine([first], first.id, 2);
    expect(keys(result.lines)).toEqual(["SITE-4", null]);
  });
});

describe("removeNoteLineIfEmpty", () => {
  it("deletes an empty line and focuses the previous one", () => {
    const a = createNoteLine("残す");
    const b = createNoteLine("");
    const result = removeNoteLineIfEmpty([a, b], b.id);
    expect(texts(result.lines)).toEqual(["残す"]);
    expect(result.focusId).toBe(a.id);
  });

  it("does not delete the last remaining line", () => {
    const only = createNoteLine("");
    const result = removeNoteLineIfEmpty([only], only.id);
    expect(result.lines).toHaveLength(1);
    expect(result.focusId).toBe(only.id);
  });

  it("leaves a non-empty line untouched", () => {
    const a = createNoteLine("残す");
    const result = removeNoteLineIfEmpty([a], a.id);
    expect(result.lines).toEqual([a]);
    expect(result.focusId).toBe(a.id);
  });
});

describe("attachNoteTodoKey", () => {
  it("keeps the line and stores the issue key", () => {
    const line = createNoteLine("現場で寸法を確認する");
    const next = attachNoteTodoKey([line], line.id, "DEMOSITE-2");
    expect(next[0]).toMatchObject({
      id: line.id,
      text: "現場で寸法を確認する",
      todoKey: "DEMOSITE-2",
    });
  });
});
