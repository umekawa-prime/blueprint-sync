import { historyStore } from "$lib/stores/historyStore.svelte";
import type { PageObjects, PhotoPinRecord } from "$lib/utils/annotationPersist";

class AnnotationStore {
  byPage = $state<Record<number, PageObjects>>({});
  photoPins = $state<Record<number, Record<string, PhotoPinRecord>>>({});
  dirty = $state(false);
  remoteRevision = $state(0);

  objectsFor(page: number): Record<string, unknown>[] {
    return Object.values(this.byPage[page] ?? {});
  }

  pinsFor(page: number): PhotoPinRecord[] {
    return Object.values(this.photoPins[page] ?? {});
  }

  upsert(page: number, id: string, object: Record<string, unknown>) {
    const current = { ...(this.byPage[page] ?? {}) };
    current[id] = { ...object, id };
    this.byPage = { ...this.byPage, [page]: current };
    this.dirty = true;
  }

  addPhotoPin(page: number, pin: PhotoPinRecord) {
    const current = { ...(this.photoPins[page] ?? {}) };
    current[pin.id] = { ...pin, title: pin.title ?? "" };
    this.photoPins = { ...this.photoPins, [page]: current };
    this.dirty = true;
  }

  updatePhotoPin(page: number, id: string, patch: Partial<Pick<PhotoPinRecord, "title" | "nx" | "ny">>) {
    const current = { ...(this.photoPins[page] ?? {}) };
    const existing = current[id];
    if (!existing) {
      return;
    }
    current[id] = { ...existing, ...patch };
    this.photoPins = { ...this.photoPins, [page]: current };
    this.dirty = true;
  }

  removePhotoPin(page: number, id: string) {
    const current = { ...(this.photoPins[page] ?? {}) };
    delete current[id];
    this.photoPins = { ...this.photoPins, [page]: current };
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
    this.photoPins = {};
    this.dirty = false;
    this.remoteRevision += 1;
    historyStore.clear();
  }

  exportByPage(): Record<number, PageObjects> {
    return this.byPage;
  }

  exportPhotoPins(): Record<number, Record<string, PhotoPinRecord>> {
    return this.photoPins;
  }

  importByPage(
    byPage: Record<number, PageObjects>,
    photoPins: Record<number, Record<string, PhotoPinRecord>> = {},
  ) {
    const normalized: Record<number, Record<string, PhotoPinRecord>> = {};
    for (const [key, pins] of Object.entries(photoPins)) {
      const page = Number(key);
      normalized[page] = {};
      for (const [id, pin] of Object.entries(pins)) {
        normalized[page][id] = { ...pin, title: pin.title ?? "" };
      }
    }
    this.byPage = byPage;
    this.photoPins = normalized;
    this.dirty = false;
    this.remoteRevision += 1;
    historyStore.clear();
  }
}

export const annotationStore = new AnnotationStore();
