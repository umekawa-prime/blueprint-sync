import { pdfStore } from "$lib/stores/pdfStore.svelte";

export async function selectPdfPage(index: number): Promise<void> {
  if (!pdfStore.document) {
    return;
  }
  await pdfStore.setPage(index);
}
