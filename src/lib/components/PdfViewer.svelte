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
  import { bytesForStandaloneViewer, isCadDrawingBasename } from "$lib/utils/cadImport";
  import { importBrowserPdfIntoProject, importTauriPdfIntoProject } from "$lib/utils/projectDrop";
  import { firstDroppedPdfOrZip, filePathsFromUriList, firstDroppedImportPath } from "$lib/utils/pdfDrop";
  import { isZipBasename } from "$lib/utils/zipPdf";
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
  import {
    applyWheel,
    cameraCssTransform,
    centerInViewport,
    clampCamera,
    panBy,
    pinchCamera,
    shouldHandleWheelAsViewport,
    shouldPanWithPointer,
    zoomAroundPoint,
    type MapCamera,
  } from "$lib/utils/mapViewport";
  import {
    fabricToNormalized,
    PDF_DISPLAY_SCALE,
    pdfPageNumber,
    pdfPageOutputScale,
  } from "$lib/utils/pdfCoords";
  import { renderPdfPage } from "$lib/utils/pdfRenderer";
  import { isTauriRuntime } from "$lib/utils/platform";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { sendCurrentPdf } from "$lib/utils/connectionActions";
  import type { EditCommand } from "$lib/utils/editHistory";
  import { staggeredPinPosition } from "$lib/utils/photoPinUi";
  import { renderPinMarkerOverlay } from "$lib/utils/pinMarkers";
  import { renderMemoPinOverlay } from "$lib/utils/memoPinLayout";
  import { DEFAULT_MEMO_COLOR, type PhotoPinImage } from "$lib/utils/annotationPersist";
  import PhotoPinLayer from "$lib/components/PhotoPinLayer.svelte";
  import MemoPinLayer from "$lib/components/MemoPinLayer.svelte";

  let viewportEl: HTMLDivElement | undefined = $state();
  let pdfCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvasEl: HTMLCanvasElement | undefined = $state();
  let fabricCanvas: Canvas | undefined;
  let camera = $state<MapCamera>({ x: 0, y: 0, zoom: 1 });
  let renderedZoom = $state(1);
  let bitmapZoom = 0;
  let contentSize = $state({ width: 0, height: 0 });
  let panDrag = $state<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  let shouldCenter = true;
  let zoomRenderTimer: ReturnType<typeof setTimeout> | undefined;
  const activePointers = new Map<number, { x: number; y: number }>();
  let pinchStart:
    | { zoom: number; x: number; y: number; cx: number; cy: number; dist: number }
    | undefined;
  let applyingRemote = false;
  let applyingHistory = false;
  let overlaysStale = false;
  let pendingModify:
    | { id: string; object: Record<string, unknown> }
    | undefined;
  let unlistenDrag: (() => void) | undefined;
  let lastTap = { x: 120, y: 120 };
  let pendingPinId: string | null = null;
  let editingMemoId = $state<string | null>(null);
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
      const canvasWidth = fabricCanvas.getWidth();
      const canvasHeight = fabricCanvas.getHeight();
      overlays.push({
        pageIndex,
        pngBytes: dataUrlToBytes(dataUrl),
        canvasWidth,
        canvasHeight,
      });
      const pinPng = await renderPinMarkerOverlay(
        annotationStore.pinsFor(pageIndex),
        canvasWidth * 2,
        canvasHeight * 2,
      );
      if (pinPng) {
        overlays.push({
          pageIndex,
          pngBytes: pinPng,
          canvasWidth,
          canvasHeight,
        });
      }
      const memoPng = await renderMemoPinOverlay(
        annotationStore.memosFor(pageIndex),
        canvasWidth * 2,
        canvasHeight * 2,
      );
      if (memoPng) {
        overlays.push({
          pageIndex,
          pngBytes: memoPng,
          canvasWidth,
          canvasHeight,
        });
      }
    }

    await pdfStore.setPage(previous);
    await renderCurrentPage();
    return overlays;
  }

  async function photoPinImageFromFile(file: Blob): Promise<PhotoPinImage> {
    const assets = await createPhotoPinAssets(file);
    return {
      id: crypto.randomUUID(),
      thumbnailDataUrl: assets.thumbnailDataUrl,
      imageDataUrl: assets.imageDataUrl,
    };
  }

  async function addPhotoFromFile(file: Blob, offsetIndex = 0) {
    // Set only while the camera was opened from a pin, so the shot joins that
    // pin instead of dropping a new one.
    const targetPinId = pendingPinId;
    pendingPinId = null;
    if (targetPinId) {
      annotationStore.addPhotoPinImages(pdfStore.pageIndex, targetPinId, [
        await photoPinImageFromFile(file),
      ]);
      return;
    }
    if (!fabricCanvas) {
      return;
    }
    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();
    if (width <= 0 || height <= 0) {
      return;
    }
    const image = await photoPinImageFromFile(file);
    const { nx, ny } = staggeredPinPosition(
      fabricToNormalized(lastTap.x, lastTap.y, width, height),
      offsetIndex,
    );
    annotationStore.addPhotoPin(pdfStore.pageIndex, {
      id: crypto.randomUUID(),
      nx,
      ny,
      images: [image],
    });
  }

  async function addImagesToPin(pinId: string) {
    const picked = await pickImagesFromDisk();
    if (picked.length === 0) {
      return;
    }
    const images: PhotoPinImage[] = [];
    for (const item of picked) {
      images.push(await photoPinImageFromFile(imageBlobFromPicked(item)));
    }
    annotationStore.addPhotoPinImages(pdfStore.pageIndex, pinId, images);
  }

  function captureImageForPin(pinId: string) {
    pendingPinId = pinId;
    viewerApi.openCamera();
  }

  async function requestInsertImage() {
    closeViewerMenu();
    pendingPinId = null;
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
    pendingPinId = null;
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
    window.addEventListener("pointerup", onPointerUpCapture);
    window.addEventListener("pointercancel", onPointerUpCapture);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    viewportEl?.addEventListener("pointerdown", onPointerDownCapture, true);
    viewportEl?.addEventListener("pointermove", onPointerMoveCapture, true);
    viewportEl?.addEventListener("pointerup", onPointerUpCapture, true);
    viewportEl?.addEventListener("pointercancel", onPointerUpCapture, true);
    viewportEl?.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("pointerup", onPointerUpCapture);
      window.removeEventListener("pointercancel", onPointerUpCapture);
      window.removeEventListener("wheel", onWheel, true);
      viewportEl?.removeEventListener("pointerdown", onPointerDownCapture, true);
      viewportEl?.removeEventListener("pointermove", onPointerMoveCapture, true);
      viewportEl?.removeEventListener("pointerup", onPointerUpCapture, true);
      viewportEl?.removeEventListener("pointercancel", onPointerUpCapture, true);
      viewportEl?.removeEventListener("touchmove", onTouchMove);
    };
  });

  onDestroy(() => {
    clearLongPress();
    if (zoomRenderTimer) {
      clearTimeout(zoomRenderTimer);
    }
    persistCurrentPage();
    fabricCanvas?.dispose();
    fabricCanvas = undefined;
    viewerApi.reset();
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
    pdfStore.pageIndex;
    editingMemoId = null;
  });

  $effect(() => {
    const color = toolStore.textColor;
    const id = editingMemoId;
    if (!id) {
      return;
    }
    const current = annotationStore.memosFor(pdfStore.pageIndex).find((pin) => pin.id === id);
    if (!current || current.color === color) {
      return;
    }
    annotationStore.updateMemoPin(pdfStore.pageIndex, id, { color });
  });

  $effect(() => {
    pdfStore.document;
    pdfStore.pageIndex;
    shouldCenter = true;
    void renderCurrentPage();
  });

  $effect(() => {
    const zoom = pdfStore.zoom;
    untrack(() => {
      if (Math.abs(camera.zoom - zoom) > 0.0005) {
        const origin = viewportCenter();
        camera = clampToView(zoomAroundPoint(camera, origin.x, origin.y, zoom));
      }
      if (!pdfStore.document || bitmapZoom === zoom) {
        return;
      }
      if (zoomRenderTimer) {
        clearTimeout(zoomRenderTimer);
      }
      zoomRenderTimer = setTimeout(() => {
        if (bitmapZoom === pdfStore.zoom) {
          return;
        }
        void renderCurrentPage();
      }, 180);
    });
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
        const width = fabricCanvas!.getWidth();
        const height = fabricCanvas!.getHeight();
        if (width <= 0 || height <= 0) {
          return;
        }
        const { nx, ny } = fabricToNormalized(pointer.x, pointer.y, width, height);
        const id = crypto.randomUUID();
        annotationStore.addMemoPin(pdfStore.pageIndex, {
          id,
          nx: Math.min(1, Math.max(0, nx)),
          ny: Math.min(1, Math.max(0, ny)),
          text: "",
          color: toolStore.textColor || DEFAULT_MEMO_COLOR,
        });
        editingMemoId = id;
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
    const pageChanged = persistedPage !== pdfStore.pageIndex || shouldCenter;
    if (pageChanged) {
      untrack(() => persistCurrentPage());
    }
    try {
      const page = await pdfStore.document.getPage(pageNumber);
      if (token !== renderToken) {
        return;
      }
      const size = await renderPdfPage(
        page,
        pdfCanvasEl,
        PDF_DISPLAY_SCALE,
        pdfPageOutputScale(pdfStore.zoom, window.devicePixelRatio || 1),
      );
      if (token !== renderToken) {
        return;
      }
      if (fabricCanvas) {
        const width = Math.floor(size.width);
        const height = Math.floor(size.height);
        const resized =
          fabricCanvas.getWidth() !== width || fabricCanvas.getHeight() !== height;
        if (resized) {
          fabricCanvas.setDimensions({ width, height });
        }
        if (pageChanged || resized) {
          persistedPage = pdfStore.pageIndex;
          await restorePageObjects();
        }
      }
      contentSize = { width: size.width, height: size.height };
      bitmapZoom = pdfStore.zoom;
      if (shouldCenter) {
        camera = centerInViewport(
          size.width,
          size.height,
          viewportEl?.clientWidth ?? size.width,
          viewportEl?.clientHeight ?? size.height,
          pdfStore.zoom,
          renderedZoom,
        );
        shouldCenter = false;
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
    return firstDroppedPdfOrZip(event.dataTransfer?.files);
  }

  function droppedPathFromEvent(event: DragEvent): string | null {
    const uriList =
      event.dataTransfer?.getData("text/uri-list") || event.dataTransfer?.getData("text/plain") || "";
    const path = firstDroppedImportPath(filePathsFromUriList(uriList));
    if (!path) {
      return null;
    }
    const name = path.split(/[/\\]/).pop() ?? "";
    if (
      !projectStore.isOpen &&
      !path.toLowerCase().endsWith(".pdf") &&
      !isCadDrawingBasename(name)
    ) {
      return null;
    }
    return path;
  }

  async function loadStandaloneBytes(name: string, bytes: Uint8Array) {
    annotationStore.clear();
    const loaded = await bytesForStandaloneViewer(name, bytes);
    await pdfStore.load(loaded.name, loaded.bytes);
    sendCurrentPdf();
  }

  async function onPdfFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const file = droppedFileFromEvent(event);
    const path = file ? null : droppedPathFromEvent(event);
    if (!file && !path) {
      pdfStore.status = "PDF / ZIP / JWW / JWC / DXF をドロップしてください";
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
      const droppedName = file?.name ?? path?.split(/[/\\]/).pop() ?? "";
      if (isZipBasename(droppedName)) {
        pdfStore.status = "ZIP はプロジェクトを開いてから取り込んでください";
        return;
      }
      if (path) {
        const { invoke } = await import("@tauri-apps/api/core");
        const bytes = await invoke<number[]>("read_file_bytes", { path });
        await loadStandaloneBytes(path.split(/[/\\]/).pop() ?? "document.pdf", Uint8Array.from(bytes));
        return;
      }
      await loadStandaloneBytes(file!.name, await readFileAsBytes(file!));
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
          pdfStore.status = "PDF / ZIP / JWW / JWC / DXF をドロップしてください";
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
          await loadStandaloneBytes(
            path.split(/[/\\]/).pop() ?? "document.pdf",
            Uint8Array.from(bytes),
          );
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

  function viewportCenter() {
    return {
      x: (viewportEl?.clientWidth ?? 0) / 2,
      y: (viewportEl?.clientHeight ?? 0) / 2,
    };
  }

  function viewportPoint(event: { clientX: number; clientY: number }) {
    const rect = viewportEl?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  function clampToView(next: MapCamera): MapCamera {
    if (!viewportEl || contentSize.width <= 0) {
      return next;
    }
    return clampCamera(
      next,
      contentSize.width,
      contentSize.height,
      viewportEl.clientWidth,
      viewportEl.clientHeight,
      renderedZoom,
    );
  }

  function isOverViewport(event: { clientX: number; clientY: number }): boolean {
    if (!viewportEl) {
      return false;
    }
    const rect = viewportEl.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function onWheel(event: WheelEvent) {
    const pinch = event.ctrlKey || event.metaKey;
    if (!shouldHandleWheelAsViewport(event, isOverViewport(event))) {
      return;
    }
    if (!pdfStore.document) {
      if (pinch) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
    const origin = viewportPoint(event);
    const next = clampToView(applyWheel(camera, event, origin));
    camera = next;
    if (next.zoom !== pdfStore.zoom) {
      pdfStore.setZoom(next.zoom);
    }
  }

  function pinchFromActivePointers() {
    if (activePointers.size < 2 || !viewportEl) {
      return undefined;
    }
    const [a, b] = [...activePointers.values()];
    const rect = viewportEl.getBoundingClientRect();
    return {
      cx: (a.x + b.x) / 2 - rect.left,
      cy: (a.y + b.y) / 2 - rect.top,
      dist: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }

  function beginPinchFromPointers() {
    const pinch = pinchFromActivePointers();
    if (!pinch || pinch.dist <= 0) {
      return;
    }
    panDrag = undefined;
    clearLongPress();
    pinchStart = {
      zoom: camera.zoom,
      x: camera.x,
      y: camera.y,
      ...pinch,
    };
  }

  function movePinchFromPointers() {
    const pinch = pinchFromActivePointers();
    if (!pinch || !pinchStart || pinchStart.dist <= 0) {
      return;
    }
    camera = clampToView(
      pinchCamera(pinchStart, {
        cx: pinch.cx,
        cy: pinch.cy,
        scale: pinch.dist / pinchStart.dist,
      }),
    );
    pdfStore.setZoom(camera.zoom);
  }

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
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size >= 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      beginPinchFromPointers();
      return;
    }
    if (
      !pdfStore.document ||
      !shouldPanWithPointer(toolStore.current, event.button, event.pointerType)
    ) {
      return;
    }
    if (menuEl?.contains(event.target as Node)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (fabricCanvas && event.pointerType === "touch") {
      fabricCanvas.skipTargetFind = true;
      fabricCanvas.selection = false;
    }
    if (shouldStartLongPress(event)) {
      longPressAt = { x: event.clientX, y: event.clientY };
      clearLongPress();
      longPressTimer = setTimeout(() => {
        openViewerMenu(longPressAt.x, longPressAt.y);
      }, LONG_PRESS_MS);
    }
    panDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    viewportEl?.setPointerCapture?.(event.pointerId);
  }

  function onPointerMoveCapture(event: PointerEvent) {
    if (!activePointers.has(event.pointerId)) {
      return;
    }
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size >= 2 && pinchStart) {
      event.preventDefault();
      event.stopImmediatePropagation();
      movePinchFromPointers();
    }
  }

  function onPointerUpCapture(event: PointerEvent) {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) {
      pinchStart = undefined;
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
    if (!pdfStore.document) {
      return;
    }
    if (pinchStart || activePointers.size >= 2) {
      return;
    }
    if (shouldPanWithPointer(toolStore.current, event.button, event.pointerType)) {
      event.preventDefault();
      panDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      return;
    }
    if (!shouldCaptureViewportPointer(toolStore.current, event.button)) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (pinchStart || activePointers.size >= 2) {
      return;
    }
    if (panDrag && event.pointerId === panDrag.pointerId) {
      if (
        longPressTimer &&
        Math.hypot(event.clientX - longPressAt.x, event.clientY - longPressAt.y) > 8
      ) {
        clearLongPress();
      }
      camera = clampToView(panBy(camera, event.clientX - panDrag.x, event.clientY - panDrag.y));
      panDrag = { pointerId: panDrag.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    if (!longPressTimer) {
      return;
    }
    if (Math.hypot(event.clientX - longPressAt.x, event.clientY - longPressAt.y) > 8) {
      clearLongPress();
    }
  }

  function onPointerUp(event: PointerEvent) {
    clearLongPress();
    if (panDrag?.pointerId === event.pointerId) {
      panDrag = undefined;
      applyTool();
    }
  }

  function onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (!pdfStore.document) {
      return;
    }
    openViewerMenu(event.clientX, event.clientY);
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2 && viewportEl) {
      const a = event.touches[0];
      const b = event.touches[1];
      const rect = viewportEl.getBoundingClientRect();
      pinchStart = {
        zoom: camera.zoom,
        x: camera.x,
        y: camera.y,
        cx: (a.clientX + b.clientX) / 2 - rect.left,
        cy: (a.clientY + b.clientY) / 2 - rect.top,
        dist: distance(a, b),
      };
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && pinchStart && pinchStart.dist > 0 && viewportEl) {
      event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      const rect = viewportEl.getBoundingClientRect();
      camera = clampToView(
        pinchCamera(pinchStart, {
          cx: (a.clientX + b.clientX) / 2 - rect.left,
          cy: (a.clientY + b.clientY) / 2 - rect.top,
          scale: distance(a, b) / pinchStart.dist,
        }),
      );
      pdfStore.setZoom(camera.zoom);
    }
  }

  function onTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      pinchStart = undefined;
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
  class="relative min-h-0 flex-1 touch-none overflow-hidden overscroll-none bg-slate-950"
  class:cursor-grab={toolStore.current === "pan" && !panDrag}
  class:cursor-grabbing={Boolean(panDrag)}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onauxclick={(event) => event.preventDefault()}
  oncontextmenu={onContextMenu}
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchEnd}
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

  <div
    class="relative w-fit origin-top-left will-change-transform"
    class:pointer-events-none={!pdfStore.document && !pdfStore.bytes}
    style="transform: {cameraCssTransform(camera, renderedZoom)}"
  >
    <canvas bind:this={pdfCanvasEl} class="block bg-white shadow-2xl"></canvas>
    <div class="absolute top-0 left-0 z-[1] touch-none">
      <canvas bind:this={fabricCanvasEl}></canvas>
    </div>
    <PhotoPinLayer
      pins={annotationStore.pinsFor(pdfStore.pageIndex)}
      onTitleChange={(id, title) => annotationStore.updatePhotoPin(pdfStore.pageIndex, id, { title })}
      onMove={(id, nx, ny) => annotationStore.updatePhotoPin(pdfStore.pageIndex, id, { nx, ny })}
      onAddImages={(id) => void addImagesToPin(id)}
      onCaptureImage={captureImageForPin}
      onRemoveImage={(id, imageId) =>
        annotationStore.removePhotoPinImage(pdfStore.pageIndex, id, imageId)}
      onRemovePin={(id) => annotationStore.removePhotoPin(pdfStore.pageIndex, id)}
    />
    <MemoPinLayer
      pins={annotationStore.memosFor(pdfStore.pageIndex)}
      editingId={editingMemoId}
      onEdit={(id) => {
        editingMemoId = id;
      }}
      onTextChange={(id, text) => annotationStore.updateMemoPin(pdfStore.pageIndex, id, { text })}
      onMove={(id, nx, ny) => annotationStore.updateMemoPin(pdfStore.pageIndex, id, { nx, ny })}
      onRemove={(id) => {
        annotationStore.removeMemoPin(pdfStore.pageIndex, id);
        if (editingMemoId === id) {
          editingMemoId = null;
        }
      }}
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
