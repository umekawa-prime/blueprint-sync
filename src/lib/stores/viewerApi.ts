class ViewerApi {
  exportOverlays: () => Promise<
    Array<{
      pageIndex: number;
      pngBytes: Uint8Array;
      canvasWidth: number;
      canvasHeight: number;
    }>
  > = async () => [];

  addPhoto: (file: Blob) => Promise<void> = async () => undefined;
  undo: () => void = () => undefined;
  redo: () => void = () => undefined;
}

export const viewerApi = new ViewerApi();
