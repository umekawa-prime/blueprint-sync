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
    });
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
          thumbnailDataUrl: "data:image/jpeg;base64,aaa",
          imageDataUrl: "data:image/jpeg;base64,bbb",
        },
      },
    };
    expect(parseAnnotations(serializeAnnotations(byPage, photoPins))).toEqual({
      byPage,
      photoPins,
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
          thumbnailDataUrl: "data:image/jpeg;base64,aaa",
          imageDataUrl: "data:image/jpeg;base64,bbb",
        },
      },
    };
    expect(parseAnnotations(serializeAnnotations(byPage, photoPins))).toEqual({
      byPage,
      photoPins,
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

  it("treats legacy files without photoPins as empty pins", () => {
    expect(parseAnnotations('{"byPage":{"0":{"a":{"id":"a","type":"path"}}}}')).toEqual({
      byPage: { 0: { a: { id: "a", type: "path" } } },
      photoPins: {},
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
