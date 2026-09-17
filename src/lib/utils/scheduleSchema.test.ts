import { describe, expect, it } from "vitest";
import { parseScheduleChart } from "./scheduleSchema";

const valid = {
  version: 1,
  title: "サンプル新築工事 工程表",
  start: "2026-09-01",
  end: "2026-10-31",
  groups: [
    {
      id: "foundation",
      name: "基礎",
      color: "#38bdf8",
      tasks: [
        {
          id: "found-1",
          name: "掘削",
          planned: { start: "2026-09-01", end: "2026-09-10" },
          actual: { start: "2026-09-02", end: "2026-09-09" },
        },
        {
          id: "found-2",
          name: "配筋",
          planned: { start: "2026-09-11", end: "2026-09-20" },
          actual: { start: "2026-09-12", end: null },
        },
      ],
    },
  ],
};

describe("parseScheduleChart", () => {
  it("accepts a version-1 chart with planned and optional actual ranges", () => {
    const parsed = parseScheduleChart(valid);
    expect(parsed).toEqual({ ok: true, chart: valid });
  });

  it("allows omitting actual entirely", () => {
    const parsed = parseScheduleChart({
      ...valid,
      groups: [
        {
          id: "prep",
          name: "準備",
          color: "#22c55e",
          tasks: [{ id: "p1", name: "地鎮祭", planned: { start: "2026-09-01", end: "2026-09-01" } }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.chart.groups[0].tasks[0].actual).toBeUndefined();
    }
  });

  it("rejects a missing version, inverted chart range, and bad color", () => {
    expect(parseScheduleChart({ ...valid, version: 2 }).ok).toBe(false);
    expect(parseScheduleChart({ ...valid, start: "2026-11-01", end: "2026-10-31" }).ok).toBe(false);
    expect(parseScheduleChart({ ...valid, groups: [{ ...valid.groups[0], color: "blue" }] }).ok).toBe(
      false,
    );
  });

  it("rejects invalid calendar dates and inverted planned ranges", () => {
    expect(parseScheduleChart({ ...valid, start: "2026-09-31" }).ok).toBe(false);
    const badPlanned = structuredClone(valid);
    badPlanned.groups[0].tasks[0].planned.end = "2026-08-31";
    expect(parseScheduleChart(badPlanned).ok).toBe(false);
  });
});
