import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { autoSaveStore } from "$lib/stores/autoSaveStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { createAutoSaver } from "$lib/utils/autoSave";
import { isBrowserFsPath } from "$lib/utils/browserFs";
import { supportsBrowserFolders } from "$lib/utils/platform";
import { persistCurrentAnnotations } from "$lib/utils/projectActions";

/** Web-only: debounced autosave of annotations into the open browser folder. */
export function startWebAutoSave(): () => void {
  if (!supportsBrowserFolders()) {
    return () => {};
  }

  const saver = createAutoSaver({
    save: persistCurrentAnnotations,
    onState: (s) => {
      autoSaveStore.state = s;
    },
  });

  const stopEffect = $effect.root(() => {
    $effect(() => {
      void annotationStore.editSeq;
      if (annotationStore.dirty && isBrowserFsPath(projectStore.folder)) {
        saver.schedule();
      }
    });
  });

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (annotationStore.dirty || saver.pending) {
      event.preventDefault();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      void saver.flush();
    }
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("visibilitychange", onVisibility);
    stopEffect();
    saver.dispose();
  };
}
