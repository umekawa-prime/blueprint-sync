import type { CapShape } from "$lib/utils/strokeCaps";
import type { StampKind } from "$lib/utils/stampDraw";

export type Tool =
  | "select"
  | "stamp"
  | "pen"
  | "eraser"
  | "text"
  | "pan"
  | "rect"
  | "ellipse"
  | "arrow";

class ToolStore {
  current = $state<Tool>("select");
  penColor = $state("#E81123");
  textColor = $state("#E81123");
  textBackground = $state("");
  penWidth = $state(3);
  penStartCap = $state<CapShape>("none");
  penEndCap = $state<CapShape>("none");
  stampKind = $state<StampKind>("light");
  stylusActive = $state(false);

  setTool(tool: Tool) {
    this.current = tool;
  }
}

export const toolStore = new ToolStore();
