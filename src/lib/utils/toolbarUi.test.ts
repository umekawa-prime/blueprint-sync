import { describe, expect, it } from "vitest";
import { toolbarToolClass } from "./toolbarUi";

describe("toolbarToolClass", () => {
  it("gives the pen button a selected look distinct from the idle select button", () => {
    const selected = toolbarToolClass(true);
    const idle = toolbarToolClass(false);

    expect(selected).toContain("border-cyan-400");
    expect(selected).toContain("bg-cyan-950");
    expect(idle).toContain("border-slate-700");
    expect(idle).not.toContain("bg-cyan-950");
    expect(selected).not.toEqual(idle);
  });
});
