import type { CapShape } from "$lib/utils/strokeCaps";

export type Tool = "select" | "pen" | "eraser" | "text" | "pan" | "rect" | "ellipse" | "arrow";

class ToolStore {
  current = $state<Tool>("select");
  penColor = $state("#E81123");
  textColor = $state("#E81123");
  textBackground = $state("");
  penWidth = $state(3);
  penStartCap = $state<CapShape>("none");
  penEndCap = $state<CapShape>("none");
  stylusActive = $state(false);

  setTool(tool: Tool) {
    this.current = tool;
  }
}

export const toolStore = new ToolStore();
