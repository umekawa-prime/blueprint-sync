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
