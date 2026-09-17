import { chromeStore } from "$lib/stores/chromeStore.svelte";
import { noteStore, setNoteLines } from "$lib/stores/noteStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { todoStore } from "$lib/stores/todoStore.svelte";
import { pathExists, readTextFile, writeTextFile } from "./projectIo";
import {
  attachNoteTodoKey,
  emptyNoteMarkdown,
  ensureNoteLines,
  moveNoteLine,
  parseNoteMarkdown,
  removeNoteLineIfEmpty,
  serializeNoteMarkdown,
  splitNoteLine,
  updateNoteLineText,
} from "./noteMarkdown";
import { addProjectTodo } from "./todoActions";

export function noteMarkdownPath(folder: string): string {
  return `${folder.replace(/[/\\]+$/, "")}/NOTE.md`;
}

export function resetNoteState() {
  noteStore.reset();
}

export async function loadProjectNotes(folder = projectStore.folder): Promise<void> {
  if (!folder) {
    resetNoteState();
    return;
  }
  const path = noteMarkdownPath(folder);
  if (!(await pathExists(path))) {
    await writeTextFile(path, emptyNoteMarkdown());
    setNoteLines([]);
    return;
  }
  setNoteLines(parseNoteMarkdown(await readTextFile(path)));
}

export async function saveProjectNotes(): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  await writeTextFile(
    noteMarkdownPath(projectStore.folder),
    serializeNoteMarkdown(ensureNoteLines(noteStore.lines)),
  );
}

export async function updateProjectNoteText(id: string, text: string): Promise<void> {
  draftProjectNoteText(id, text);
  await saveProjectNotes();
}

export function draftProjectNoteText(id: string, text: string) {
  setNoteLines(updateNoteLineText(noteStore.lines, id, text));
}

export async function splitProjectNote(id: string, caret: number): Promise<string | undefined> {
  const result = splitNoteLine(noteStore.lines, id, caret);
  setNoteLines(result.lines);
  await saveProjectNotes();
  return result.focusId;
}

export async function removeEmptyProjectNote(id: string): Promise<string | undefined> {
  const result = removeNoteLineIfEmpty(noteStore.lines, id);
  setNoteLines(result.lines);
  await saveProjectNotes();
  return result.focusId;
}

export async function moveProjectNote(fromIndex: number, toIndex: number): Promise<void> {
  setNoteLines(moveNoteLine(noteStore.lines, fromIndex, toIndex));
  await saveProjectNotes();
}

export async function promoteNoteLine(id: string): Promise<void> {
  const line = noteStore.lines.find((item) => item.id === id);
  if (!line || !line.text.trim()) {
    return;
  }
  if (line.todoKey) {
    const existing = todoStore.items.find((item) => item.key === line.todoKey);
    if (existing) {
      todoStore.tab = "todo";
      todoStore.selectedKey = existing.key;
      todoStore.panelOpen = true;
      chromeStore.persist();
      return;
    }
  }
  const created = await addProjectTodo(line.text.trim());
  if (!created) {
    return;
  }
  setNoteLines(attachNoteTodoKey(noteStore.lines, id, created.key));
  todoStore.tab = "note";
  todoStore.selectedKey = null;
  await saveProjectNotes();
}
