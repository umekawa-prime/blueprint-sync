import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";
import { embedAnnotationPngOnPdf } from "./pdfExport";
import { persistCurrentAnnotations, importPdfIntoProject } from "./projectActions";
import { writeBinaryFile } from "./projectIo";

export async function openPdfIntoCurrentProject(): Promise<void> {
  try {
    await importPdfIntoProject();
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "PDF を開けませんでした";
  }
}

export async function saveCurrentPdf(): Promise<boolean> {
  if (!pdfStore.bytes) {
    pdfStore.status = "先にPDFを開いてください";
    return false;
  }
  if (!projectStore.folder || !projectStore.currentPdf) {
    pdfStore.status = "上書き先のPDFがありません";
    return false;
  }

  try {
    const overlays = await viewerApi.exportOverlays();
    const output = await embedAnnotationPngOnPdf(pdfStore.bytes, overlays);
    const path = `${projectStore.folder}/${projectStore.currentPdf.replaceAll("\\", "/")}`;
    await writeBinaryFile(path, output);
    const persisted = await persistCurrentAnnotations();
    if (persisted) {
      pdfStore.status = "";
      annotationStore.dirty = false;
      return true;
    }
    return false;
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "PDFの保存に失敗しました";
    return false;
  }
}
