import {
  filterTodos,
  type TodoFilter,
  type TodoItem,
} from "$lib/utils/todoMarkdown";

class TodoStore {
  items = $state<TodoItem[]>([]);
  filter = $state<TodoFilter>("active");
  query = $state("");
  selectedKey = $state<string | null>(null);
  panelOpen = $state(false);

  get visible(): TodoItem[] {
    return filterTodos(this.items, this.filter, this.query);
  }

  get activeCount(): number {
    return this.items.filter((item) => item.status !== "closed").length;
  }

  get selected(): TodoItem | undefined {
    return this.items.find((item) => item.key === this.selectedKey);
  }

  reset() {
    this.items = [];
    this.filter = "active";
    this.query = "";
    this.selectedKey = null;
    this.panelOpen = false;
  }
}

export const todoStore = new TodoStore();
