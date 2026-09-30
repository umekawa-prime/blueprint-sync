import type { PhotoCapturePhase } from "$lib/utils/photoCaptureFlow";
import {
  photoCaptureAfterCancel,
  photoCaptureAfterDone,
  photoCaptureAfterPlace,
  photoCaptureAfterShot,
} from "$lib/utils/photoCaptureFlow";

class PhotoCaptureStore {
  phase = $state<PhotoCapturePhase>("idle");
  image = $state<Blob | null>(null);

  beginMarkup(file: Blob) {
    this.image = file;
    this.phase = photoCaptureAfterShot("idle");
  }

  beginPlacement(file: Blob) {
    this.image = file;
    this.phase = photoCaptureAfterDone("markup");
  }

  finishPlacement() {
    this.image = null;
    this.phase = photoCaptureAfterPlace("place");
  }

  clear() {
    this.image = null;
    this.phase = photoCaptureAfterCancel();
  }
}

export const photoCaptureStore = new PhotoCaptureStore();
