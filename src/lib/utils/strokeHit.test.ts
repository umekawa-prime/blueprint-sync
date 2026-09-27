import { describe, expect, it } from "vitest";
import { hitShapeContains, indexOfErasableHit, type HitItem } from "./strokeHit";

const line: HitItem = {
  erasable: true,
  geometry: {
    kind: "stroke",
    points: [
      { x: 0, y: 10 },
      { x: 40, y: 10 },
    ],
    strokeWidth: 4,
  },
};

describe("stroke eraser hit", () => {
  it("hits the centerline within half the stroke width and misses beyond it", () => {
    expect(hitShapeContains(line.geometry, { x: 20, y: 12 })).toBe(true);
    expect(hitShapeContains(line.geometry, { x: 20, y: 15 })).toBe(false);
  });

  it("returns each touched stroke once, from the top of the stack", () => {
    const lower = line;
    const upper: HitItem = {
      erasable: true,
      geometry: {
        kind: "stroke",
        points: [
          { x: 0, y: 10 },
          { x: 40, y: 10 },
        ],
        strokeWidth: 2,
      },
    };
    expect(indexOfErasableHit([lower, upper], { x: 10, y: 10 })).toBe(1);
    expect(indexOfErasableHit([lower], { x: 10, y: 10 })).toBe(0);
  });

  it("ignores text and shape marks", () => {
    const items: HitItem[] = [
      line,
      { erasable: false, geometry: { kind: "ignore" } },
      {
        erasable: false,
        geometry: {
          kind: "stroke",
          points: [
            { x: 0, y: 10 },
            { x: 40, y: 10 },
          ],
          strokeWidth: 20,
        },
      },
    ];
    expect(indexOfErasableHit(items, { x: 10, y: 10 })).toBe(0);
  });

  it("treats a capped group as one stroke when the line or the cap is touched", () => {
    const group: HitItem = {
      erasable: true,
      geometry: {
        kind: "group",
        children: [
          {
            kind: "stroke",
            points: [
              { x: 0, y: 0 },
              { x: 30, y: 0 },
            ],
            strokeWidth: 3,
          },
          {
            kind: "polygon",
            points: [
              { x: 30, y: 0 },
              { x: 22, y: 4 },
              { x: 22, y: -4 },
            ],
          },
        ],
      },
    };
    expect(hitShapeContains(group.geometry, { x: 12, y: 1 })).toBe(true);
    expect(hitShapeContains(group.geometry, { x: 26, y: 0 })).toBe(true);
    expect(hitShapeContains(group.geometry, { x: 26, y: 20 })).toBe(false);
  });
});
