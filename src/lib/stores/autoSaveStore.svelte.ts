import type { AutoSaveState } from "$lib/utils/autoSave";

class AutoSaveStore {
  state = $state<AutoSaveState>("idle");
}

export const autoSaveStore = new AutoSaveStore();
