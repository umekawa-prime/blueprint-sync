import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";
import { embedAnnotationPngOnPdf, exportedPdfPath } from "./pdfExport";
import { appendPhotoPinSlides } from "./pinSlides";
import { persistCurrentAnnotations, importPdfIntoProject } from "./projectActions";
import { writeBinaryFile } from "./projectIo";
import { isProjectCadRelPath } from "./projectFormat";

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
    pdfStore.status = "出力先のPDFがありません";
    return false;
  }

  try {
    if (isProjectCadRelPath(projectStore.currentPdf)) {
      const persisted = await persistCurrentAnnotations();
      if (persisted) {
        pdfStore.status = "";
        annotationStore.dirty = false;
        return true;
      }
      return false;
    }
    const overlays = await viewerApi.exportOverlays();
    const annotated = await embedAnnotationPngOnPdf(pdfStore.bytes, overlays);
    const output = await appendPhotoPinSlides(
      annotated,
      annotationStore.exportPhotoPins(),
      pdfStore.pageCount,
    );
    const path = exportedPdfPath(projectStore.folder, projectStore.currentPdf);
    await writeBinaryFile(path, output);
    const persisted = await persistCurrentAnnotations();
    if (persisted) {
      pdfStore.status = "";
      annotationStore.dirty = false;
      return true;
    }
    return false;
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "PDFの出力に失敗しました";
    return false;
  }
}
