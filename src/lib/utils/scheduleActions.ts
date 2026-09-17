import sampleSchedule from "$lib/data/sampleSchedule.json";
import { scheduleStore } from "$lib/stores/scheduleStore.svelte";
import { parseScheduleChart } from "./scheduleSchema";

export function resetScheduleState() {
  scheduleStore.reset();
}

export function closeScheduleView() {
  scheduleStore.open = false;
}

export function openScheduleChart(input: unknown) {
  const parsed = parseScheduleChart(input);
  if (!parsed.ok) {
    scheduleStore.chart = null;
    scheduleStore.error = parsed.error;
    scheduleStore.open = true;
    return;
  }
  scheduleStore.chart = parsed.chart;
  scheduleStore.error = null;
  scheduleStore.open = true;
}

export function openSampleSchedule() {
  openScheduleChart(sampleSchedule);
}
