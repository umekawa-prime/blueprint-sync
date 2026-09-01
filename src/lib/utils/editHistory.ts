export type EditOp = "add" | "remove" | "modify";

export type EditCommand = {
  op: EditOp;
  page: number;
  id: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type EditHistory = {
  undoStack: EditCommand[];
  redoStack: EditCommand[];
};

export const MAX_HISTORY = 50;

export function emptyHistory(): EditHistory {
  return { undoStack: [], redoStack: [] };
}

export function pushEdit(history: EditHistory, command: EditCommand): EditHistory {
  return {
    undoStack: [...history.undoStack, command].slice(-MAX_HISTORY),
    redoStack: [],
  };
}

export function undoEdit(
  history: EditHistory,
): { history: EditHistory; command: EditCommand } | null {
  if (history.undoStack.length === 0) {
    return null;
  }
  const command = history.undoStack[history.undoStack.length - 1];
  return {
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, command],
    },
    command,
  };
}

export function redoEdit(
  history: EditHistory,
): { history: EditHistory; command: EditCommand } | null {
  if (history.redoStack.length === 0) {
    return null;
  }
  const command = history.redoStack[history.redoStack.length - 1];
  return {
    history: {
      undoStack: [...history.undoStack, command],
      redoStack: history.redoStack.slice(0, -1),
    },
    command,
  };
}

export function inverseEdit(command: EditCommand): EditCommand {
  if (command.op === "add") {
    return {
      op: "remove",
      page: command.page,
      id: command.id,
      before: command.after,
    };
  }
  if (command.op === "remove") {
    return {
      op: "add",
      page: command.page,
      id: command.id,
      after: command.before,
    };
  }
  return {
    op: "modify",
    page: command.page,
    id: command.id,
    before: command.after,
    after: command.before,
  };
}
