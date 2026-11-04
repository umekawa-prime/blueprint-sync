import { historyStore } from "$lib/stores/historyStore.svelte";
import type { MemoPinRecord, PageObjects, PhotoPinImage, PhotoPinRecord } from "$lib/utils/annotationPersist";
import { parseMemoPins, parsePhotoPins } from "$lib/utils/annotationPersist";
import { nextPinCreatedAt, numberedPins } from "$lib/utils/pinNumbers";

class AnnotationStore {
  byPage = $state<Record<number, PageObjects>>({});
  photoPins = $state<Record<number, Record<string, PhotoPinRecord>>>({});
  memoPins = $state<Record<number, Record<string, MemoPinRecord>>>({});
  dirty = $state(false);
  editSeq = $state(0);
  remoteRevision = $state(0);

  private markDirty() {
    this.dirty = true;
    this.editSeq += 1;
  }

  objectsFor(page: number): Record<string, unknown>[] {
    return Object.values(this.byPage[page] ?? {});
  }

  pinsFor(page: number): PhotoPinRecord[] {
    return numberedPins(Object.values(this.photoPins[page] ?? {})).map((item) => item.pin);
  }

  memosFor(page: number): MemoPinRecord[] {
    return Object.values(this.memoPins[page] ?? {}).sort((a, b) => {
      const created = (a.createdAt ?? 0) - (b.createdAt ?? 0);
      if (created !== 0) {
        return created;
      }
      return a.id.localeCompare(b.id);
    });
  }

  upsert(page: number, id: string, object: Record<string, unknown>) {
    const current = { ...(this.byPage[page] ?? {}) };
    current[id] = { ...object, id };
    this.byPage = { ...this.byPage, [page]: current };
    this.markDirty();
  }

  addPhotoPin(page: number, pin: PhotoPinRecord) {
    const current = { ...(this.photoPins[page] ?? {}) };
    current[pin.id] = {
      ...pin,
      title: pin.title ?? "",
      createdAt: pin.createdAt ?? nextPinCreatedAt(Object.values(current)),
    };
    this.photoPins = { ...this.photoPins, [page]: current };
    this.markDirty();
  }

  updatePhotoPin(page: number, id: string, patch: Partial<Pick<PhotoPinRecord, "title" | "nx" | "ny">>) {
    const current = { ...(this.photoPins[page] ?? {}) };
    const existing = current[id];
    if (!existing) {
      return;
    }
    current[id] = { ...existing, ...patch };
    this.photoPins = { ...this.photoPins, [page]: current };
    this.markDirty();
  }

  addPhotoPinImages(page: number, id: string, images: PhotoPinImage[]) {
    if (images.length === 0) {
      return;
    }
    const current = { ...(this.photoPins[page] ?? {}) };
    const existing = current[id];
    if (!existing) {
      return;
    }
    current[id] = { ...existing, images: [...existing.images, ...images] };
    this.photoPins = { ...this.photoPins, [page]: current };
    this.markDirty();
  }

  // A pin with no photo has nothing to show on the drawing, so dropping the
  // last one drops the pin.
  removePhotoPinImage(page: number, id: string, imageId: string): "pin" | "image" | "missing" {
    const current = { ...(this.photoPins[page] ?? {}) };
    const existing = current[id];
    if (!existing) {
      return "missing";
    }
    const images = existing.images.filter((image) => image.id !== imageId);
    if (images.length === existing.images.length) {
      return "missing";
    }
    if (images.length === 0) {
      delete current[id];
      this.photoPins = { ...this.photoPins, [page]: current };
      this.markDirty();
      return "pin";
    }
    current[id] = { ...existing, images };
    this.photoPins = { ...this.photoPins, [page]: current };
    this.markDirty();
    return "image";
  }

  removePhotoPin(page: number, id: string) {
    const current = { ...(this.photoPins[page] ?? {}) };
    delete current[id];
    this.photoPins = { ...this.photoPins, [page]: current };
    this.markDirty();
  }

  addMemoPin(page: number, pin: MemoPinRecord) {
    const current = { ...(this.memoPins[page] ?? {}) };
    current[pin.id] = {
      ...pin,
      createdAt: pin.createdAt ?? nextPinCreatedAt(Object.values(current)),
    };
    this.memoPins = { ...this.memoPins, [page]: current };
    this.markDirty();
  }

  updateMemoPin(page: number, id: string, patch: Partial<Pick<MemoPinRecord, "text" | "color" | "nx" | "ny">>) {
    const current = { ...(this.memoPins[page] ?? {}) };
    const existing = current[id];
    if (!existing) {
      return;
    }
    current[id] = { ...existing, ...patch };
    this.memoPins = { ...this.memoPins, [page]: current };
    this.markDirty();
  }

  removeMemoPin(page: number, id: string) {
    const current = { ...(this.memoPins[page] ?? {}) };
    delete current[id];
    this.memoPins = { ...this.memoPins, [page]: current };
    this.markDirty();
  }

  remove(page: number, id: string) {
    const current = { ...(this.byPage[page] ?? {}) };
    delete current[id];
    this.byPage = { ...this.byPage, [page]: current };
    this.markDirty();
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
        this.markDirty();
      }
      return;
    }
    this.byPage = { ...this.byPage, [page]: mapped };
    if (markDirty) {
      this.markDirty();
    }
  }

  clear() {
    this.byPage = {};
    this.photoPins = {};
    this.memoPins = {};
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

  exportMemoPins(): Record<number, Record<string, MemoPinRecord>> {
    return this.memoPins;
  }

  importByPage(
    byPage: Record<number, PageObjects>,
    photoPins: Record<number, Record<string, PhotoPinRecord>> = {},
    memoPins: Record<number, Record<string, MemoPinRecord>> = {},
  ) {
    this.byPage = byPage;
    this.photoPins = parsePhotoPins(photoPins);
    this.memoPins = parseMemoPins(memoPins ?? {});
    this.dirty = false;
    this.remoteRevision += 1;
    historyStore.clear();
  }
}

export const annotationStore = new AnnotationStore();
