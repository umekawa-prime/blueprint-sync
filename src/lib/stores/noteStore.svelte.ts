import { ensureNoteLines, type NoteLine } from "$lib/utils/noteMarkdown";

class NoteStore {
  lines = $state<NoteLine[]>([]);

  reset() {
    this.lines = [];
  }
}

export const noteStore = new NoteStore();

export function setNoteLines(lines: NoteLine[]) {
  noteStore.lines = ensureNoteLines(lines);
}
