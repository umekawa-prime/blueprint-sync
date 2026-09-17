import { TODO_KEY_PATTERN } from "./todoMarkdown";

export type NoteLine = {
  id: string;
  text: string;
  todoKey: string | null;
};

let noteIdSeq = 0;

export function createNoteLine(text = "", todoKey: string | null = null, id?: string): NoteLine {
  noteIdSeq += 1;
  return {
    id: id ?? `note-${noteIdSeq}`,
    text,
    todoKey,
  };
}

export function emptyNoteMarkdown(): string {
  return "# NOTE\n\n- \n";
}

export function ensureNoteLines(lines: NoteLine[]): NoteLine[] {
  return lines.length > 0 ? lines : [createNoteLine()];
}

function parseLineBody(body: string): Pick<NoteLine, "text" | "todoKey"> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { text: "", todoKey: null };
  }
  const tokens = trimmed.split(/\s+/);
  const last = tokens[tokens.length - 1];
  if (last && TODO_KEY_PATTERN.test(last) && tokens.length > 1) {
    return {
      text: tokens.slice(0, -1).join(" "),
      todoKey: last.toUpperCase(),
    };
  }
  if (last && TODO_KEY_PATTERN.test(last) && tokens.length === 1) {
    return { text: "", todoKey: last.toUpperCase() };
  }
  return { text: trimmed, todoKey: null };
}

export function parseNoteMarkdown(markdown: string): NoteLine[] {
  const lines: NoteLine[] = [];
  for (const rawLine of markdown.replaceAll("\r\n", "\n").split("\n")) {
    if (/^#+\s+/.test(rawLine)) {
      continue;
    }
    const itemMatch = rawLine.match(/^-\s+(.*)$/);
    if (itemMatch) {
      const parsed = parseLineBody(itemMatch[1]);
      lines.push(createNoteLine(parsed.text, parsed.todoKey));
      continue;
    }
    const plain = rawLine.trim();
    if (plain) {
      const parsed = parseLineBody(plain);
      lines.push(createNoteLine(parsed.text, parsed.todoKey));
    }
  }
  return lines;
}

export function serializeNoteMarkdown(lines: NoteLine[]): string {
  const rows = ensureNoteLines(lines).map((line) => {
    const key = line.todoKey ? ` ${line.todoKey}` : "";
    return `- ${line.text}${key}`;
  });
  return ["# NOTE", "", ...rows, ""].join("\n");
}

export function moveNoteLine(lines: NoteLine[], fromIndex: number, toIndex: number): NoteLine[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= lines.length ||
    toIndex >= lines.length
  ) {
    return lines;
  }
  const next = [...lines];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function splitNoteLine(
  lines: NoteLine[],
  id: string,
  caret: number,
): { lines: NoteLine[]; focusId: string } {
  const index = lines.findIndex((line) => line.id === id);
  if (index < 0) {
    return { lines, focusId: id };
  }
  const line = lines[index];
  const at = Math.max(0, Math.min(caret, line.text.length));
  const created = createNoteLine(line.text.slice(at));
  const next = [...lines];
  next[index] = { ...line, text: line.text.slice(0, at) };
  next.splice(index + 1, 0, created);
  return { lines: next, focusId: created.id };
}

export function removeNoteLineIfEmpty(
  lines: NoteLine[],
  id: string,
): { lines: NoteLine[]; focusId: string } {
  const index = lines.findIndex((line) => line.id === id);
  if (index < 0) {
    return { lines, focusId: id };
  }
  const line = lines[index];
  if (line.text !== "" || lines.length === 1) {
    return { lines, focusId: id };
  }
  const next = lines.filter((item) => item.id !== id);
  const focus = next[Math.max(0, index - 1)] ?? next[0];
  return { lines: next, focusId: focus.id };
}

export function attachNoteTodoKey(lines: NoteLine[], id: string, todoKey: string): NoteLine[] {
  return lines.map((line) => (line.id === id ? { ...line, todoKey } : line));
}

export function updateNoteLineText(lines: NoteLine[], id: string, text: string): NoteLine[] {
  return lines.map((line) => (line.id === id ? { ...line, text } : line));
}
