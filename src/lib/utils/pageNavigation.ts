import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { broadcastPage } from "./connectionActions";

export async function selectPdfPage(index: number): Promise<void> {
  if (!pdfStore.document) {
    return;
  }
  await pdfStore.setPage(index);
  broadcastPage(pdfStore.pageIndex);
}
