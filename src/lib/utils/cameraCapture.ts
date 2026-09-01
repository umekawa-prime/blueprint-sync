export const DEFAULT_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

export function mapCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "カメラの使用が許可されていません";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "カメラが見つかりません";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "カメラを起動できませんでした。他のアプリが使用中の可能性があります";
  }
  return "カメラを起動できませんでした";
}

export function drawVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error("カメラ映像の準備ができていません");
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("撮影に失敗しました");
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
}

export function blobFromCanvas(
  canvas: HTMLCanvasElement,
  mimeType = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("撮影に失敗しました"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function capturePhotoFromVideo(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawVideoFrame(video, canvas);
  return blobFromCanvas(canvas);
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

export function defaultGetUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("この環境ではカメラを使えません"));
  }
  return mediaDevices.getUserMedia(constraints);
}

export async function startCameraStream(
  getUserMedia: GetUserMedia = defaultGetUserMedia,
): Promise<MediaStream> {
  try {
    return await getUserMedia(DEFAULT_CAMERA_CONSTRAINTS);
  } catch (error) {
    throw new Error(mapCameraError(error));
  }
}
