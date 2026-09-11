import type { Tool } from "$lib/stores/toolStore.svelte";

export type StrokePoint = { x: number; y: number };

export type StraightStrokeSession = {
  points: StrokePoint[];
};

export function emptyStraightStroke(): StraightStrokeSession {
  return { points: [] };
}

export function shouldUseStraightStroke(input: {
  tool: Tool;
  shiftKey: boolean;
  pointerType: string;
  ctrlOrMeta: boolean;
}): boolean {
  return (
    input.tool === "pen" &&
    input.shiftKey &&
    isMousePointer(input.pointerType) &&
    !input.ctrlOrMeta
  );
}

function isMousePointer(pointerType: string): boolean {
  return pointerType === "mouse" || pointerType === "";
}

export function addStraightPoint(
  session: StraightStrokeSession,
  point: StrokePoint,
): StraightStrokeSession {
  const last = session.points.at(-1);
  if (last && last.x === point.x && last.y === point.y) {
    return session;
  }
  return { points: [...session.points, point] };
}

export function commitStraightPoints(session: StraightStrokeSession): StrokePoint[] | null {
  return session.points.length >= 2 ? session.points : null;
}

export function rubberBandPoints(
  session: StraightStrokeSession,
  pointer: StrokePoint,
): StrokePoint[] {
  if (session.points.length === 0) {
    return [];
  }
  return [...session.points, pointer];
}
