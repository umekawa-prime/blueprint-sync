import { describe, expect, it } from "vitest";
import type { ScheduleChart } from "./scheduleSchema";
import {
  SCHEDULE_DAY_WIDTH_PX,
  buildScheduleViewModel,
  todayIso,
} from "./scheduleLayout";

const chart: ScheduleChart = {
  version: 1,
  title: "サンプル新築工事 工程表",
  start: "2026-09-01",
  end: "2026-09-10",
  groups: [
    {
      id: "foundation",
      name: "基礎",
      color: "#38bdf8",
      tasks: [
        {
          id: "found-1",
          name: "掘削",
          planned: { start: "2026-09-01", end: "2026-09-05" },
          actual: { start: "2026-09-02", end: "2026-09-04" },
        },
        {
          id: "found-2",
          name: "配筋",
          planned: { start: "2026-08-28", end: "2026-09-12" },
          actual: { start: "2026-09-03", end: null },
        },
      ],
    },
  ],
};

describe("todayIso", () => {
  it("formats the local calendar date as YYYY-MM-DD", () => {
    expect(todayIso(new Date(2026, 8, 17))).toBe("2026-09-17");
  });
});

describe("buildScheduleViewModel", () => {
  it("lists inclusive days and marks Saturday and Sunday as weekend", () => {
    const model = buildScheduleViewModel(chart, "2026-09-04");
    expect(model.days).toHaveLength(10);
    expect(model.days[0]).toBe("2026-09-01");
    expect(model.days[9]).toBe("2026-09-10");
    expect(model.weekends).toEqual(["2026-09-05", "2026-09-06"]);
    expect(model.todayIndex).toBe(3);
  });

  it("groups days into month bands and places inclusive planned bars", () => {
    const model = buildScheduleViewModel(chart, "2026-09-04");
    expect(model.months).toEqual([{ key: "2026-09", label: "2026年9月", startIndex: 0, dayCount: 10 }]);
    const task = model.rows.find((row) => row.kind === "task" && row.id === "found-1");
    expect(task).toMatchObject({
      kind: "task",
      name: "掘削",
      color: "#38bdf8",
      planned: { left: 0, width: 5 * SCHEDULE_DAY_WIDTH_PX },
      actual: { left: SCHEDULE_DAY_WIDTH_PX, width: 3 * SCHEDULE_DAY_WIDTH_PX, ongoing: false },
    });
  });

  it("clips bars to the chart range and hatches unfinished actuals up to today", () => {
    const model = buildScheduleViewModel(chart, "2026-09-04");
    const clipped = model.rows.find((row) => row.kind === "task" && row.id === "found-2");
    expect(clipped).toMatchObject({
      kind: "task",
      planned: { left: 0, width: 10 * SCHEDULE_DAY_WIDTH_PX },
      actual: {
        left: 2 * SCHEDULE_DAY_WIDTH_PX,
        width: 2 * SCHEDULE_DAY_WIDTH_PX,
        ongoing: true,
      },
    });
  });

  it("omits the today line when today is outside the chart", () => {
    const model = buildScheduleViewModel(chart, "2026-08-31");
    expect(model.todayIndex).toBeNull();
  });
});
