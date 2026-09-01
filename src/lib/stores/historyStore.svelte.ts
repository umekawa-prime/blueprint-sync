import {
  emptyHistory,
  inverseEdit,
  pushEdit,
  redoEdit,
  undoEdit,
  type EditCommand,
  type EditHistory,
} from "$lib/utils/editHistory";

class HistoryStore {
  undoStack = $state<EditCommand[]>([]);
  redoStack = $state<EditCommand[]>([]);

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  private snapshot(): EditHistory {
    return { undoStack: this.undoStack, redoStack: this.redoStack };
  }

  private apply(next: EditHistory) {
    this.undoStack = next.undoStack;
    this.redoStack = next.redoStack;
  }

  push(command: EditCommand) {
    this.apply(pushEdit(this.snapshot(), command));
  }

  undo(): EditCommand | null {
    const result = undoEdit(this.snapshot());
    if (!result) {
      return null;
    }
    this.apply(result.history);
    return inverseEdit(result.command);
  }

  redo(): EditCommand | null {
    const result = redoEdit(this.snapshot());
    if (!result) {
      return null;
    }
    this.apply(result.history);
    return result.command;
  }

  clear() {
    this.apply(emptyHistory());
  }
}

export const historyStore = new HistoryStore();
