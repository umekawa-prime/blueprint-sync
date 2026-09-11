import { describe, expect, it } from "vitest";
import {
  addStraightPoint,
  commitStraightPoints,
  emptyStraightStroke,
  rubberBandPoints,
  shouldUseStraightStroke,
} from "./straightStroke";

describe("shouldUseStraightStroke", () => {
  it("uses click vertices only for the pen, Shift, and a mouse", () => {
    expect(
      shouldUseStraightStroke({
        tool: "pen",
        shiftKey: true,
        pointerType: "mouse",
        ctrlOrMeta: false,
      }),
    ).toBe(true);
  });

  it("does not steal freehand from touch, stylus, or other tools", () => {
    expect(
      shouldUseStraightStroke({
        tool: "pen",
        shiftKey: true,
        pointerType: "touch",
        ctrlOrMeta: false,
      }),
    ).toBe(false);
    expect(
      shouldUseStraightStroke({
        tool: "pen",
        shiftKey: true,
        pointerType: "pen",
        ctrlOrMeta: false,
      }),
    ).toBe(false);
    expect(
      shouldUseStraightStroke({
        tool: "select",
        shiftKey: true,
        pointerType: "mouse",
        ctrlOrMeta: false,
      }),
    ).toBe(false);
    expect(
      shouldUseStraightStroke({
        tool: "pen",
        shiftKey: false,
        pointerType: "mouse",
        ctrlOrMeta: false,
      }),
    ).toBe(false);
  });

  it("treats a missing pointer type as a mouse so Shift-click still works", () => {
    expect(
      shouldUseStraightStroke({
        tool: "pen",
        shiftKey: true,
        pointerType: "",
        ctrlOrMeta: false,
      }),
    ).toBe(true);
  });
});

describe("straight stroke session", () => {
  it("needs two points to commit a straight line", () => {
    const one = addStraightPoint(emptyStraightStroke(), { x: 10, y: 10 });
    expect(commitStraightPoints(one)).toBeNull();

    const two = addStraightPoint(one, { x: 40, y: 10 });
    expect(commitStraightPoints(two)).toEqual([
      { x: 10, y: 10 },
      { x: 40, y: 10 },
    ]);
  });

  it("keeps extra clicks as a polyline and starts a new line from an empty session", () => {
    let session = emptyStraightStroke();
    session = addStraightPoint(session, { x: 0, y: 0 });
    session = addStraightPoint(session, { x: 10, y: 0 });
    session = addStraightPoint(session, { x: 10, y: 20 });
    expect(commitStraightPoints(session)).toHaveLength(3);

    expect(commitStraightPoints(emptyStraightStroke())).toBeNull();
  });

  it("ignores a duplicate consecutive click", () => {
    let session = addStraightPoint(emptyStraightStroke(), { x: 5, y: 5 });
    session = addStraightPoint(session, { x: 5, y: 5 });
    expect(session.points).toEqual([{ x: 5, y: 5 }]);
  });

  it("rubber-bands from the last vertex to the pointer", () => {
    const session = addStraightPoint(emptyStraightStroke(), { x: 0, y: 0 });
    expect(rubberBandPoints(session, { x: 8, y: 3 })).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 3 },
    ]);
    expect(rubberBandPoints(emptyStraightStroke(), { x: 1, y: 1 })).toEqual([]);
  });
});
