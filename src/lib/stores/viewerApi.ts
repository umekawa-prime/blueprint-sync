const noop = () => undefined;

class ViewerApi {
  exportOverlays: () => Promise<
    Array<{
      pageIndex: number;
      pngBytes: Uint8Array;
      canvasWidth: number;
      canvasHeight: number;
    }>
  > = async () => [];

  addPhoto: (file: Blob, offsetIndex?: number) => Promise<void> = async () => undefined;
  acceptCapturedPhoto: (file: Blob) => Promise<void> = async () => undefined;
  openCamera: () => void = noop;
  undo: () => void = noop;
  redo: () => void = noop;
  persistPage: () => void = noop;
  discardOverlays: () => void = noop;

  reset() {
    this.exportOverlays = async () => [];
    this.addPhoto = async () => undefined;
    this.acceptCapturedPhoto = async () => undefined;
    this.openCamera = noop;
    this.undo = noop;
    this.redo = noop;
    this.persistPage = noop;
    this.discardOverlays = noop;
  }
}

export const viewerApi = new ViewerApi();
