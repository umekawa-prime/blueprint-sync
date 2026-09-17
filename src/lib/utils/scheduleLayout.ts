import { formatIsoDate, parseIsoDate } from "./calendarMonth";
import type { ScheduleChart, ScheduleGroup, ScheduleTask } from "./scheduleSchema";

export const SCHEDULE_DAY_WIDTH_PX = 28;
export const SCHEDULE_LABEL_WIDTH_PX = 200;

export type ScheduleMonthBand = {
  key: string;
  label: string;
  startIndex: number;
  dayCount: number;
};

export type ScheduleBar = {
  left: number;
  width: number;
};

export type ScheduleActualBar = ScheduleBar & { ongoing: boolean };

export type ScheduleGroupRow = {
  kind: "group";
  id: string;
  name: string;
  color: string;
};

export type ScheduleTaskRow = {
  kind: "task";
  id: string;
  name: string;
  color: string;
  planned: ScheduleBar | null;
  actual: ScheduleActualBar | null;
};

export type ScheduleRow = ScheduleGroupRow | ScheduleTaskRow;

export type ScheduleViewModel = {
  title: string;
  start: string;
  end: string;
  days: string[];
  weekends: string[];
  months: ScheduleMonthBand[];
  todayIndex: number | null;
  rows: ScheduleRow[];
};

function requireIso(iso: string): { year: number; month: number; day: number } {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    throw new Error(`invalid date: ${iso}`);
  }
  return parsed;
}

function utcDay(iso: string): Date {
  const parsed = requireIso(iso);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

export function addIsoDays(iso: string, days: number): string {
  const next = utcDay(iso);
  next.setUTCDate(next.getUTCDate() + days);
  return formatIsoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function weekdayUtc(iso: string): number {
  return utcDay(iso).getUTCDay();
}

export function isWeekend(iso: string): boolean {
  const day = weekdayUtc(iso);
  return day === 0 || day === 6;
}

export function dayIndex(chartStart: string, date: string): number {
  return Math.round((utcDay(date).getTime() - utcDay(chartStart).getTime()) / 86_400_000);
}

export function listChartDays(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addIsoDays(current, 1);
  }
  return days;
}

export function todayIso(now = new Date()): string {
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

export function clipInclusiveRange(
  chartStart: string,
  chartEnd: string,
  start: string,
  end: string,
): { start: string; end: string } | null {
  const clippedStart = maxIso(chartStart, start);
  const clippedEnd = minIso(chartEnd, end);
  if (clippedStart > clippedEnd) {
    return null;
  }
  return { start: clippedStart, end: clippedEnd };
}

export function barRect(
  chartStart: string,
  chartEnd: string,
  start: string,
  end: string,
): ScheduleBar | null {
  const clipped = clipInclusiveRange(chartStart, chartEnd, start, end);
  if (!clipped) {
    return null;
  }
  const startIdx = dayIndex(chartStart, clipped.start);
  const endIdx = dayIndex(chartStart, clipped.end);
  return {
    left: startIdx * SCHEDULE_DAY_WIDTH_PX,
    width: (endIdx - startIdx + 1) * SCHEDULE_DAY_WIDTH_PX,
  };
}

export function monthBands(days: string[]): ScheduleMonthBand[] {
  const bands: ScheduleMonthBand[] = [];
  for (const [index, iso] of days.entries()) {
    const parsed = requireIso(iso);
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    const last = bands[bands.length - 1];
    if (last && last.key === key) {
      last.dayCount += 1;
      continue;
    }
    bands.push({
      key,
      label: `${parsed.year}年${parsed.month}月`,
      startIndex: index,
      dayCount: 1,
    });
  }
  return bands;
}

function resolveActual(
  chart: ScheduleChart,
  task: ScheduleTask,
  today: string,
): ScheduleActualBar | null {
  if (!task.actual) {
    return null;
  }
  const end = task.actual.end ?? minIso(today, chart.end);
  if (!task.actual.end && today < task.actual.start) {
    return null;
  }
  const rect = barRect(chart.start, chart.end, task.actual.start, end);
  if (!rect) {
    return null;
  }
  return { ...rect, ongoing: task.actual.end === null };
}

function taskRow(chart: ScheduleChart, group: ScheduleGroup, task: ScheduleTask, today: string): ScheduleTaskRow {
  return {
    kind: "task",
    id: task.id,
    name: task.name,
    color: group.color,
    planned: barRect(chart.start, chart.end, task.planned.start, task.planned.end),
    actual: resolveActual(chart, task, today),
  };
}

export function buildScheduleViewModel(chart: ScheduleChart, today: string): ScheduleViewModel {
  const days = listChartDays(chart.start, chart.end);
  const todayInRange = today >= chart.start && today <= chart.end;
  const rows: ScheduleRow[] = [];
  for (const group of chart.groups) {
    rows.push({ kind: "group", id: group.id, name: group.name, color: group.color });
    for (const task of group.tasks) {
      rows.push(taskRow(chart, group, task, today));
    }
  }
  return {
    title: chart.title,
    start: chart.start,
    end: chart.end,
    days,
    weekends: days.filter(isWeekend),
    months: monthBands(days),
    todayIndex: todayInRange ? dayIndex(chart.start, today) : null,
    rows,
  };
}
