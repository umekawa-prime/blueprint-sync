import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CAMERA_CONSTRAINTS,
  blobFromCanvas,
  drawVideoFrame,
  mapCameraError,
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

describe("startCameraStream", () => {
  it("requests a video-only stream with environment facing preferred", async () => {
    const stream = { id: "cam" } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(startCameraStream(getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(DEFAULT_CAMERA_CONSTRAINTS);
  });

  it("wraps permission denial in a Japanese error", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    await expect(startCameraStream(getUserMedia)).rejects.toThrow(
      "カメラの使用が許可されていません",
    );
  });
});
