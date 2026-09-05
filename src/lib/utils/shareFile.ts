export type ShareFileBytesDeps = {
  name: string;
  bytes: Uint8Array;
  mime: string;
  share?: (data: { files: File[]; title: string }) => Promise<void>;
  canShare?: (data: { files: File[] }) => boolean;
  download?: (name: string, bytes: Uint8Array, mime: string) => void;
};

function fileFromBytes(name: string, bytes: Uint8Array, mime: string): File {
  return new File([bytes], name, { type: mime });
}

export function downloadBytes(name: string, bytes: Uint8Array, mime: string): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function webShareFns(): Pick<ShareFileBytesDeps, "share" | "canShare"> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  return {
    share: nav.share?.bind(nav),
    canShare: nav.canShare?.bind(nav),
  };
}

export async function shareFileBytes(deps: ShareFileBytesDeps): Promise<void> {
  const file = fileFromBytes(deps.name, deps.bytes, deps.mime);
  const payload = { files: [file], title: deps.name };
  const canShare = deps.canShare ?? webShareFns().canShare;
  const share = deps.share ?? webShareFns().share;
  const download = deps.download ?? downloadBytes;
  const allowed = typeof share === "function" && (typeof canShare !== "function" || canShare({ files: [file] }));
  if (allowed && share) {
    await share(payload);
    return;
  }
  download(deps.name, deps.bytes, deps.mime);
}
