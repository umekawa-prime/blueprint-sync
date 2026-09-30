export type PhotoCapturePhase = "idle" | "markup" | "place";

export function photoCaptureAfterShot(phase: PhotoCapturePhase): PhotoCapturePhase {
  if (phase === "idle") {
    return "markup";
  }
  return phase;
}

export function photoCaptureAfterDone(phase: PhotoCapturePhase): PhotoCapturePhase {
  if (phase === "markup") {
    return "place";
  }
  return phase;
}

export function photoCaptureAfterPlace(phase: PhotoCapturePhase): PhotoCapturePhase {
  if (phase === "place") {
    return "idle";
  }
  return phase;
}

export function photoCaptureAfterCancel(): PhotoCapturePhase {
  return "idle";
}
