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
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { broadcastAnnotation } from "$lib/utils/connectionActions";
  import { readFileAsBytes } from "$lib/utils/fileAccess";
  import { resizeImageFile } from "$lib/utils/imageResize";
  import { renderPdfPage } from "$lib/utils/pdfRenderer";
  import { isTauriRuntime } from "$lib/utils/platform";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { sendCurrentPdf } from "$lib/utils/connectionActions";

  let viewportEl: HTMLDivElement | undefined = $state();
  let pdfCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvas: Canvas | undefined;
  let applyingRemote = false;
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
    applyTool();
    bindFabricEvents();
    void setupDragDrop();

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
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
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
      const event = opt.e as PointerEvent;
      const pointer = fabricCanvas!.getPointer(event);
      lastTap = { x: pointer.x, y: pointer.y };

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
      if (applyingRemote || !opt.target) {
        return;
      }
      const id = getId(opt.target);
      if (id) {
        annotationStore.remove(pdfStore.pageIndex, id);
        broadcastAnnotation("remove", pdfStore.pageIndex, id);
      }
    });
  }

  async function renderCurrentPage() {
    if (!pdfStore.document || !pdfCanvasEl || !fabricCanvas) {
      return;
    }
    const token = ++renderToken;
    persistCurrentPage();
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
    if (applyingRemote) {
      return;
    }
    const id = assignId(object);
    const serialized = object.toObject(CUSTOM_PROPS) as Record<string, unknown>;
    annotationStore.upsert(pdfStore.pageIndex, id, serialized);
    broadcastAnnotation(op, pdfStore.pageIndex, id, serialized);
  }

  function removeObject(object: FabricObject) {
    fabricCanvas?.remove(object);
  }

  function isEditingText(object: FabricObject): boolean {
    return "isEditing" in object && Boolean((object as IText).isEditing);
  }

  async function setupDragDrop() {
    if (!viewportEl) {
      return;
    }
    viewportEl.addEventListener("dragover", (event) => event.preventDefault());
    viewportEl.addEventListener("drop", async (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file?.type === "application/pdf") {
        annotationStore.clear();
        await pdfStore.load(file.name, await readFileAsBytes(file));
        sendCurrentPdf();
      }
    });

    if (!isTauriRuntime()) {
      return;
    }
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const unlisten = await getCurrentWebviewWindow().onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop") {
        return;
      }
      const path = event.payload.paths[0];
      if (!path?.toLowerCase().endsWith(".pdf")) {
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
    });
    unlistenDrag = unlisten;
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

  function onPointerDown(event: PointerEvent) {
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
>
  {#if !pdfStore.document}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400"
    >
      <p class="text-lg">建築図面PDFを開くか、ここにドロップしてください</p>
      <p class="text-sm">Windows で接続待機し、Android から QR で同期できます</p>
    </div>
  {/if}

  <div class="relative mx-auto w-fit">
    <canvas bind:this={pdfCanvasEl} class="block bg-white shadow-2xl"></canvas>
    <canvas
      bind:this={fabricCanvasEl}
      class="absolute top-0 left-0 touch-none"
    ></canvas>
  </div>
</div>
