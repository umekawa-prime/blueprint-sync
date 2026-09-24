import { describe, expect, it } from "vitest";
import { parseAnnotations, serializeAnnotations } from "./annotationPersist";

describe("annotationPersist", () => {
  it("round-trips page objects", () => {
    const byPage = {
      0: { a: { id: "a", type: "path" } },
      2: { b: { id: "b", type: "i-text" } },
    };
    expect(parseAnnotations(serializeAnnotations(byPage))).toEqual({
      byPage,
      photoPins: {},
      memoPins: {},
    });
  });

  it("round-trips memo pins next to page objects", () => {
    const byPage = { 0: { a: { id: "a", type: "path" } } };
    const memoPins = {
      0: {
        "memo-1": {
          id: "memo-1",
          nx: 0.42,
          ny: 0.31,
          text: "梁成を現場で確認",
          color: "#E81123",
          createdAt: 100,
        },
      },
    };
    expect(parseAnnotations(serializeAnnotations(byPage, {}, { memoPins }))).toEqual({
      byPage,
      photoPins: {},
      memoPins,
    });
  });

  it("defaults missing memo color and treats missing memoPins as empty", () => {
    expect(parseAnnotations('{"byPage":{}}')).toEqual({
      byPage: {},
      photoPins: {},
      memoPins: {},
    });
    expect(
      parseAnnotations(
        '{"byPage":{},"memoPins":{"0":{"memo-1":{"id":"memo-1","nx":0.1,"ny":0.2,"text":"確認","color":"red"}}}}',
      ).memoPins[0]["memo-1"].color,
    ).toBe("#E81123");
  });

  it("round-trips photo pins next to page objects", () => {
    const byPage = { 0: { a: { id: "a", type: "path" } } };
    const photoPins = {
      0: {
        "pin-1": {
          id: "pin-1",
          nx: 0.4,
          ny: 0.6,
          title: "",
          images: [
            {
              id: "pin-1-img-1",
              thumbnailDataUrl: "data:image/jpeg;base64,aaa",
              imageDataUrl: "data:image/jpeg;base64,bbb",
            },
          ],
          createdAt: 100,
        },
      },
    };
    expect(parseAnnotations(serializeAnnotations(byPage, photoPins))).toEqual({
      byPage,
      photoPins,
      memoPins: {},
    });
  });

  it("round-trips photo pin titles and treats missing titles as empty", () => {
    const byPage = { 0: { a: { id: "a", type: "path" } } };
    const photoPins = {
      0: {
        "pin-1": {
          id: "pin-1",
          nx: 0.4,
          ny: 0.6,
          title: "基礎配筋",
          images: [
            {
              id: "pin-1-img-1",
              thumbnailDataUrl: "data:image/jpeg;base64,aaa",
              imageDataUrl: "data:image/jpeg;base64,bbb",
            },
          ],
          createdAt: 100,
        },
      },
    };
    expect(parseAnnotations(serializeAnnotations(byPage, photoPins))).toEqual({
      byPage,
      photoPins,
      memoPins: {},
    });
    expect(
      parseAnnotations(
        '{"byPage":{},"photoPins":{"0":{"pin-1":{"id":"pin-1","nx":0.1,"ny":0.2,"thumbnailDataUrl":"t","imageDataUrl":"f"}}}}',
      ).photoPins[0]["pin-1"].title,
    ).toBe("");
  });

  it("round-trips drawing page layout so pin slides can be stripped on reopen", () => {
    const parsed = parseAnnotations(
      serializeAnnotations(
        {},
        {},
        { drawingPageCount: 2, pinSlideCountByPage: [1, 0] },
      ),
    );
    expect(parsed.drawingPageCount).toBe(2);
    expect(parsed.pinSlideCountByPage).toEqual([1, 0]);
  });

  it("round-trips createdAt and backfills missing values in object order", () => {
    expect(
      parseAnnotations(
        '{"byPage":{},"photoPins":{"0":{"later":{"id":"later","nx":0.1,"ny":0.2,"thumbnailDataUrl":"t","imageDataUrl":"f"},"first":{"id":"first","nx":0.3,"ny":0.4,"thumbnailDataUrl":"t","imageDataUrl":"f"}}}}',
      ).photoPins[0],
    ).toEqual({
      later: {
        id: "later",
        nx: 0.1,
        ny: 0.2,
        title: "",
        images: [{ id: "later-img-1", thumbnailDataUrl: "t", imageDataUrl: "f" }],
        createdAt: 1,
      },
      first: {
        id: "first",
        nx: 0.3,
        ny: 0.4,
        title: "",
        images: [{ id: "first-img-1", thumbnailDataUrl: "t", imageDataUrl: "f" }],
        createdAt: 2,
      },
    });
  });

  it("treats legacy files without photoPins as empty pins", () => {
    expect(parseAnnotations('{"byPage":{"0":{"a":{"id":"a","type":"path"}}}}')).toEqual({
      byPage: { 0: { a: { id: "a", type: "path" } } },
      photoPins: {},
      memoPins: {},
    });
  });

  it("rejects non-objects", () => {
    expect(() => parseAnnotations("[]")).toThrow(/invalid annotation/i);
    expect(() => parseAnnotations("{")).toThrow(/invalid annotation/i);
  });

  it("rejects page values that are arrays", () => {
    expect(() => parseAnnotations('{"byPage":{"0":[]}}')).toThrow(/invalid annotation/i);
  });

  it("rejects page object values that are primitives", () => {
    expect(() => parseAnnotations('{"byPage":{"0":{"a":1}}}')).toThrow(/invalid annotation/i);
  });
});
