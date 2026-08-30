import { describe, expect, it } from "vitest";
import { parseAnnotations, serializeAnnotations } from "./annotationPersist";

describe("annotationPersist", () => {
  it("round-trips page objects", () => {
    const byPage = {
      0: { a: { id: "a", type: "path" } },
      2: { b: { id: "b", type: "i-text" } },
    };
    expect(parseAnnotations(serializeAnnotations(byPage))).toEqual(byPage);
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
