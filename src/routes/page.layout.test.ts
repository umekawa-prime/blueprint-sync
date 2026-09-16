import { existsSync, readFileSync, readdirSync } from "node:fs";
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
    expect(page).toContain("bootstrapOpenSession");
    expect(page).toContain("projectStore.bootstrapped");
    expect(page).toContain("!projectStore.isOpen");
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

  it("lets the home list change project workflow status and keeps completed items separate", () => {
    const home = readFileSync(path.resolve("src/lib/components/ProjectHome.svelte"), "utf8");
    expect(home).not.toContain("最近使ったプロジェクト");
    expect(home).toContain("setProjectWorkflowStatus");
    expect(home).toContain("splitProjectsByWorkflow");
    expect(home).toContain("PROJECT_WORKFLOW_STATUSES");
    expect(home).toContain(">完了</h2>");
  });

  it("lets the home list open a project folder in Cursor", () => {
    const home = readFileSync(path.resolve("src/lib/components/ProjectHome.svelte"), "utf8");
    expect(home).toContain("openFolderInCursor");
    expect(home).toContain("Cursorで開く");
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

  it("lets desktop users resize and collapse the left and right sidebars", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    const dock = readFileSync(path.resolve("src/lib/components/DockPane.svelte"), "utf8");
    const project = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    const pages = readFileSync(path.resolve("src/lib/components/PageSidebar.svelte"), "utf8");
    const todo = readFileSync(path.resolve("src/lib/components/TodoPanel.svelte"), "utf8");
    expect(page).toContain('import DockPane from "$lib/components/DockPane.svelte"');
    expect(page).toContain('side="left"');
    expect(page).toContain('side="right"');
    expect(dock).toContain("sidebarLayoutAfterDrag");
    expect(dock).toContain('aria-label={`${expandLabel}の幅を変更`}');
    expect(project).not.toContain("w-72");
    expect(pages).toContain("chromeStore.pageOpen");
    expect(todo).not.toContain("w-[22rem]");
  });

  it("opens a Backlog-style issue list stored in the project's TODO.md", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    const toolbar = readFileSync(path.resolve("src/lib/components/Toolbar.svelte"), "utf8");
    const panel = readFileSync(path.resolve("src/lib/components/TodoPanel.svelte"), "utf8");
    expect(page).toContain('import TodoPanel from "$lib/components/TodoPanel.svelte"');
    expect(page).toContain("todoStore.panelOpen");
    expect(sidebar).toContain("課題");
    expect(toolbar).toContain("課題");
    expect(panel).toContain("TODO_FILTERS");
    expect(panel).toContain("課題の件名を入力して追加");
    expect(panel).toContain("statusLabel");
    expect(panel).toContain("保存");
    expect(panel).not.toContain('type="date"');
    expect(panel).toContain("DatePicker");
    const picker = readFileSync(path.resolve("src/lib/components/DatePicker.svelte"), "utf8");
    expect(picker).toContain("calendarMonthGrid");
    expect(picker).toContain("日付を選択");
    expect(picker).not.toContain('type="date"');
    const markdown = readFileSync(path.resolve("src/lib/utils/todoMarkdown.ts"), "utf8");
    expect(markdown).toContain("完了以外");
    expect(markdown).toContain("未対応");
    expect(markdown).toContain("処理中");
    expect(markdown).toContain("処理済み");
  });

  it("opens the project folder in Cursor from the bottom of the sidebar", () => {
    const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
    expect(sidebar).toContain("Cursorで開く");
    expect(sidebar).toContain("openCurrentProjectInCursor");
    expect(sidebar.indexOf("Cursorで開く")).toBeLessThan(sidebar.indexOf("プロジェクトを閉じる"));
  });

  it("pins SvelteKit version.name so the SPA fallback payload id matches the client", () => {
    const config = readFileSync(path.resolve("svelte.config.js"), "utf8");
    expect(config).toContain('readFileSync(new URL("./package.json", import.meta.url)');
    expect(config).toContain("version:");
    expect(config).toMatch(/name:\s*version/);
    expect(config).not.toContain("Date.now()");
  });

  it("keeps the built index.html payload id in sync with start.js", () => {
    const indexPath = path.resolve("build/index.html");
    const entryDir = path.resolve("build/_app/immutable/entry");
    if (!existsSync(indexPath) || !existsSync(entryDir)) {
      return;
    }
    const startFile = readdirSync(entryDir).find((name) => name.startsWith("start."));
    expect(startFile).toBeTruthy();
    const htmlId = readFileSync(indexPath, "utf8").match(/__sveltekit_([A-Za-z0-9]+)/)?.[1];
    const clientId = readFileSync(path.join(entryDir, startFile as string), "utf8").match(
      /__sveltekit_([A-Za-z0-9]+)/,
    )?.[1];
    expect(htmlId).toBeTruthy();
    expect(htmlId).toBe(clientId);
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
