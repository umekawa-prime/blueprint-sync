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

  it("labels LAN roles as host and client", () => {
    const connection = readFileSync(path.resolve("src/lib/components/ConnectionPanel.svelte"), "utf8");
    expect(connection).toContain("ホスト");
    expect(connection).toContain("クライアント");
    expect(connection).not.toContain("Windows ホスト");
    expect(connection).not.toContain("Android クライアント");
  });

  it("uses sandbox project home actions instead of a folder picker when RFD is off", () => {
    const home = readFileSync(path.resolve("src/lib/components/ProjectHome.svelte"), "utf8");
    expect(home).toContain("usesSandboxProjects");
    expect(home).toContain("取り込む");
    expect(home).toContain("新規作成");
  });

  it("puts a text color palette beside the text tool, separate from the pen palette", () => {
    const toolbar = readFileSync(path.resolve("src/lib/components/Toolbar.svelte"), "utf8");
    const palette = readFileSync(path.resolve("src/lib/components/TextPalette.svelte"), "utf8");
    expect(toolbar).toContain('import TextPalette from "$lib/components/TextPalette.svelte"');
    expect(toolbar).toContain('import PenPalette from "$lib/components/PenPalette.svelte"');
    expect(toolbar.indexOf('id: "text"')).toBeGreaterThan(-1);
    expect(toolbar).toMatch(/tool\.id === "text"[\s\S]*<TextPalette compact=\{compact\} \/>/);
    expect(toolbar).toMatch(/tool\.id === "pen"[\s\S]*<PenPalette \/>/);
    expect(palette).toContain("文字色");
    expect(palette).toContain("背景色");
    expect(palette).toContain("背景なし");
    expect(palette).toContain("textBackground");
    expect(palette).not.toContain('setTool("pen")');
    const viewer = readFileSync(path.resolve("src/lib/components/PdfViewer.svelte"), "utf8");
    expect(viewer).toContain("textStyleFromColors(toolStore.textColor, toolStore.textBackground)");
    expect(viewer).not.toContain("fill: toolStore.penColor");
  });

  it("keeps camera capture above the PDF canvas and hides the drawing while capturing", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    const camera = readFileSync(
      path.resolve("src/lib/components/CameraCapture.svelte"),
      "utf8",
    );
    expect(camera).toContain("CAMERA_OVERLAY_CLASS");
    expect(camera).not.toContain('class="absolute inset-0 z-30');
    expect(page).toContain("drawingLayerHiddenClass(cameraOpen)");
    expect(page.lastIndexOf("CameraCapture")).toBeGreaterThan(page.lastIndexOf("PdfViewer"));
  });
});
