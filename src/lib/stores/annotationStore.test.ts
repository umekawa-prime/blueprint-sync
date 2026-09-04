import { describe, expect, it } from "vitest";
import { annotationStore } from "./annotationStore.svelte";

describe("annotationStore.replacePage", () => {
  it("does not mark annotations dirty when taking a render snapshot", () => {
    annotationStore.importByPage({});
    expect(annotationStore.dirty).toBe(false);

    annotationStore.replacePage(0, [{ id: "a", type: "path" }], false);

    expect(annotationStore.objectsFor(0)).toEqual([{ id: "a", type: "path" }]);
    expect(annotationStore.dirty).toBe(false);
  });

  it("does not rewrite page state when a render snapshot is unchanged", () => {
    annotationStore.importByPage({ 0: { a: { id: "a", type: "path" } } });
    const before = annotationStore.byPage;

    annotationStore.replacePage(0, [{ id: "a", type: "path" }], false);

    expect(annotationStore.byPage).toBe(before);
    expect(annotationStore.dirty).toBe(false);
  });

  it("marks annotations dirty when the user changes a page", () => {
    annotationStore.importByPage({});
    annotationStore.replacePage(0, [{ id: "a", type: "path" }]);
    expect(annotationStore.dirty).toBe(true);
  });
});

describe("annotationStore photo pins", () => {
  it("adds a pin at the click position without placing a full image object", () => {
    annotationStore.importByPage({});
    annotationStore.addPhotoPin(1, {
      id: "pin-1",
      nx: 0.3,
      ny: 0.7,
      thumbnailDataUrl: "data:image/jpeg;base64,thumb",
      imageDataUrl: "data:image/jpeg;base64,full",
    });

    expect(annotationStore.objectsFor(1)).toEqual([]);
    expect(annotationStore.pinsFor(1)).toEqual([
      {
        id: "pin-1",
        nx: 0.3,
        ny: 0.7,
        thumbnailDataUrl: "data:image/jpeg;base64,thumb",
        imageDataUrl: "data:image/jpeg;base64,full",
      },
    ]);
    expect(annotationStore.dirty).toBe(true);
  });

  it("clears photo pins with the rest of the annotations", () => {
    annotationStore.addPhotoPin(0, {
      id: "pin-1",
      nx: 0.1,
      ny: 0.2,
      thumbnailDataUrl: "t",
      imageDataUrl: "f",
    });
    annotationStore.clear();
    expect(annotationStore.pinsFor(0)).toEqual([]);
  });
});
