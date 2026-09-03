import { describe, expect, it, vi } from "vitest";
import {
  pointerFromEvent,
  shouldCaptureViewportPointer,
  shouldCommitToolOnPointerDown,
  toolForPointerType,
} from "./fabricPointer";

describe("pointerFromEvent", () => {
  it("reads the scene point from a Fabric 7 canvas", () => {
    const getScenePoint = vi.fn().mockReturnValue({ x: 40, y: 80 });
    const event = new Event("pointerdown");

    expect(pointerFromEvent({ getScenePoint }, event)).toEqual({ x: 40, y: 80 });
    expect(getScenePoint).toHaveBeenCalledWith(event);
  });
});

describe("shouldCaptureViewportPointer", () => {
  it("captures only while panning so the pen can draw on the canvas", () => {
    expect(shouldCaptureViewportPointer("pan")).toBe(true);
    expect(shouldCaptureViewportPointer("pen")).toBe(false);
    expect(shouldCaptureViewportPointer("select")).toBe(false);
    expect(shouldCaptureViewportPointer("text")).toBe(false);
  });
});

describe("toolForPointerType", () => {
  it("switches to pen when a stylus touches the drawing surface", () => {
    expect(toolForPointerType("pen", "select")).toBe("pen");
    expect(toolForPointerType("pen", "pan")).toBe("pen");
  });

  it("keeps text mode so a stylus can place a text box", () => {
    expect(toolForPointerType("pen", "text")).toBe("text");
  });

  it("does not steal the current tool from mouse, touch, or eraser", () => {
    expect(toolForPointerType("mouse", "select")).toBe("select");
    expect(toolForPointerType("touch", "select")).toBe("select");
    expect(toolForPointerType("mouse", "pen")).toBe("pen");
  });
});

describe("shouldCommitToolOnPointerDown", () => {
  it("selects toolbar tools on mouse, stylus, or finger down because click may never fire", () => {
    expect(shouldCommitToolOnPointerDown("mouse")).toBe(true);
    expect(shouldCommitToolOnPointerDown("pen")).toBe(true);
    expect(shouldCommitToolOnPointerDown("touch")).toBe(true);
  });
});

