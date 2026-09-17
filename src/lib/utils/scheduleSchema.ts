import { parseIsoDate } from "./calendarMonth";

export type ScheduleDateRange = {
  start: string;
  end: string | null;
};

export type ScheduleTask = {
  id: string;
  name: string;
  planned: { start: string; end: string };
  actual?: { start: string; end: string | null };
};

export type ScheduleGroup = {
  id: string;
  name: string;
  color: string;
  tasks: ScheduleTask[];
};

export type ScheduleChart = {
  version: 1;
  title: string;
  start: string;
  end: string;
  groups: ScheduleGroup[];
};

export type ParseScheduleResult =
  | { ok: true; chart: ScheduleChart }
  | { ok: false; error: string };

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function fail(error: string): ParseScheduleResult {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, label: string): string | ParseScheduleResult {
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`${label} が空です`);
  }
  return value;
}

function readIsoDate(value: unknown, label: string): string | ParseScheduleResult {
  if (typeof value !== "string" || !parseIsoDate(value)) {
    return fail(`${label} が正しい日付ではありません`);
  }
  return value;
}

function readRange(
  start: string,
  end: string,
  label: string,
): ParseScheduleResult | null {
  if (start > end) {
    return fail(`${label} の開始が終了より後です`);
  }
  return null;
}

function parseTask(value: unknown, index: number): ScheduleTask | ParseScheduleResult {
  if (!isRecord(value)) {
    return fail(`作業 ${index + 1} がオブジェクトではありません`);
  }
  const id = readString(value.id, `作業 ${index + 1} の id`);
  if (typeof id !== "string") {
    return id;
  }
  const name = readString(value.name, `作業 ${index + 1} の名前`);
  if (typeof name !== "string") {
    return name;
  }
  if (!isRecord(value.planned)) {
    return fail(`作業 ${id} の予定がありません`);
  }
  const plannedStart = readIsoDate(value.planned.start, `作業 ${id} の予定開始`);
  if (typeof plannedStart !== "string") {
    return plannedStart;
  }
  const plannedEnd = readIsoDate(value.planned.end, `作業 ${id} の予定終了`);
  if (typeof plannedEnd !== "string") {
    return plannedEnd;
  }
  const plannedOrder = readRange(plannedStart, plannedEnd, `作業 ${id} の予定`);
  if (plannedOrder) {
    return plannedOrder;
  }

  const task: ScheduleTask = {
    id,
    name,
    planned: { start: plannedStart, end: plannedEnd },
  };

  if (value.actual === undefined) {
    return task;
  }
  if (!isRecord(value.actual)) {
    return fail(`作業 ${id} の実績がオブジェクトではありません`);
  }
  const actualStart = readIsoDate(value.actual.start, `作業 ${id} の実績開始`);
  if (typeof actualStart !== "string") {
    return actualStart;
  }
  if (value.actual.end === null) {
    task.actual = { start: actualStart, end: null };
    return task;
  }
  const actualEnd = readIsoDate(value.actual.end, `作業 ${id} の実績終了`);
  if (typeof actualEnd !== "string") {
    return actualEnd;
  }
  const actualOrder = readRange(actualStart, actualEnd, `作業 ${id} の実績`);
  if (actualOrder) {
    return actualOrder;
  }
  task.actual = { start: actualStart, end: actualEnd };
  return task;
}

function parseGroup(value: unknown, index: number): ScheduleGroup | ParseScheduleResult {
  if (!isRecord(value)) {
    return fail(`グループ ${index + 1} がオブジェクトではありません`);
  }
  const id = readString(value.id, `グループ ${index + 1} の id`);
  if (typeof id !== "string") {
    return id;
  }
  const name = readString(value.name, `グループ ${index + 1} の名前`);
  if (typeof name !== "string") {
    return name;
  }
  if (typeof value.color !== "string" || !HEX_COLOR.test(value.color)) {
    return fail(`グループ ${id} の色が #RRGGBB ではありません`);
  }
  if (!Array.isArray(value.tasks)) {
    return fail(`グループ ${id} の作業が配列ではありません`);
  }
  const tasks: ScheduleTask[] = [];
  for (const [taskIndex, taskValue] of value.tasks.entries()) {
    const task = parseTask(taskValue, taskIndex);
    if ("ok" in task) {
      return task;
    }
    tasks.push(task);
  }
  return { id, name, color: value.color, tasks };
}

export function parseScheduleChart(input: unknown): ParseScheduleResult {
  if (!isRecord(input)) {
    return fail("工程表データがオブジェクトではありません");
  }
  if (input.version !== 1) {
    return fail("version が 1 ではありません");
  }
  const title = readString(input.title, "タイトル");
  if (typeof title !== "string") {
    return title;
  }
  const start = readIsoDate(input.start, "開始日");
  if (typeof start !== "string") {
    return start;
  }
  const end = readIsoDate(input.end, "終了日");
  if (typeof end !== "string") {
    return end;
  }
  const chartOrder = readRange(start, end, "工程表");
  if (chartOrder) {
    return chartOrder;
  }
  if (!Array.isArray(input.groups)) {
    return fail("グループが配列ではありません");
  }
  const groups: ScheduleGroup[] = [];
  for (const [index, groupValue] of input.groups.entries()) {
    const group = parseGroup(groupValue, index);
    if ("ok" in group) {
      return group;
    }
    groups.push(group);
  }
  return {
    ok: true,
    chart: { version: 1, title, start, end, groups },
  };
}
