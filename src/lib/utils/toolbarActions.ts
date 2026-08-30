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
  await persistCurrentAnnotations();
  pdfStore.status = saved ? "PDFを保存しました" : "保存をキャンセルしました";
  if (saved) {
    annotationStore.dirty = false;
  }
}
