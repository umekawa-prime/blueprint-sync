<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import {
    Canvas,
    IText,
    PencilBrush,
    Polyline,
    util,
    type FabricObject,
  } from "fabric";
  import { annotationStore } from "$lib/stores/annotationStore.svelte";
  import { historyStore } from "$lib/stores/historyStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { broadcastAnnotation } from "$lib/utils/connectionActions";
  import { imageBlobFromPicked, pickImagesFromDisk, readFileAsBytes } from "$lib/utils/fileAccess";
  import { createPhotoPinAssets } from "$lib/utils/imageResize";
  import { importBrowserPdfIntoProject, importTauriPdfIntoProject } from "$lib/utils/projectDrop";
  import { firstDroppedPdf, firstDroppedPdfOrZip, filePathsFromUriList, firstDroppedImportPath } from "$lib/utils/pdfDrop";
  import { pointerFromEvent, shouldCaptureViewportPointer, toolForPointerType } from "$lib/utils/fabricPointer";
  import {
    addStraightPoint,
    commitStraightPoints,
    emptyStraightStroke,
    rubberBandPoints,
    shouldUseStraightStroke,
    type StraightStrokeSession,
  } from "$lib/utils/straightStroke";
  import { createStraightStrokeObject, decorateDrawnPath } from "$lib/utils/penStrokeFabric";
  import {
    textStyleFromColors,
    textStyleFromSelection,
    textStylesEqual,
  } from "$lib/utils/textStyle";
  import {
    LONG_PRESS_MS,
    menuPosition,
    shouldOpenViewerMenu,
    shouldStartLongPress,
    viewerMenuSize,
  } from "$lib/utils/viewerMenu";
  import { fabricToNormalized, pdfPageNumber } from "$lib/utils/pdfCoords";
  import { renderPdfPage } from "$lib/utils/pdfRenderer";
  import { isTauriRuntime } from "$lib/utils/platform";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { sendCurrentPdf } from "$lib/utils/connectionActions";
  import type { EditCommand } from "$lib/utils/editHistory";
  import { staggeredPinPosition } from "$lib/utils/photoPinUi";
  import PhotoPinLayer from "$lib/components/PhotoPinLayer.svelte";

  let viewportEl: HTMLDivElement | undefined = $state();
  let pdfCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvas: Canvas | undefined;
  let applyingRemote = false;
  let applyingHistory = false;
  let overlaysStale = false;
  let pendingModify:
    | { id: string; object: Record<string, unknown> }
    | undefined;
  let unlistenDrag: (() => void) | undefined;
  let lastTap = { x: 120, y: 120 };
  let renderToken = 0;
  let menu = $state({ open: false, x: 0, y: 0 });
  let menuEl: HTMLDivElement | undefined = $state();
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressAt = { x: 0, y: 0 };
  let straightSession: StraightStrokeSession = emptyStraightStroke();
  let straightPreview: Polyline | undefined;

  const CUSTOM_PROPS = ["id"];
  let persistedPage = 0;

  async function exportVisibleOverlays(): Promise<
    Array<{
      pageIndex: number;
      pngBytes: Uint8Array;
      canvasWidth: number;
      canvasHeight: number;
    }>
  > {
    if (!fabricCanvas || !pdfStore.document) {
      return [];
    }

    persistCurrentPage();
    const overlays = [];
    const previous = pdfStore.pageIndex;

    for (let pageIndex = 0; pageIndex < pdfStore.pageCount; pageIndex += 1) {
      await pdfStore.setPage(pageIndex);
      await renderCurrentPage();
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      const dataUrl = fabricCanvas.toDataURL({
        format: "png",
        multiplier: 2,
      });
      overlays.push({
        pageIndex,
        pngBytes: dataUrlToBytes(dataUrl),
        canvasWidth: fabricCanvas.getWidth(),
        canvasHeight: fabricCanvas.getHeight(),
      });
    }

    await pdfStore.setPage(previous);
    await renderCurrentPage();
    return overlays;
  }

  async function addPhotoFromFile(file: Blob, offsetIndex = 0) {
    if (!fabricCanvas) {
      return;
    }
    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();
    if (width <= 0 || height <= 0) {
      return;
    }
    const assets = await createPhotoPinAssets(file);
    const { nx, ny } = staggeredPinPosition(
      fabricToNormalized(lastTap.x, lastTap.y, width, height),
      offsetIndex,
    );
    annotationStore.addPhotoPin(pdfStore.pageIndex, {
      id: crypto.randomUUID(),
      nx,
      ny,
      thumbnailDataUrl: assets.thumbnailDataUrl,
      imageDataUrl: assets.imageDataUrl,
    });
  }

  async function requestInsertImage() {
    closeViewerMenu();
    const picked = await pickImagesFromDisk();
    for (const [index, item] of picked.entries()) {
      await addPhotoFromFile(imageBlobFromPicked(item), index);
    }
  }

  function openViewerMenu(clientX: number, clientY: number) {
    if (!pdfStore.document) {
      return;
    }
    const size = viewerMenuSize(2);
    const pos = menuPosition(clientX, clientY, size.width, size.height, window.innerWidth, window.innerHeight);
    menu = { open: true, x: pos.x, y: pos.y };
  }

  function closeViewerMenu() {
    menu = { open: false, x: menu.x, y: menu.y };
  }

  function requestCaptureImage() {
    closeViewerMenu();
    viewerApi.openCamera();
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = undefined;
    }
  }

  onMount(() => {
    void setupDragDrop();
    if (!fabricCanvasEl) {
      return;
    }

    try {
      fabricCanvas = new Canvas(fabricCanvasEl, {
        selection: true,
        preserveObjectStacking: true,
        enableRetinaScaling: true,
        fireRightClick: true,
        stopContextMenu: true,
      });
      fabricCanvas.enablePointerEvents = true;
      fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    } catch (error) {
      pdfStore.status =
        error instanceof Error ? error.message : "キャンバスを初期化できませんでした";
      return;
    }
    viewerApi.exportOverlays = exportVisibleOverlays;
    viewerApi.addPhoto = addPhotoFromFile;
    viewerApi.undo = () => {
      void undoLast();
    };
    viewerApi.redo = () => {
      void redoLast();
    };
    viewerApi.persistPage = persistCurrentPage;
    viewerApi.discardOverlays = () => {
      overlaysStale = true;
      fabricCanvas?.clear();
      fabricCanvas?.requestRenderAll();
    };
    applyTool();
    bindFabricEvents();
    if (pdfStore.document) {
      void renderCurrentPage();
    }

    const onKey = (event: KeyboardEvent) => {
      if (!fabricCanvas) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = fabricCanvas.getActiveObject();
        if (target && !isEditingText(target)) {
          removeObject(target);
        }
      }
      if (event.key === "Escape") {
        if (straightSession.points.length > 0) {
          finishStraightStroke(false);
          return;
        }
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        const target = fabricCanvas.getActiveObject();
        if (target && isEditingText(target)) {
          return;
        }
        event.preventDefault();
        if (event.shiftKey) {
          void redoLast();
        } else {
          void undoLast();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        const target = fabricCanvas.getActiveObject();
        if (target && isEditingText(target)) {
          return;
        }
        event.preventDefault();
        void redoLast();
      }
    };
    const onWindowPointerDown = (event: PointerEvent) => {
      if (menuEl?.contains(event.target as Node)) {
        return;
      }
      if (event.button === 0) {
        closeViewerMenu();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onWindowPointerDown);
    viewportEl?.addEventListener("pointerdown", onPointerDownCapture, true);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      viewportEl?.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  });

  onDestroy(() => {
    clearLongPress();
    persistCurrentPage();
    fabricCanvas?.dispose();
    unlistenDrag?.();
  });

  $effect(() => {
    toolStore.current;
    toolStore.penColor;
    toolStore.penWidth;
    applyTool();
  });

  $effect(() => {
    toolStore.textColor;
    toolStore.textBackground;
    applyTextStyleToActive();
  });

  $effect(() => {
    pdfStore.document;
    pdfStore.pageIndex;
    pdfStore.zoom;
    void renderCurrentPage();
  });

  $effect(() => {
    annotationStore.remoteRevision;
    if (fabricCanvas && pdfStore.document && !applyingRemote) {
      void restorePageObjects();
    }
  });

  function applyTool() {
    if (!fabricCanvas) {
      return;
    }
    const drawing = toolStore.current === "pen" && straightSession.points.length === 0;
    if (drawing && !fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    }
    fabricCanvas.isDrawingMode = drawing;
    fabricCanvas.selection = toolStore.current === "select";
    fabricCanvas.skipTargetFind = toolStore.current === "pan" || toolStore.current === "pen";
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = toolStore.penColor;
      fabricCanvas.freeDrawingBrush.width = toolStore.penWidth;
    }
  }

  function syncTextStyleFromSelection() {
    const style = textStyleFromSelection(fabricCanvas?.getActiveObject());
    if (!style) {
      return;
    }
    if (toolStore.textColor !== style.fill) {
      toolStore.textColor = style.fill;
    }
    if (toolStore.textBackground !== style.backgroundColor) {
      toolStore.textBackground = style.backgroundColor;
    }
  }

  function applyTextStyleToActive() {
    if (!fabricCanvas || applyingRemote || applyingHistory) {
      return;
    }
    const target = fabricCanvas.getActiveObject();
    const current = textStyleFromSelection(target);
    if (!target || !current) {
      return;
    }
    const next = textStyleFromColors(toolStore.textColor, toolStore.textBackground);
    if (textStylesEqual(current, next)) {
      return;
    }
    const id = getId(target);
    if (id) {
      pendingModify = {
        id,
        object: target.toObject(CUSTOM_PROPS) as Record<string, unknown>,
      };
    }
    target.set({
      fill: next.fill,
      backgroundColor: next.backgroundColor,
      padding: next.padding,
    });
    target.setCoords();
    fabricCanvas.requestRenderAll();
    emitObject("modify", target);
  }

  function currentPenStrokeStyle() {
    return {
      color: toolStore.penColor,
      width: toolStore.penWidth,
      startCap: toolStore.penStartCap,
      endCap: toolStore.penEndCap,
    };
  }

  function syncStraightPreview(points: { x: number; y: number }[]) {
    if (!fabricCanvas) {
      return;
    }
    if (straightPreview) {
      fabricCanvas.remove(straightPreview);
      straightPreview = undefined;
    }
    if (points.length < 2) {
      fabricCanvas.requestRenderAll();
      return;
    }
    straightPreview = new Polyline(points, {
      fill: "",
      stroke: toolStore.penColor,
      strokeWidth: toolStore.penWidth,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    fabricCanvas.add(straightPreview);
    fabricCanvas.requestRenderAll();
  }

  function abortStraightStroke() {
    if (straightPreview && fabricCanvas) {
      fabricCanvas.remove(straightPreview);
    }
    straightPreview = undefined;
    straightSession = emptyStraightStroke();
  }

  function finishStraightStroke(commit: boolean) {
    if (straightPreview && fabricCanvas) {
      fabricCanvas.remove(straightPreview);
    }
    straightPreview = undefined;
    const points = commit ? commitStraightPoints(straightSession) : null;
    straightSession = emptyStraightStroke();
    if (points && fabricCanvas && !applyingRemote && !applyingHistory) {
      const object = createStraightStrokeObject(points, currentPenStrokeStyle());
      assignId(object);
      fabricCanvas.add(object);
      emitObject("add", object);
    }
    fabricCanvas?.requestRenderAll();
    applyTool();
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key !== "Shift" || !fabricCanvas) {
      return;
    }
    if (straightSession.points.length === 0 && !straightPreview) {
      return;
    }
    finishStraightStroke(true);
  }

  function bindFabricEvents() {
    if (!fabricCanvas) {
      return;
    }

    fabricCanvas.on("mouse:down", (opt) => {
      const event = opt.e as PointerEvent | undefined;
      if (!event) {
        return;
      }
      const pointer = pointerFromEvent(fabricCanvas!, event);
      lastTap = { x: pointer.x, y: pointer.y };

      if (
        shouldUseStraightStroke({
          tool: toolStore.current,
          shiftKey: event.shiftKey,
          pointerType: event.pointerType ?? "",
          ctrlOrMeta: event.ctrlKey || event.metaKey,
        })
      ) {
        fabricCanvas!.isDrawingMode = false;
        straightSession = addStraightPoint(straightSession, pointer);
        syncStraightPreview(rubberBandPoints(straightSession, pointer));
        return;
      }

      if (shouldOpenViewerMenu({ type: event.type, button: event.button, pointerType: event.pointerType })) {
        openViewerMenu(event.clientX, event.clientY);
        return;
      }

      if (opt.target) {
        const id = getId(opt.target);
        if (id) {
          pendingModify = {
            id,
            object: opt.target.toObject(CUSTOM_PROPS) as Record<string, unknown>,
          };
        }
      }

      if (event.pointerType === "pen") {
        toolStore.stylusActive = true;
        if (fabricCanvas!.freeDrawingBrush && event.pressure > 0) {
          fabricCanvas!.freeDrawingBrush.width =
            toolStore.penWidth * (0.35 + event.pressure * 1.4);
        }
      }

      if (
        toolStore.current === "pen" &&
        event.pointerType === "touch" &&
        toolStore.stylusActive
      ) {
        fabricCanvas!.isDrawingMode = false;
        return;
      }

      if (toolStore.current === "text" && !opt.target) {
        const style = textStyleFromColors(toolStore.textColor, toolStore.textBackground);
        const text = new IText("テキスト", {
          left: pointer.x,
          top: pointer.y,
          fill: style.fill,
          backgroundColor: style.backgroundColor,
          padding: style.padding,
          fontSize: 22,
          fontFamily: "Noto Sans JP Variable",
        });
        assignId(text);
        fabricCanvas!.add(text);
        fabricCanvas!.setActiveObject(text);
        text.enterEditing();
        emitObject("add", text);
        toolStore.setTool("select");
      }
    });

    fabricCanvas.on("mouse:move", (opt) => {
      if (straightSession.points.length === 0 || !fabricCanvas) {
        return;
      }
      const event = opt.e as PointerEvent | undefined;
      if (!event?.shiftKey) {
        return;
      }
      const pointer = pointerFromEvent(fabricCanvas, event);
      syncStraightPreview(rubberBandPoints(straightSession, pointer));
    });

    fabricCanvas.on("mouse:up", () => {
      if (toolStore.current === "pen" && fabricCanvas) {
        if (straightSession.points.length > 0) {
          fabricCanvas.isDrawingMode = false;
          return;
        }
        fabricCanvas.isDrawingMode = true;
        if (fabricCanvas.freeDrawingBrush) {
          fabricCanvas.freeDrawingBrush.width = toolStore.penWidth;
        }
      }
    });

    fabricCanvas.on("path:created", (opt) => {
      const path = (opt as { path?: FabricObject }).path;
      if (!path || !fabricCanvas) {
        return;
      }
      const decorated = decorateDrawnPath(path, currentPenStrokeStyle());
      if (decorated !== path) {
        fabricCanvas.remove(path);
        fabricCanvas.add(decorated);
      }
      assignId(decorated);
      emitObject("add", decorated);
    });

    fabricCanvas.on("object:modified", (opt) => {
      if (opt.target) {
        emitObject("modify", opt.target);
      }
    });

    fabricCanvas.on("selection:created", syncTextStyleFromSelection);
    fabricCanvas.on("selection:updated", syncTextStyleFromSelection);

    fabricCanvas.on("object:removed", (opt) => {
      if (applyingRemote || applyingHistory || !opt.target) {
        return;
      }
      const id = getId(opt.target);
      if (id) {
        const serialized = opt.target.toObject(CUSTOM_PROPS) as Record<string, unknown>;
        annotationStore.remove(pdfStore.pageIndex, id);
        broadcastAnnotation("remove", pdfStore.pageIndex, id);
        historyStore.push({
          op: "remove",
          page: pdfStore.pageIndex,
          id,
          before: serialized,
        });
      }
    });
  }

  async function renderCurrentPage() {
    if (!pdfStore.document || !pdfCanvasEl) {
      return;
    }
    const pageNumber = pdfPageNumber(pdfStore.pageIndex, pdfStore.pageCount);
    if (pageNumber < 1) {
      return;
    }
    const token = ++renderToken;
    untrack(() => persistCurrentPage());
    try {
      const page = await pdfStore.document.getPage(pageNumber);
      if (token !== renderToken) {
        return;
      }
      const size = await renderPdfPage(page, pdfCanvasEl, pdfStore.zoom * 1.2);
      if (token !== renderToken) {
        return;
      }
      if (fabricCanvas) {
        fabricCanvas.setDimensions({
          width: Math.floor(size.width),
          height: Math.floor(size.height),
        });
        persistedPage = pdfStore.pageIndex;
        await restorePageObjects();
      }
    } catch (error) {
      if (token !== renderToken) {
        return;
      }
      pdfStore.status =
        error instanceof Error ? error.message : "PDFを表示できませんでした";
    }
  }

  function persistCurrentPage() {
    if (!fabricCanvas || applyingRemote || applyingHistory || overlaysStale) {
      return;
    }
    if (projectStore.currentPdf && pdfStore.name !== projectStore.currentPdf) {
      return;
    }
    const objects = fabricCanvas
      .getObjects()
      .filter((object) => getId(object))
      .map((object) => object.toObject(CUSTOM_PROPS) as Record<string, unknown>);
    annotationStore.replacePage(persistedPage, objects, false);
  }

  async function restorePageObjects() {
    if (!fabricCanvas) {
      return;
    }
    applyingRemote = true;
    abortStraightStroke();
    fabricCanvas.clear();
    const objects = annotationStore.objectsFor(pdfStore.pageIndex);
    if (objects.length > 0) {
      const revived = await util.enlivenObjects<FabricObject>(objects);
      revived.forEach((object) => fabricCanvas!.add(object));
    }
    fabricCanvas.requestRenderAll();
    applyingRemote = false;
    overlaysStale = false;
    applyTool();
  }

  function assignId(object: FabricObject) {
    const current = getId(object) ?? crypto.randomUUID();
    Object.assign(object, { id: current });
    return current;
  }

  function getId(object: FabricObject): string | undefined {
    const value = (object as FabricObject & { id?: string }).id;
    return typeof value === "string" ? value : undefined;
  }

  function emitObject(op: "add" | "modify", object: FabricObject) {
    if (applyingRemote || applyingHistory) {
      return;
    }
    const id = assignId(object);
    const serialized = object.toObject(CUSTOM_PROPS) as Record<string, unknown>;
    annotationStore.upsert(pdfStore.pageIndex, id, serialized);
    broadcastAnnotation(op, pdfStore.pageIndex, id, serialized);
    if (op === "add") {
      historyStore.push({
        op: "add",
        page: pdfStore.pageIndex,
        id,
        after: serialized,
      });
      return;
    }
    historyStore.push({
      op: "modify",
      page: pdfStore.pageIndex,
      id,
      before: pendingModify?.id === id ? pendingModify.object : undefined,
      after: serialized,
    });
    pendingModify = undefined;
  }

  async function undoLast() {
    const command = historyStore.undo();
    if (command) {
      await applyHistoryCommand(command);
    }
  }

  async function redoLast() {
    const command = historyStore.redo();
    if (command) {
      await applyHistoryCommand(command);
    }
  }

  async function applyHistoryCommand(command: EditCommand) {
    applyingHistory = true;
    try {
      if (command.op === "remove") {
        annotationStore.remove(command.page, command.id);
        broadcastAnnotation("remove", command.page, command.id);
        if (fabricCanvas && command.page === pdfStore.pageIndex) {
          const target = fabricCanvas
            .getObjects()
            .find((object) => getId(object) === command.id);
          if (target) {
            fabricCanvas.remove(target);
          }
        }
        return;
      }
      if (command.op === "add" && command.after) {
        annotationStore.upsert(command.page, command.id, command.after);
        broadcastAnnotation("add", command.page, command.id, command.after);
        if (fabricCanvas && command.page === pdfStore.pageIndex) {
          const revived = await util.enlivenObjects<FabricObject>([command.after]);
          revived.forEach((object) => fabricCanvas!.add(object));
          fabricCanvas.requestRenderAll();
        }
        return;
      }
      if (command.op === "modify" && command.after) {
        annotationStore.upsert(command.page, command.id, command.after);
        broadcastAnnotation("modify", command.page, command.id, command.after);
        if (command.page === pdfStore.pageIndex) {
          await restorePageObjects();
        }
      }
    } finally {
      applyingHistory = false;
    }
  }

  function removeObject(object: FabricObject) {
    fabricCanvas?.remove(object);
  }

  function isEditingText(object: FabricObject): boolean {
    return "isEditing" in object && Boolean((object as IText).isEditing);
  }

  function allowPdfDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function droppedFileFromEvent(event: DragEvent): File | null {
    const files = event.dataTransfer?.files;
    return projectStore.isOpen ? firstDroppedPdfOrZip(files) : firstDroppedPdf(files);
  }

  function droppedPathFromEvent(event: DragEvent): string | null {
    const uriList =
      event.dataTransfer?.getData("text/uri-list") || event.dataTransfer?.getData("text/plain") || "";
    const path = firstDroppedImportPath(filePathsFromUriList(uriList));
    if (!path) {
      return null;
    }
    if (!projectStore.isOpen && !path.toLowerCase().endsWith(".pdf")) {
      return null;
    }
    return path;
  }

  async function onPdfFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const file = droppedFileFromEvent(event);
    const path = file ? null : droppedPathFromEvent(event);
    if (!file && !path) {
      pdfStore.status = "PDF または ZIP をドロップしてください";
      return;
    }
    try {
      if (projectStore.isOpen) {
        if (file) {
          await importBrowserPdfIntoProject(file);
          return;
        }
        await importTauriPdfIntoProject(path!);
        return;
      }
      if (path) {
        const { invoke } = await import("@tauri-apps/api/core");
        const bytes = await invoke<number[]>("read_file_bytes", { path });
        annotationStore.clear();
        await pdfStore.load(
          path.split(/[/\\]/).pop() ?? "document.pdf",
          Uint8Array.from(bytes),
        );
        sendCurrentPdf();
        return;
      }
      annotationStore.clear();
      await pdfStore.load(file!.name, await readFileAsBytes(file!));
      sendCurrentPdf();
    } catch (error) {
      pdfStore.status = error instanceof Error ? error.message : "PDFを開けませんでした";
    }
  }

  async function setupDragDrop() {
    if (!isTauriRuntime()) {
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const unlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") {
          return;
        }
        const path = firstDroppedImportPath(event.payload.paths);
        if (!path) {
          pdfStore.status = "PDF または ZIP をドロップしてください";
          return;
        }
        try {
          if (projectStore.isOpen) {
            await importTauriPdfIntoProject(path);
            return;
          }
          if (path.toLowerCase().endsWith(".zip")) {
            pdfStore.status = "ZIP はプロジェクトを開いてから取り込んでください";
            return;
          }
          const { invoke } = await import("@tauri-apps/api/core");
          const bytes = await invoke<number[]>("read_file_bytes", { path });
          annotationStore.clear();
          await pdfStore.load(
            path.split(/[/\\]/).pop() ?? "document.pdf",
            Uint8Array.from(bytes),
          );
          sendCurrentPdf();
        } catch (error) {
          pdfStore.status =
            error instanceof Error ? error.message : "PDFを開けませんでした";
        }
      });
      unlistenDrag = unlisten;
    } catch {
      // HTML5 drop still works when native drag-drop is unavailable.
    }
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    const next = pdfStore.zoom + (event.deltaY > 0 ? -0.1 : 0.1);
    pdfStore.setZoom(next);
  }

  let pinchStart = 0;
  let pinchZoom = 1;

  function onPointerDownCapture(event: PointerEvent) {
    const next = toolForPointerType(event.pointerType, toolStore.current);
    if (next !== toolStore.current) {
      toolStore.setTool(next);
      applyTool();
    }
    if (
      fabricCanvas &&
      shouldUseStraightStroke({
        tool: toolStore.current,
        shiftKey: event.shiftKey,
        pointerType: event.pointerType ?? "",
        ctrlOrMeta: event.ctrlKey || event.metaKey,
      })
    ) {
      fabricCanvas.isDrawingMode = false;
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (menuEl?.contains(event.target as Node)) {
      return;
    }
    if (event.button === 0) {
      closeViewerMenu();
    }
    if (shouldStartLongPress(event) && pdfStore.document) {
      longPressAt = { x: event.clientX, y: event.clientY };
      clearLongPress();
      longPressTimer = setTimeout(() => {
        openViewerMenu(longPressAt.x, longPressAt.y);
      }, LONG_PRESS_MS);
    }
    if (!shouldCaptureViewportPointer(toolStore.current)) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!longPressTimer) {
      return;
    }
    if (Math.hypot(event.clientX - longPressAt.x, event.clientY - longPressAt.y) > 8) {
      clearLongPress();
    }
  }

  function onPointerUp() {
    clearLongPress();
  }

  function onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (!pdfStore.document) {
      return;
    }
    openViewerMenu(event.clientX, event.clientY);
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      pinchStart = distance(event.touches[0], event.touches[1]);
      pinchZoom = pdfStore.zoom;
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && pinchStart > 0) {
      event.preventDefault();
      const current = distance(event.touches[0], event.touches[1]);
      pdfStore.setZoom(pinchZoom * (current / pinchStart));
    }
  }

  function distance(a: Touch, b: Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
</script>

<div
  bind:this={viewportEl}
  class="relative min-h-0 flex-1 overflow-auto bg-slate-950"
  class:cursor-grab={toolStore.current === "pan"}
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  oncontextmenu={onContextMenu}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ondragenter={allowPdfDrop}
  ondragover={allowPdfDrop}
  ondrop={onPdfFileDrop}
  role="application"
>
  {#if !pdfStore.document && !pdfStore.bytes}
    <div
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-slate-400"
    >
      <p class="text-lg">図面または工程表のPDFを開くか、ここにドロップしてください</p>
      <p class="text-sm">Windows で接続待機し、Android から QR で同期できます</p>
    </div>
  {/if}

  <div class="relative mx-auto w-fit" class:pointer-events-none={!pdfStore.document && !pdfStore.bytes}>
    <canvas bind:this={pdfCanvasEl} class="block bg-white shadow-2xl"></canvas>
    <div class="absolute top-0 left-0 z-[1] touch-none">
      <canvas bind:this={fabricCanvasEl}></canvas>
    </div>
    <PhotoPinLayer
      pins={Object.values(annotationStore.photoPins[pdfStore.pageIndex] ?? {})}
      onTitleChange={(id, title) => annotationStore.updatePhotoPin(pdfStore.pageIndex, id, { title })}
      onMove={(id, nx, ny) => annotationStore.updatePhotoPin(pdfStore.pageIndex, id, { nx, ny })}
    />
  </div>
</div>

{#if menu.open}
  <div
    bind:this={menuEl}
    class="fixed z-50 min-w-44 rounded-md border border-slate-600 bg-slate-900 py-1 shadow-2xl"
    style="left: {menu.x}px; top: {menu.y}px"
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
      onpointerdowncapture={(event) => {
        event.preventDefault();
        void requestInsertImage();
      }}
    >
      <svg class="h-4 w-4 shrink-0 text-cyan-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"></rect>
        <circle cx="8.5" cy="10" r="1.6" fill="currentColor"></circle>
        <path d="M7 16h10l-3.2-4.2-2.3 3-1.5-2z" fill="currentColor"></path>
      </svg>
      画像を挿入
    </button>
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
      onpointerdowncapture={(event) => {
        event.preventDefault();
        requestCaptureImage();
      }}
    >
      <svg class="h-4 w-4 shrink-0 text-cyan-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 8h3l1.2-2h7.6L17 8h3v11H4V8z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        ></path>
        <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" stroke-width="1.8"></circle>
      </svg>
      画像を撮影
    </button>
  </div>
{/if}
