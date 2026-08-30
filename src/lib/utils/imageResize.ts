export type Size = {
  width: number;
  height: number;
};

export const DEFAULT_PHOTO_MAX_EDGE = 1600;
export const DEFAULT_PHOTO_QUALITY = 0.72;

export function fitImageSize(
  width: number,
  height: number,
  maxEdge: number,
): Size {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function resizeImageFile(
  file: Blob,
  maxEdge = DEFAULT_PHOTO_MAX_EDGE,
  quality = DEFAULT_PHOTO_QUALITY,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const source = await blobToImage(file);
  const { width, height } = fitImageSize(
    source.width,
    source.height,
    maxEdge,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }
  ctx.drawImage(source, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    width,
    height,
  };
}

function blobToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    image.src = url;
  });
}
