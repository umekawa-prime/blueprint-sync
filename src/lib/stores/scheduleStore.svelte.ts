import type { ScheduleChart } from "$lib/utils/scheduleSchema";

class ScheduleStore {
  open = $state(false);
  chart = $state<ScheduleChart | null>(null);
  error = $state<string | null>(null);

  reset() {
    this.open = false;
    this.chart = null;
    this.error = null;
  }
}

export const scheduleStore = new ScheduleStore();
