import { chromeStore } from "$lib/stores/chromeStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { todoStore, type TodoPanelTab } from "$lib/stores/todoStore.svelte";
import { pathExists, readTextFile, writeTextFile } from "./projectIo";
import {
  addTodoItem,
  emptyTodoMarkdown,
  parseTodoMarkdown,
  removeTodoItem,
  serializeTodoMarkdown,
  todoKeyPrefix,
  updateTodoItem,
  type TodoItem,
} from "./todoMarkdown";

export function todoMarkdownPath(folder: string): string {
  return `${folder.replace(/[/\\]+$/, "")}/TODO.md`;
}

function prefix(): string {
  return todoKeyPrefix(projectStore.meta?.name || "TODO");
}

export function resetTodoState() {
  todoStore.reset();
}

export async function loadProjectTodos(folder = projectStore.folder): Promise<void> {
  if (!folder) {
    resetTodoState();
    return;
  }
  const path = todoMarkdownPath(folder);
  todoStore.query = "";
  todoStore.filter = "active";
  todoStore.selectedKey = null;
  if (!(await pathExists(path))) {
    await writeTextFile(path, emptyTodoMarkdown());
    todoStore.items = [];
    return;
  }
  todoStore.items = parseTodoMarkdown(await readTextFile(path), prefix());
}

export async function saveProjectTodos(): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  await writeTextFile(
    todoMarkdownPath(projectStore.folder),
    serializeTodoMarkdown(todoStore.items, prefix()),
  );
}

export async function addProjectTodo(title: string): Promise<TodoItem | undefined> {
  const next = addTodoItem(todoStore.items, prefix(), title);
  if (next.length === todoStore.items.length) {
    return undefined;
  }
  todoStore.items = next;
  const created = next[next.length - 1];
  todoStore.selectedKey = created.key;
  await saveProjectTodos();
  return created;
}

export async function updateProjectTodo(
  key: string,
  patch: Partial<Pick<TodoItem, "title" | "status" | "due" | "description">>,
): Promise<void> {
  todoStore.items = updateTodoItem(todoStore.items, key, patch);
  await saveProjectTodos();
}

export async function removeProjectTodo(key: string): Promise<void> {
  todoStore.items = removeTodoItem(todoStore.items, key);
  if (todoStore.selectedKey === key) {
    todoStore.selectedKey = null;
  }
  await saveProjectTodos();
}

export function toggleTodoPanel(open?: boolean) {
  todoStore.panelOpen = open ?? !todoStore.panelOpen;
  chromeStore.persist();
}

export function setTodoPanelTab(tab: TodoPanelTab) {
  todoStore.tab = tab;
  if (tab === "note") {
    todoStore.selectedKey = null;
  }
  chromeStore.persist();
}

export function openTodoPanel(tab: TodoPanelTab) {
  setTodoPanelTab(tab);
  todoStore.panelOpen = true;
  chromeStore.persist();
}
