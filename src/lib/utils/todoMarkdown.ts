export const TODO_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export type TodoFilter = "active" | "all" | TodoStatus;

export type TodoItem = {
  key: string;
  title: string;
  status: TodoStatus;
  due: string | null;
  description: string;
};

const STATUS_HEADING: Record<TodoStatus, string> = {
  open: "未対応",
  in_progress: "処理中",
  resolved: "処理済み",
  closed: "完了",
};

const HEADING_STATUS: Record<string, TodoStatus> = {
  未対応: "open",
  処理中: "in_progress",
  処理済み: "resolved",
  完了: "closed",
};

export const TODO_KEY_PATTERN = /^[A-Za-z0-9]{1,12}-\d+$/;
const KEY_PATTERN = TODO_KEY_PATTERN;
const DUE_PATTERN = /(?:^|\s)期限:\s*(\d{4}-\d{2}-\d{2})\s*$/;

export function statusLabel(status: TodoStatus): string {
  return STATUS_HEADING[status];
}

export function todoKeyPrefix(projectName: string): string {
  const compact = projectName.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
  return compact.slice(0, 8) || "TODO";
}

export function emptyTodoMarkdown(): string {
  return ["# TODO", "", ...TODO_STATUSES.flatMap((status) => [`## ${STATUS_HEADING[status]}`, ""])].join(
    "\n",
  );
}

export function nextTodoKey(items: TodoItem[], prefix: string): string {
  let max = 0;
  const needle = `${prefix.toUpperCase()}-`;
  for (const item of items) {
    const key = item.key.toUpperCase();
    if (!key.startsWith(needle)) {
      continue;
    }
    const value = Number(key.slice(needle.length));
    if (Number.isInteger(value) && value > max) {
      max = value;
    }
  }
  return `${prefix.toUpperCase()}-${max + 1}`;
}

export function addTodoItem(items: TodoItem[], prefix: string, title: string): TodoItem[] {
  const trimmed = title.trim();
  if (!trimmed) {
    return items;
  }
  return [
    ...items,
    {
      key: nextTodoKey(items, prefix),
      title: trimmed,
      status: "open",
      due: null,
      description: "",
    },
  ];
}

export function parseTodoMarkdown(markdown: string, prefix: string): TodoItem[] {
  const items: TodoItem[] = [];
  let status: TodoStatus = "open";
  let current: TodoItem | undefined;
  const fallbackPrefix = todoKeyPrefix(prefix);

  for (const rawLine of markdown.replaceAll("\r\n", "\n").split("\n")) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = undefined;
      status = HEADING_STATUS[heading[1]] ?? status;
      continue;
    }

    const itemMatch = rawLine.match(/^-\s+\[([ xX/~])\]\s+(.*)$/);
    if (itemMatch) {
      const parsed = parseItemLine(itemMatch[2], status, itemMatch[1], fallbackPrefix, items.length);
      items.push(parsed);
      current = parsed;
      continue;
    }

    if (current && /^(?: {2,}|\t)/.test(rawLine) && rawLine.trim()) {
      current.description = current.description
        ? `${current.description}\n${rawLine.trim()}`
        : rawLine.trim();
    }
  }

  return items;
}

function parseItemLine(
  body: string,
  headingStatus: TodoStatus,
  mark: string,
  prefix: string,
  index: number,
): TodoItem {
  let rest = body.trim();
  let due: string | null = null;
  const dueMatch = rest.match(DUE_PATTERN);
  if (dueMatch) {
    due = dueMatch[1];
    rest = rest.slice(0, dueMatch.index).trim();
  }

  const tokens = rest.split(/\s+/);
  let key = `${prefix}-${index + 1}`;
  let title = rest;
  if (tokens[0] && KEY_PATTERN.test(tokens[0])) {
    key = tokens[0].toUpperCase();
    title = tokens.slice(1).join(" ").trim() || tokens[0];
  }

  let status = headingStatus;
  if (mark === "/" ) {
    status = "in_progress";
  } else if ((mark === "x" || mark === "X") && (headingStatus === "open" || headingStatus === "in_progress")) {
    status = "closed";
  }

  return { key, title, status, due, description: "" };
}

export function serializeTodoMarkdown(items: TodoItem[], _prefix: string): string {
  const lines = ["# TODO", ""];
  for (const status of TODO_STATUSES) {
    lines.push(`## ${STATUS_HEADING[status]}`);
    const grouped = items.filter((item) => item.status === status);
    if (grouped.length === 0) {
      lines.push("");
      continue;
    }
    for (const item of grouped) {
      const mark = status === "resolved" || status === "closed" ? "x" : " ";
      const due = item.due ? ` 期限:${item.due}` : "";
      lines.push(`- [${mark}] ${item.key} ${item.title}${due}`);
      if (item.description.trim()) {
        for (const row of item.description.split("\n")) {
          lines.push(`  ${row}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function filterTodos(items: TodoItem[], filter: TodoFilter, query: string): TodoItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "active" && item.status === "closed") {
      return false;
    }
    if (filter !== "active" && filter !== "all" && item.status !== filter) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return (
      item.key.toLowerCase().includes(needle) ||
      item.title.toLowerCase().includes(needle) ||
      item.description.toLowerCase().includes(needle)
    );
  });
}

export function isTodoOverdue(item: TodoItem, today = todayIsoDate()): boolean {
  if (!item.due || item.status === "closed") {
    return false;
  }
  return item.due < today;
}

export const TODO_FILTERS: Array<{ id: TodoFilter; label: string }> = [
  { id: "active", label: "完了以外" },
  { id: "all", label: "すべて" },
  { id: "open", label: "未対応" },
  { id: "in_progress", label: "処理中" },
  { id: "resolved", label: "処理済み" },
  { id: "closed", label: "完了" },
];

export function todoStatusBadgeClass(status: TodoStatus): string {
  switch (status) {
    case "open":
      return "bg-[#ed8077] text-white";
    case "in_progress":
      return "bg-[#4488c5] text-white";
    case "resolved":
      return "bg-[#5eb5a6] text-white";
    case "closed":
      return "bg-[#b0be3c] text-slate-900";
  }
}

export function todoRowAccentClass(status: TodoStatus): string {
  switch (status) {
    case "open":
      return "border-l-[#ed8077]";
    case "in_progress":
      return "border-l-[#4488c5]";
    case "resolved":
      return "border-l-[#5eb5a6]";
    case "closed":
      return "border-l-[#b0be3c]";
  }
}

export function formatTodoDue(due: string | null): string {
  if (!due) {
    return "";
  }
  return due.replaceAll("-", "/");
}

export function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type TodoDraft = Pick<TodoItem, "title" | "status" | "due" | "description">;

export function isTodoDraftDirty(item: TodoItem, draft: TodoDraft): boolean {
  return (
    item.title !== draft.title ||
    item.status !== draft.status ||
    item.due !== draft.due ||
    item.description !== draft.description
  );
}

export function updateTodoItem(
  items: TodoItem[],
  key: string,
  patch: Partial<TodoDraft>,
): TodoItem[] {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

export function removeTodoItem(items: TodoItem[], key: string): TodoItem[] {
  return items.filter((item) => item.key !== key);
}
