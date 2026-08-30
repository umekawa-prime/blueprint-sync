import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";
import { savePdfToDisk } from "./fileAccess";
import { embedAnnotationPngOnPdf, suggestedExportName } from "./pdfExport";
import { importPdfIntoProject, persistCurrentAnnotations } from "./projectActions";

export async function openPdfIntoCurrentProject(): Promise<void> {
  await importPdfIntoProject();
}

export async function exportCurrentPdfToDisk(): Promise<void> {
  if (!pdfStore.bytes) {
    pdfStore.status = "先にPDFを開いてください";
    return;
  }
  const overlays = await viewerApi.exportOverlays();
  const output = await embedAnnotationPngOnPdf(pdfStore.bytes, overlays);
  const saved = await savePdfToDisk(
    output,
    suggestedExportName(pdfStore.name),
    projectStore.folder || undefined,
  );
  const persisted = await persistCurrentAnnotations();
  if (saved && persisted) {
    pdfStore.status = "PDFを保存しました";
    annotationStore.dirty = false;
  } else if (!saved && persisted) {
    pdfStore.status = "保存をキャンセルしました";
  }
}
