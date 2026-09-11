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
  openCamera: () => void = () => undefined;
  undo: () => void = () => undefined;
  redo: () => void = () => undefined;
  persistPage: () => void = () => undefined;
  discardOverlays: () => void = () => undefined;
}

export const viewerApi = new ViewerApi();
