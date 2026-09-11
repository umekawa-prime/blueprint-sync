import { describe, expect, it } from "vitest";
import { pointsFromPathCommands, strokeCaps, applyObjectTransform } from "./strokeCaps";

describe("strokeCaps", () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it("adds nothing when both ends are none", () => {
    expect(
      strokeCaps({
        points: line,
        startCap: "none",
        endCap: "none",
        color: "#E81123",
        width: 3,
      }),
    ).toEqual([]);
  });

  it("uses a black filled dot independent of the stroke color", () => {
    const caps = strokeCaps({
      points: line,
      startCap: "dot",
      endCap: "none",
      color: "#E81123",
      width: 4,
    });
    expect(caps).toEqual([
      {
        kind: "dot",
        x: 0,
        y: 0,
        radius: 5,
        fill: "#000000",
      },
    ]);
  });

  it("draws an arrow in the stroke color pointing outward at that end", () => {
    const caps = strokeCaps({
      points: line,
      startCap: "none",
      endCap: "arrow",
      color: "#0078D7",
      width: 4,
    });
    expect(caps).toHaveLength(1);
    const arrow = caps[0];
    expect(arrow.kind).toBe("arrow");
    if (arrow.kind !== "arrow") {
      return;
    }
    expect(arrow.fill).toBe("#0078D7");
    expect(arrow.points[0]).toEqual({ x: 100, y: 0 });
    expect(arrow.points[1].x).toBeLessThan(100);
    expect(arrow.points[2].x).toBeLessThan(100);
  });

  it("styles start and end independently", () => {
    const caps = strokeCaps({
      points: line,
      startCap: "dot",
      endCap: "arrow",
      color: "#107C10",
      width: 3,
    });
    expect(caps.map((cap) => cap.kind)).toEqual(["dot", "arrow"]);
  });

  it("skips caps when there are not enough points", () => {
    expect(
      strokeCaps({
        points: [{ x: 1, y: 1 }],
        startCap: "dot",
        endCap: "arrow",
        color: "#000000",
        width: 3,
      }),
    ).toEqual([]);
  });

  it("maps path-local points through pathOffset and the object matrix", () => {
    expect(
      applyObjectTransform([{ x: 30, y: 10 }], { x: 10, y: 10 }, [1, 0, 0, 1, 5, 7]),
    ).toEqual([{ x: 25, y: 7 }]);
  });
});

describe("pointsFromPathCommands", () => {
  it("reads the first and last command endpoints", () => {
    expect(
      pointsFromPathCommands([
        ["M", 2, 4],
        ["Q", 8, 4, 14, 10],
        ["L", 20, 10],
      ]),
    ).toEqual([
      { x: 2, y: 4 },
      { x: 14, y: 10 },
      { x: 20, y: 10 },
    ]);
  });
});
