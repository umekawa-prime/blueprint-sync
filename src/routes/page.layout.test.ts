import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("editor shell layout", () => {
  it("puts the project tab bar at the top of the window", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    expect(page.indexOf("ProjectTabBar")).toBeGreaterThan(-1);
    expect(page.indexOf("ProjectTabBar")).toBeLessThan(page.indexOf("ProjectHome"));
  });

  it("uses a Chrome-style custom title bar on desktop Tauri", () => {
    const conf = readFileSync(path.resolve("src-tauri/tauri.conf.json"), "utf8");
    const capabilities = readFileSync(
      path.resolve("src-tauri/capabilities/default.json"),
      "utf8",
    );
    const tabBar = readFileSync(path.resolve("src/lib/components/ProjectTabBar.svelte"), "utf8");

    expect(conf).toContain('"decorations": false');
    expect(capabilities).toContain("core:window:allow-start-dragging");
    expect(capabilities).toContain("core:window:allow-minimize");
    expect(capabilities).toContain("core:window:allow-toggle-maximize");
    expect(capabilities).toContain("core:window:allow-close");
    expect(tabBar).toContain("data-tauri-drag-region");
    expect(tabBar).toContain("WindowControls");
    expect(tabBar).toContain("isDesktopTauriRuntime");
  });
});
