import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CAMERA_CONSTRAINTS,
  ENVIRONMENT_CAMERA_CONSTRAINTS,
  blobFromCanvas,
  cameraConstraints,
  drawVideoFrame,
  isBackCameraLabel,
  isEnvironmentStream,
  isExternalCameraLabel,
  isFrontCameraLabel,
  listVideoCameras,
  mapCameraError,
  pickPreferredCamera,
  selectableCameras,
  startCameraStream,
  stopMediaStream,
} from "./cameraCapture";

describe("mapCameraError", () => {
  it("maps NotAllowedError to a permission message", () => {
    expect(mapCameraError(new DOMException("denied", "NotAllowedError"))).toBe(
      "カメラの使用が許可されていません",
    );
  });

  it("maps NotFoundError when no camera is available", () => {
    expect(mapCameraError(new DOMException("missing", "NotFoundError"))).toBe(
      "カメラが見つかりません",
    );
  });

  it("maps NotReadableError when the camera is busy", () => {
    expect(mapCameraError(new DOMException("busy", "NotReadableError"))).toBe(
      "カメラを起動できませんでした。他のアプリが使用中の可能性があります",
    );
  });

  it("falls back to a generic message", () => {
    expect(mapCameraError(new Error("boom"))).toBe("カメラを起動できませんでした");
  });
});

describe("drawVideoFrame", () => {
  it("throws when the video has no frame yet", () => {
    const canvas = document.createElement("canvas");
    expect(() =>
      drawVideoFrame({ videoWidth: 0, videoHeight: 480 } as HTMLVideoElement, canvas),
    ).toThrow("カメラ映像の準備ができていません");
  });

  it("copies the video frame onto a canvas of the same size", () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;
    const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;

    drawVideoFrame(video, canvas);

    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
  });
});

describe("blobFromCanvas", () => {
  it("resolves with the blob produced by the canvas", async () => {
    const blob = new Blob(["frame"], { type: "image/jpeg" });
    const canvas = {
      toBlob(callback: BlobCallback) {
        callback(blob);
      },
    } as HTMLCanvasElement;

    await expect(blobFromCanvas(canvas)).resolves.toBe(blob);
  });

  it("rejects when the canvas cannot encode a frame", async () => {
    const canvas = {
      toBlob(callback: BlobCallback) {
        callback(null);
      },
    } as HTMLCanvasElement;

    await expect(blobFromCanvas(canvas)).rejects.toThrow("撮影に失敗しました");
  });
});

describe("stopMediaStream", () => {
  it("stops every track on the stream", () => {
    const stop = vi.fn();
    stopMediaStream({
      getTracks: () => [{ stop }, { stop }],
    } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
  });
});

describe("cameraConstraints", () => {
  it("does not require a phone facingMode so USB cameras can be used", () => {
    expect(cameraConstraints()).toEqual({
      audio: false,
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  });

  it("pins an exact device id for an external camera", () => {
    expect(cameraConstraints("usb-cam")).toEqual({
      audio: false,
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        deviceId: { exact: "usb-cam" },
      },
    });
  });
});

describe("pickPreferredCamera", () => {
  it("prefers an external USB camera over a built-in one", () => {
    expect(
      pickPreferredCamera([
        { deviceId: "front", label: "Integrated Camera" },
        { deviceId: "usb", label: "USB Camera" },
      ]),
    ).toBe("usb");
  });

  it("keeps an already chosen camera", () => {
    expect(
      pickPreferredCamera(
        [
          { deviceId: "front", label: "Integrated Camera" },
          { deviceId: "usb", label: "USB Camera" },
        ],
        "front",
      ),
    ).toBe("front");
  });
});

describe("back camera preference", () => {
  const tablet = [
    { deviceId: "front", label: "Front Camera" },
    { deviceId: "rear", label: "Rear Camera" },
  ];

  it("picks the back camera over the front one", () => {
    expect(pickPreferredCamera(tablet)).toBe("rear");
    expect(pickPreferredCamera([...tablet].reverse())).toBe("rear");
  });

  it("does not keep a stored front camera when a back camera exists", () => {
    expect(pickPreferredCamera(selectableCameras(tablet), "front")).toBe("rear");
  });

  it("hides front cameras when another camera exists", () => {
    expect(selectableCameras(tablet)).toEqual([{ deviceId: "rear", label: "Rear Camera" }]);
    expect(
      selectableCameras([
        { deviceId: "front", label: "Integrated Camera" },
        { deviceId: "usb", label: "USB Camera" },
      ]).map((camera) => camera.deviceId),
    ).toEqual(["usb"]);
  });

  it("keeps the only camera even when it faces the user", () => {
    const laptop = [{ deviceId: "front", label: "Integrated Camera" }];
    expect(selectableCameras(laptop)).toEqual(laptop);
    expect(pickPreferredCamera(selectableCameras(laptop))).toBe("front");
  });

  it("recognises back and front labels", () => {
    expect(isBackCameraLabel("camera2 0, facing back")).toBe(true);
    expect(isBackCameraLabel("背面カメラ")).toBe(true);
    expect(isFrontCameraLabel("camera2 1, facing front")).toBe(true);
    expect(isFrontCameraLabel("Rear Camera")).toBe(false);
    expect(isFrontCameraLabel("USB Camera")).toBe(false);
  });

  it("detects an environment-facing stream", () => {
    const stream = (facingMode?: string) =>
      ({ getVideoTracks: () => [{ getSettings: () => ({ facingMode }) }] }) as unknown as MediaStream;
    expect(isEnvironmentStream(stream("environment"))).toBe(true);
    expect(isEnvironmentStream(stream("user"))).toBe(false);
    expect(isEnvironmentStream(null)).toBe(false);
  });
});

describe("isExternalCameraLabel", () => {
  it("treats USB and capture devices as external", () => {
    expect(isExternalCameraLabel("Logitech USB Webcam")).toBe(true);
    expect(isExternalCameraLabel("外付けカメラ")).toBe(true);
    expect(isExternalCameraLabel("Integrated Camera")).toBe(false);
    expect(isExternalCameraLabel("内蔵カメラ")).toBe(false);
  });
});

describe("listVideoCameras", () => {
  it("returns only video inputs", async () => {
    const cameras = await listVideoCameras(async () => [
      { kind: "audioinput", deviceId: "mic", label: "Mic" },
      { kind: "videoinput", deviceId: "cam", label: "USB Camera" },
    ] as MediaDeviceInfo[]);

    expect(cameras).toEqual([{ deviceId: "cam", label: "USB Camera" }]);
  });
});

describe("startCameraStream", () => {
  it("asks for the back camera first by default", async () => {
    const stream = { id: "cam" } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(startCameraStream(getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(ENVIRONMENT_CAMERA_CONSTRAINTS);
  });

  it("falls back to any camera when there is no back camera", async () => {
    const stream = { id: "cam" } as unknown as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("none", "OverconstrainedError"))
      .mockResolvedValueOnce(stream);

    await expect(startCameraStream(getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, DEFAULT_CAMERA_CONSTRAINTS);
  });

  it("tries the selected device before falling back to any camera", async () => {
    const stream = { id: "cam" } as unknown as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("missing", "OverconstrainedError"))
      .mockResolvedValueOnce(stream);

    await expect(startCameraStream(getUserMedia, "usb-1")).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, cameraConstraints("usb-1"));
    expect(getUserMedia).toHaveBeenNthCalledWith(2, cameraConstraints());
  });

  it("wraps permission denial in a Japanese error", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    await expect(startCameraStream(getUserMedia)).rejects.toThrow(
      "カメラの使用が許可されていません",
    );
  });

  it("asks for the environment camera first on mobile", async () => {
    const stream = { id: "rear" } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(startCameraStream(getUserMedia, undefined, true)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(ENVIRONMENT_CAMERA_CONSTRAINTS);
  });
});
