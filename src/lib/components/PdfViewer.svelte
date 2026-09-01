<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    Canvas,
    FabricImage,
    IText,
    PencilBrush,
    util,
    type FabricObject,
  } from "fabric";
  import { annotationStore } from "$lib/stores/annotationStore.svelte";
  import { historyStore } from "$lib/stores/historyStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { broadcastAnnotation } from "$lib/utils/connectionActions";
  import { readFileAsBytes } from "$lib/utils/fileAccess";
  import { resizeImageFile } from "$lib/utils/imageResize";
  import { importBrowserPdfIntoProject, importTauriPdfIntoProject } from "$lib/utils/projectDrop";
  import { firstDroppedPdf } from "$lib/utils/pdfDrop";
  import { pointerFromEvent, shouldCaptureViewportPointer, toolForPointerType } from "$lib/utils/fabricPointer";
  import { renderPdfPage } from "$lib/utils/pdfRenderer";
  import { isTauriRuntime } from "$lib/utils/platform";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { sendCurrentPdf } from "$lib/utils/connectionActions";
  import type { EditCommand } from "$lib/utils/editHistory";

  let viewportEl: HTMLDivElement | undefined = $state();
  let pdfCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvas: Canvas | undefined;
  let applyingRemote = false;
  let applyingHistory = false;
  let pendingModify:
    | { id: string; object: Record<string, unknown> }
    | undefined;
  let unlistenDrag: (() => void) | undefined;
  let lastTap = { x: 120, y: 120 };
  let renderToken = 0;

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

  async function addPhotoFromFile(file: Blob) {
    if (!fabricCanvas) {
      return;
    }
    const resized = await resizeImageFile(file);
    const image = await FabricImage.fromURL(resized.dataUrl);
    image.set({
      left: lastTap.x,
      top: lastTap.y,
      scaleX: Math.min(1, 280 / resized.width),
      scaleY: Math.min(1, 280 / resized.width),
    });
    assignId(image);
    fabricCanvas.add(image);
    fabricCanvas.setActiveObject(image);
    emitObject("add", image);
  }

  onMount(() => {
    if (!fabricCanvasEl) {
      return;
    }

    fabricCanvas = new Canvas(fabricCanvasEl, {
      selection: true,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      fireRightClick: true,
      stopContextMenu: true,
    });
    fabricCanvas.enablePointerEvents = true;
    fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    viewerApi.exportOverlays = exportVisibleOverlays;
    viewerApi.addPhoto = addPhotoFromFile;
    viewerApi.undo = () => {
      void undoLast();
    };
    viewerApi.redo = () => {
      void redoLast();
    };
    applyTool();
    bindFabricEvents();
    void setupDragDrop();
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
    window.addEventListener("keydown", onKey);
    viewportEl?.addEventListener("pointerdown", onPointerDownCapture, true);

    return () => {
      window.removeEventListener("keydown", onKey);
      viewportEl?.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  });

  onDestroy(() => {
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
    const drawing = toolStore.current === "pen";
    if (drawing && !fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    }
    fabricCanvas.isDrawingMode = drawing;
    fabricCanvas.selection = toolStore.current === "select";
    fabricCanvas.skipTargetFind = toolStore.current === "pan" || drawing;
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = toolStore.penColor;
      fabricCanvas.freeDrawingBrush.width = toolStore.penWidth;
    }
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
        const text = new IText("テキスト", {
          left: pointer.x,
          top: pointer.y,
          fill: toolStore.penColor,
          fontSize: 22,
          fontFamily: "sans-serif",
        });
        assignId(text);
        fabricCanvas!.add(text);
        fabricCanvas!.setActiveObject(text);
        text.enterEditing();
        emitObject("add", text);
        toolStore.setTool("select");
      }
    });

    fabricCanvas.on("mouse:up", () => {
      if (toolStore.current === "pen" && fabricCanvas) {
        fabricCanvas.isDrawingMode = true;
        if (fabricCanvas.freeDrawingBrush) {
          fabricCanvas.freeDrawingBrush.width = toolStore.penWidth;
        }
      }
    });

    fabricCanvas.on("path:created", (opt) => {
      const path = (opt as { path?: FabricObject }).path;
      if (!path) {
        return;
      }
      assignId(path);
      emitObject("add", path);
    });

    fabricCanvas.on("object:modified", (opt) => {
      if (opt.target) {
        emitObject("modify", opt.target);
      }
    });

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
    if (!pdfStore.document || !pdfCanvasEl || !fabricCanvas) {
      return;
    }
    const token = ++renderToken;
    persistCurrentPage();
    try {
      const page = await pdfStore.document.getPage(pdfStore.pageIndex + 1);
      if (token !== renderToken) {
        return;
      }
      const size = await renderPdfPage(page, pdfCanvasEl, pdfStore.zoom * 1.2);
      fabricCanvas.setDimensions({
        width: Math.floor(size.width),
        height: Math.floor(size.height),
      });
      persistedPage = pdfStore.pageIndex;
      await restorePageObjects();
    } catch (error) {
      pdfStore.status =
        error instanceof Error ? error.message : "PDFを表示できませんでした";
    }
  }

  function persistCurrentPage() {
    if (!fabricCanvas) {
      return;
    }
    const objects = fabricCanvas
      .getObjects()
      .map((object) => object.toObject(CUSTOM_PROPS) as Record<string, unknown>);
    annotationStore.replacePage(persistedPage, objects);
  }

  async function restorePageObjects() {
    if (!fabricCanvas) {
      return;
    }
    applyingRemote = true;
    fabricCanvas.clear();
    const objects = annotationStore.objectsFor(pdfStore.pageIndex);
    if (objects.length > 0) {
      const revived = await util.enlivenObjects<FabricObject>(objects);
      revived.forEach((object) => fabricCanvas!.add(object));
    }
    fabricCanvas.requestRenderAll();
    applyingRemote = false;
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
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  async function onPdfFileDrop(event: DragEvent) {
    event.preventDefault();
    const file = firstDroppedPdf(event.dataTransfer?.files);
    if (!file) {
      return;
    }
    try {
      if (projectStore.isOpen) {
        await importBrowserPdfIntoProject(file);
        return;
      }
      annotationStore.clear();
      await pdfStore.load(file.name, await readFileAsBytes(file));
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
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      const unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") {
          return;
        }
        const path = event.payload.paths[0];
        if (!path?.toLowerCase().endsWith(".pdf")) {
          return;
        }
        try {
          if (projectStore.isOpen) {
            await importTauriPdfIntoProject(path);
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
      // HTML5 drop still works when native drag-drop is disabled.
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
    if (next === toolStore.current) {
      return;
    }
    toolStore.setTool(next);
    applyTool();
  }

  function onPointerDown(event: PointerEvent) {
    if (!shouldCaptureViewportPointer(toolStore.current)) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
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
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ondragenter={allowPdfDrop}
  ondragover={allowPdfDrop}
  ondrop={onPdfFileDrop}
  role="application"
>
  {#if !pdfStore.document}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400"
    >
      <p class="text-lg">図面または工程表のPDFを開くか、ここにドロップしてください</p>
      <p class="text-sm">Windows で接続待機し、Android から QR で同期できます</p>
    </div>
  {/if}

  <div class="relative mx-auto w-fit">
    <canvas bind:this={pdfCanvasEl} class="block bg-white shadow-2xl"></canvas>
    <div class="absolute top-0 left-0 z-[1] touch-none">
      <canvas bind:this={fabricCanvasEl}></canvas>
    </div>
  </div>
</div>
