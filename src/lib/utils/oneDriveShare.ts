import { isProjectPdfBasename } from "./projectFormat";

export type DrivePdfItem = {
  name: string;
  url: string;
};

export function isOneDriveShareUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "1drv.ms" ||
      host === "onedrive.live.com" ||
      host === "sharepoint.com" ||
      host.endsWith(".sharepoint.com")
    );
  } catch {
    return false;
  }
}

export function encodeOneDriveShareToken(shareUrl: string): string {
  const bytes = new TextEncoder().encode(shareUrl);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64url = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  return `u!${base64url}`;
}

function shareApiUrl(shareUrl: string, suffix: string): string {
  return `https://api.onedrive.com/v1.0/shares/${encodeOneDriveShareToken(shareUrl)}/${suffix}`;
}

export function oneDriveRootUrl(shareUrl: string): string {
  return shareApiUrl(shareUrl, "root");
}

export function oneDriveContentUrl(shareUrl: string): string {
  return shareApiUrl(shareUrl, "root/content");
}

export function oneDriveChildrenUrl(shareUrl: string): string {
  return shareApiUrl(shareUrl, "root/children");
}

export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }
  const rfc5987 = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (rfc5987?.[1]) {
    try {
      return decodeURIComponent(rfc5987[1].trim().replaceAll('"', ""));
    } catch {
      return rfc5987[1];
    }
  }
  const quoted = header.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const plain = header.match(/filename\s*=\s*([^;]+)/i);
  return plain?.[1]?.trim() ?? null;
}

export function suggestedPdfFileName(options: {
  contentDisposition?: string | null;
  fallbackTitle?: string;
  itemName?: string;
}): string {
  const candidates = [
    filenameFromContentDisposition(options.contentDisposition),
    options.itemName,
    options.fallbackTitle
      ? options.fallbackTitle.toLowerCase().endsWith(".pdf")
        ? options.fallbackTitle
        : `${options.fallbackTitle}.pdf`
      : null,
    "onedrive.pdf",
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate.includes("..")) {
      continue;
    }
    const name = candidate.split(/[/\\]/).pop()?.trim();
    if (name && isProjectPdfBasename(name)) {
      return name;
    }
  }
  return "onedrive.pdf";
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function downloadUrlFromItem(item: Record<string, unknown>): string | undefined {
  const content = item["@content.downloadUrl"];
  const graph = item["@microsoft.graph.downloadUrl"];
  if (typeof content === "string") {
    return content;
  }
  if (typeof graph === "string") {
    return graph;
  }
  return undefined;
}

export function pdfItemsFromDriveChildren(payload: unknown): DrivePdfItem[] {
  if (typeof payload !== "object" || payload === null || !("value" in payload)) {
    return [];
  }
  const value = (payload as { value: unknown }).value;
  if (!Array.isArray(value)) {
    return [];
  }
  const items: DrivePdfItem[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || "folder" in entry) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const url = downloadUrlFromItem(record);
    if (!url || !isProjectPdfBasename(name)) {
      continue;
    }
    items.push({ name, url });
  }
  return items;
}
