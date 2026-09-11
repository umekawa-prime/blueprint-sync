import { describe, expect, it } from "vitest";
import {
  TEXT_BG_PADDING,
  isTextAnnotation,
  textStyleFromColors,
  textStyleFromSelection,
} from "./textStyle";

describe("textStyleFromColors", () => {
  it("uses no background and no padding when the fill-only default is requested", () => {
    expect(textStyleFromColors("#E81123", "")).toEqual({
      fill: "#E81123",
      backgroundColor: "",
      padding: 0,
    });
  });

  it("treats transparent as no background", () => {
    expect(textStyleFromColors("#000000", "transparent").backgroundColor).toBe("");
    expect(textStyleFromColors("#000000", "transparent").padding).toBe(0);
  });

  it("adds padding when a background color is set", () => {
    expect(textStyleFromColors("#FFFFFF", "#000000")).toEqual({
      fill: "#FFFFFF",
      backgroundColor: "#000000",
      padding: TEXT_BG_PADDING,
    });
    expect(TEXT_BG_PADDING).toBe(6);
  });
});

describe("isTextAnnotation", () => {
  it("accepts Fabric i-text and textbox types", () => {
    expect(isTextAnnotation({ type: "i-text" })).toBe(true);
    expect(isTextAnnotation({ type: "IText" })).toBe(true);
    expect(isTextAnnotation({ type: "textbox" })).toBe(true);
    expect(isTextAnnotation({ type: "path" })).toBe(false);
    expect(isTextAnnotation({})).toBe(false);
  });
});

describe("textStyleFromSelection", () => {
  it("returns null for non-text objects", () => {
    expect(textStyleFromSelection({ type: "path", fill: "#E81123" })).toBeNull();
  });

  it("reads fill and background from a selected i-text", () => {
    expect(
      textStyleFromSelection({
        type: "i-text",
        fill: "#0078D7",
        backgroundColor: "#FFF100",
      }),
    ).toEqual({
      fill: "#0078D7",
      backgroundColor: "#FFF100",
      padding: 6,
    });
  });

  it("treats missing background as none", () => {
    expect(textStyleFromSelection({ type: "i-text", fill: "#E81123" })).toEqual({
      fill: "#E81123",
      backgroundColor: "",
      padding: 0,
    });
  });
});
