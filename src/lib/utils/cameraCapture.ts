export type CameraDevice = {
  deviceId: string;
  label: string;
};

export type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

export type EnumerateDevices = () => Promise<MediaDeviceInfo[]>;

export function cameraConstraints(deviceId?: string): MediaStreamConstraints {
  const video: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
  if (deviceId) {
    video.deviceId = { exact: deviceId };
  }
  return { audio: false, video };
}

export const DEFAULT_CAMERA_CONSTRAINTS: MediaStreamConstraints = cameraConstraints();

export const ENVIRONMENT_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
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

export function isExternalCameraLabel(label: string): boolean {
  const lower = label.toLowerCase();
  if (/usb|uvc|logitech|elgato|capture|hdmi|webcam|c920|c922|brio|avermedia|ipevo|外付/.test(lower)) {
    return true;
  }
  if (/integrated|internal|built-?in|facetime|front camera|ir camera|内蔵|インカメラ/.test(lower)) {
    return false;
  }
  return false;
}

export function pickPreferredCamera(
  devices: CameraDevice[],
  preferredId?: string,
): string | undefined {
  if (preferredId && devices.some((device) => device.deviceId === preferredId)) {
    return preferredId;
  }
  const external = devices.find((device) => isExternalCameraLabel(device.label));
  return external?.deviceId ?? devices[0]?.deviceId;
}

export async function listVideoCameras(
  enumerate: EnumerateDevices,
): Promise<CameraDevice[]> {
  const devices = await enumerate();
  return devices
    .filter((device) => device.kind === "videoinput" && device.deviceId)
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || "カメラ",
    }));
}

export function currentVideoDeviceId(stream: MediaStream | null | undefined): string | undefined {
  return stream?.getVideoTracks()[0]?.getSettings().deviceId;
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

export function defaultGetUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("この環境ではカメラを使えません"));
  }
  return mediaDevices.getUserMedia(constraints);
}

export function defaultEnumerateDevices(): Promise<MediaDeviceInfo[]> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.enumerateDevices) {
    return Promise.resolve([]);
  }
  return mediaDevices.enumerateDevices();
}

export async function startCameraStream(
  getUserMedia: GetUserMedia = defaultGetUserMedia,
  deviceId?: string,
  preferEnvironment = false,
): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [];
  if (deviceId) {
    attempts.push(cameraConstraints(deviceId));
  }
  if (preferEnvironment && !deviceId) {
    attempts.push(ENVIRONMENT_CAMERA_CONSTRAINTS);
  }
  attempts.push(cameraConstraints());
  attempts.push({ audio: false, video: true });
  if (!preferEnvironment || deviceId) {
    attempts.push(ENVIRONMENT_CAMERA_CONSTRAINTS);
  }

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(mapCameraError(lastError));
}
