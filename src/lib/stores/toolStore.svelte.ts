export type Tool = "select" | "pen" | "text" | "pan";

class ToolStore {
  current = $state<Tool>("select");
  penColor = $state("#E81123");
  penWidth = $state(3);
  stylusActive = $state(false);

  setTool(tool: Tool) {
    this.current = tool;
  }
}

export const toolStore = new ToolStore();
