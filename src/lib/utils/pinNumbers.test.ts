import { describe, expect, it } from "vitest";
import type { PhotoPinRecord } from "./annotationPersist";
import {
  backfillPinCreatedAt,
  circledPinLabel,
  nextPinCreatedAt,
  numberedPins,
  pinSlideCaption,
} from "./pinNumbers";

function pin(id: string, createdAt?: number, title = ""): PhotoPinRecord {
  return {
    id,
    nx: 0.5,
    ny: 0.5,
    title,
    thumbnailDataUrl: "t",
    imageDataUrl: "f",
    ...(createdAt != null ? { createdAt } : {}),
  };
}

describe("circledPinLabel", () => {
  it("uses circled digits from 1 through 50, then parentheses", () => {
    expect(circledPinLabel(1)).toBe("①");
    expect(circledPinLabel(20)).toBe("⑳");
    expect(circledPinLabel(21)).toBe("㉑");
    expect(circledPinLabel(36)).toBe("㊱");
    expect(circledPinLabel(50)).toBe("㊿");
    expect(circledPinLabel(51)).toBe("(51)");
  });
});

describe("numberedPins", () => {
  it("numbers pins by createdAt and compacts after a removal", () => {
    const remaining = numberedPins([
      pin("c", 300),
      pin("a", 100),
      pin("b", 200),
    ].filter((item) => item.id !== "b"));
    expect(remaining.map((item) => [item.number, item.label, item.pin.id])).toEqual([
      [1, "①", "a"],
      [2, "②", "c"],
    ]);
  });

  it("breaks createdAt ties by id", () => {
    const items = numberedPins([pin("b", 10), pin("a", 10)]);
    expect(items.map((item) => item.pin.id)).toEqual(["a", "b"]);
  });
});

describe("nextPinCreatedAt", () => {
  it("uses now unless an existing pin is already at or past that time", () => {
    expect(nextPinCreatedAt([pin("a", 50)], 100)).toBe(100);
    expect(nextPinCreatedAt([pin("a", 100)], 100)).toBe(101);
    expect(nextPinCreatedAt([], 42)).toBe(42);
  });
});

describe("backfillPinCreatedAt", () => {
  it("fills missing createdAt in object order starting at 1", () => {
    const filled = backfillPinCreatedAt({
      later: pin("later"),
      first: pin("first"),
    });
    expect(filled.later.createdAt).toBe(1);
    expect(filled.first.createdAt).toBe(2);
    expect(backfillPinCreatedAt({ a: pin("a", 9) }).a.createdAt).toBe(9);
  });
});

describe("pinSlideCaption", () => {
  it("prefixes the circled number, and omits an empty title", () => {
    expect(pinSlideCaption(1, "基礎")).toBe("① 基礎");
    expect(pinSlideCaption(2, "  ")).toBe("②");
    expect(pinSlideCaption(3)).toBe("③");
  });
});
