import { beforeEach, describe, expect, it } from "vitest";
import sampleSchedule from "$lib/data/sampleSchedule.json";
import { scheduleStore } from "$lib/stores/scheduleStore.svelte";
import { parseScheduleChart } from "./scheduleSchema";
import { closeScheduleView, openSampleSchedule, openScheduleChart, resetScheduleState } from "./scheduleActions";

describe("sampleSchedule.json", () => {
  it("is a valid version-1 chart", () => {
    const parsed = parseScheduleChart(sampleSchedule);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.chart.title).toBe("サンプル新築工事 工程表");
      expect(parsed.chart.start).toBe("2026-09-01");
      expect(parsed.chart.end).toBe("2026-10-31");
      expect(parsed.chart.groups.length).toBeGreaterThan(1);
    }
  });
});

describe("scheduleActions", () => {
  beforeEach(() => {
    resetScheduleState();
  });

  it("opens the bundled sample and can return to the drawing view", () => {
    openSampleSchedule();
    expect(scheduleStore.open).toBe(true);
    expect(scheduleStore.error).toBeNull();
    expect(scheduleStore.chart?.title).toBe("サンプル新築工事 工程表");

    closeScheduleView();
    expect(scheduleStore.open).toBe(false);
    expect(scheduleStore.chart?.title).toBe("サンプル新築工事 工程表");
  });

  it("shows a Japanese error when the payload is invalid", () => {
    openScheduleChart({ version: 2 });
    expect(scheduleStore.open).toBe(true);
    expect(scheduleStore.chart).toBeNull();
    expect(scheduleStore.error).toContain("version");
  });

  it("clears the schedule when the project lists reset", () => {
    openSampleSchedule();
    resetScheduleState();
    expect(scheduleStore.open).toBe(false);
    expect(scheduleStore.chart).toBeNull();
    expect(scheduleStore.error).toBeNull();
  });
});
