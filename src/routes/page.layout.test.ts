import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("editor shell layout", () => {
  it("puts the project tab bar at the top of the window", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    expect(page.indexOf("ProjectTabBar")).toBeGreaterThan(-1);
    expect(page.indexOf("ProjectTabBar")).toBeLessThan(page.indexOf("ProjectHome"));
  });

  it("shows the startup home when the tab bar plus is pressed", () => {
    const tabBar = readFileSync(path.resolve("src/lib/components/ProjectTabBar.svelte"), "utf8");
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    expect(tabBar).toContain("showProjectHome");
    expect(tabBar).not.toContain("openProjectTab");
    expect(page).toContain("{#if !projectStore.isOpen}");
    expect(page).toContain("<ProjectHome />");
    expect(page).toContain("projectStore.isOpen || projectStore.tabs.length > 0");
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

  it("lists jww drawings separately with a delete control and hover title", () => {
    const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    expect(sidebar).toContain("図面 JWW");
    expect(sidebar).toContain('onclick={() => onAddPdf("cad")}');
    expect(sidebar).toContain("listSidebarCadFiles(projectStore.pdfs)");
    expect(sidebar).toContain("title={projectPdfDisplayName(file)}");
    expect(sidebar).toContain("removeProjectPdf");
    expect(sidebar).toContain("aria-label={`${projectPdfDisplayName(file)} を削除`}");
  });

  it("renames sidebar files from a right-click menu", () => {
    const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    expect(sidebar).toContain("oncontextmenu");
    expect(sidebar).toContain("名前を変更");
    expect(sidebar).toContain("renameProjectFile");
    expect(sidebar).toContain("PDFに変換");
    expect(sidebar).toContain("convertCadFileToDrawingPdf");
    expect(sidebar).toContain("isProjectCadRelPath");
  });

  it("lets the PDF preview pan and zoom like a map instead of document scrolling", () => {
    const viewer = readFileSync(path.resolve("src/lib/components/PdfViewer.svelte"), "utf8");
    expect(viewer).toContain("overflow-hidden");
    expect(viewer).toContain("overscroll-none");
    expect(viewer).toContain("cameraCssTransform");
    expect(viewer).toContain("applyWheel");
    expect(viewer).not.toContain("overflow-auto");
    expect(viewer).not.toContain("mx-auto");
  });

  it("shows a PowerPoint-style page filmstrip beside the PDF canvas", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    const sidebar = readFileSync(path.resolve("src/lib/components/PageSidebar.svelte"), "utf8");
    const toolbar = readFileSync(path.resolve("src/lib/components/Toolbar.svelte"), "utf8");
    expect(page).toContain('import PageSidebar from "$lib/components/PageSidebar.svelte"');
    expect(page).toContain("<PageSidebar");
    expect(page.indexOf("<PageSidebar")).toBeLessThan(page.indexOf("<PdfViewer"));
    expect(sidebar).toContain("selectPdfPage");
    expect(sidebar).toContain("renderPdfThumbnails");
    expect(sidebar).toContain('aria-label="ページ一覧"');
    expect(sidebar).toContain("pdfStore.pageCount");
    expect(sidebar).toContain("aria-current");
    expect(toolbar).toContain("selectPdfPage");
    expect(toolbar).not.toContain("broadcastPage(Math.min");
  });

  it("opens the project folder in Cursor from the bottom of the sidebar", () => {
    const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    expect(sidebar).toContain("Cursorで開く");
    expect(sidebar).toContain("openCurrentProjectInCursor");
    expect(sidebar.indexOf("Cursorで開く")).toBeLessThan(sidebar.indexOf("プロジェクトを閉じる"));
  });

  it("opens Jw_cad help from a button at the bottom of the sidebar", () => {
    const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    const help = readFileSync(path.resolve("src/lib/components/JwCadHelpPanel.svelte"), "utf8");
    expect(sidebar.indexOf("プロジェクトを閉じる")).toBeLessThan(sidebar.indexOf("操作方法"));
    expect(sidebar).toContain('import JwCadHelpPanel from "$lib/components/JwCadHelpPanel.svelte"');
    expect(help).toContain("このアプリと Jw_cad");
    expect(help).toContain("Jw_cad の基本");
    expect(help).toContain("PDFに変換");
  });
});
