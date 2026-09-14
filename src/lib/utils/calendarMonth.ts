export type CalendarCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

export type CalendarMonth = {
  year: number;
  month: number;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(ISO_DATE);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function shiftCalendarMonth(year: number, month: number, delta: number): CalendarMonth {
  const shifted = new Date(year, month - 1 + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

export function calendarMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prev = shiftCalendarMonth(year, month, -1);
  const prevDays = new Date(prev.year, prev.month, 0).getDate();
  const next = shiftCalendarMonth(year, month, 1);
  const cells: CalendarCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({ iso: formatIsoDate(prev.year, prev.month, day), day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: formatIsoDate(year, month, day), day, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ iso: formatIsoDate(next.year, next.month, nextDay), day: nextDay, inMonth: false });
    nextDay += 1;
  }
  return cells;
}
