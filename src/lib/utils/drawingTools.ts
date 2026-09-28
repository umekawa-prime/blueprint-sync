import type { Tool } from "$lib/stores/toolStore.svelte";

export type DrawingTool = {
  id: Tool;
  label: string;
};

const DRAWING_TOOLS: DrawingTool[] = [
  { id: "select", label: "選択" },
  { id: "stamp", label: "図形" },
  { id: "pen", label: "ペン" },
  { id: "eraser", label: "消しゴム" },
  { id: "text", label: "テキスト" },
  { id: "pan", label: "移動" },
  { id: "rect", label: "矩形" },
  { id: "ellipse", label: "楕円" },
  { id: "arrow", label: "矢印線" },
];

export function isPenMode(tool: Tool): boolean {
  return tool === "pen" || tool === "eraser";
}

export function isShapeTool(tool: Tool): tool is "rect" | "ellipse" | "arrow" {
  return tool === "rect" || tool === "ellipse" || tool === "arrow";
}

export function isStampTool(tool: Tool): tool is "stamp" {
  return tool === "stamp";
}

export function drawingTools(_tool: Tool): DrawingTool[] {
  return DRAWING_TOOLS;
}
