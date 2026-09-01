import { describe, expect, it } from "vitest";
import {
  emptyHistory,
  inverseEdit,
  pushEdit,
  redoEdit,
  undoEdit,
} from "./editHistory";

const addStroke = {
  op: "add" as const,
  page: 0,
  id: "a",
  after: { id: "a", type: "path" },
};

const removeStroke = {
  op: "remove" as const,
  page: 0,
  id: "a",
  before: { id: "a", type: "path" },
};

describe("editHistory", () => {
  it("starts empty with nothing to undo or redo", () => {
    const history = emptyHistory();
    expect(history.undoStack).toEqual([]);
    expect(history.redoStack).toEqual([]);
    expect(undoEdit(history)).toBeNull();
    expect(redoEdit(history)).toBeNull();
  });

  it("pushes an edit onto the undo stack and clears redo", () => {
    const withRedo = {
      undoStack: [addStroke],
      redoStack: [removeStroke],
    };

    const next = pushEdit(withRedo, {
      op: "add",
      page: 1,
      id: "b",
      after: { id: "b", type: "path" },
    });

    expect(next.undoStack).toHaveLength(2);
    expect(next.redoStack).toEqual([]);
  });

  it("caps the undo stack at 50 edits", () => {
    let history = emptyHistory();
    for (let i = 0; i < 55; i += 1) {
      history = pushEdit(history, {
        op: "add",
        page: 0,
        id: String(i),
        after: { id: String(i) },
      });
    }
    expect(history.undoStack).toHaveLength(50);
    expect(history.undoStack[0]?.id).toBe("5");
  });

  it("undo moves the last edit to redo and redo puts it back", () => {
    const pushed = pushEdit(emptyHistory(), addStroke);
    const undone = undoEdit(pushed);
    expect(undone?.command).toEqual(addStroke);
    expect(undone?.history.undoStack).toEqual([]);
    expect(undone?.history.redoStack).toEqual([addStroke]);

    const redone = redoEdit(undone!.history);
    expect(redone?.command).toEqual(addStroke);
    expect(redone?.history.undoStack).toEqual([addStroke]);
    expect(redone?.history.redoStack).toEqual([]);
  });

  it("inverts add to remove and modify to modify with swapped snapshots", () => {
    expect(inverseEdit(addStroke)).toEqual({
      op: "remove",
      page: 0,
      id: "a",
      before: { id: "a", type: "path" },
    });
    expect(
      inverseEdit({
        op: "modify",
        page: 2,
        id: "t",
        before: { left: 1 },
        after: { left: 9 },
      }),
    ).toEqual({
      op: "modify",
      page: 2,
      id: "t",
      before: { left: 9 },
      after: { left: 1 },
    });
  });
});
