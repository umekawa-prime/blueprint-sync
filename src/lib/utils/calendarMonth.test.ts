import { describe, expect, it } from "vitest";
import {
  calendarMonthGrid,
  parseIsoDate,
  shiftCalendarMonth,
} from "./calendarMonth";

describe("calendarMonthGrid", () => {
  it("builds a Sunday-start 6-week grid for September 2026", () => {
    const cells = calendarMonthGrid(2026, 9);
    expect(cells).toHaveLength(42);
    expect(cells[0]).toEqual({ iso: "2026-08-30", day: 30, inMonth: false });
    expect(cells[2]).toEqual({ iso: "2026-09-01", day: 1, inMonth: true });
    expect(cells[31]).toEqual({ iso: "2026-09-30", day: 30, inMonth: true });
    expect(cells[32]).toEqual({ iso: "2026-10-01", day: 1, inMonth: false });
  });
});

describe("shiftCalendarMonth", () => {
  it("rolls the year when leaving December or January", () => {
    expect(shiftCalendarMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftCalendarMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftCalendarMonth(2026, 9, 0)).toEqual({ year: 2026, month: 9 });
  });
});

describe("parseIsoDate", () => {
  it("reads YYYY-MM-DD and rejects invalid values", () => {
    expect(parseIsoDate("2026-09-14")).toEqual({ year: 2026, month: 9, day: 14 });
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("2026/09/14")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
  });
});
