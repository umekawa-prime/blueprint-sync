import { historyStore } from "$lib/stores/historyStore.svelte";

type PageObjects = Record<string, Record<string, unknown>>;

class AnnotationStore {
  byPage = $state<Record<number, PageObjects>>({});
  dirty = $state(false);
  remoteRevision = $state(0);

  objectsFor(page: number): Record<string, unknown>[] {
    return Object.values(this.byPage[page] ?? {});
  }

  upsert(page: number, id: string, object: Record<string, unknown>) {
    const current = { ...(this.byPage[page] ?? {}) };
    current[id] = { ...object, id };
    this.byPage = { ...this.byPage, [page]: current };
    this.dirty = true;
  }

  remove(page: number, id: string) {
    const current = { ...(this.byPage[page] ?? {}) };
    delete current[id];
    this.byPage = { ...this.byPage, [page]: current };
    this.dirty = true;
  }

  replacePage(page: number, objects: Record<string, unknown>[], markDirty = true) {
    const mapped: PageObjects = {};
    for (const object of objects) {
      const id = typeof object.id === "string" && object.id ? object.id : "";
      if (!id) {
        continue;
      }
      mapped[id] = { ...object, id };
    }
    const previous = this.byPage[page] ?? {};
    if (JSON.stringify(previous) === JSON.stringify(mapped)) {
      if (markDirty) {
        this.dirty = true;
      }
      return;
    }
    this.byPage = { ...this.byPage, [page]: mapped };
    if (markDirty) {
      this.dirty = true;
    }
  }

  applyRemote(
    page: number,
    id: string,
    object: Record<string, unknown> | undefined,
    remove = false,
  ) {
    if (remove) {
      this.remove(page, id);
    } else if (object) {
      this.upsert(page, id, object);
    }
    this.remoteRevision += 1;
  }

  clear() {
    this.byPage = {};
    this.dirty = false;
    this.remoteRevision += 1;
    historyStore.clear();
  }

  exportByPage(): Record<number, PageObjects> {
    return this.byPage;
  }

  importByPage(byPage: Record<number, PageObjects>) {
    this.byPage = byPage;
    this.dirty = false;
    this.remoteRevision += 1;
    historyStore.clear();
  }
}

export const annotationStore = new AnnotationStore();
