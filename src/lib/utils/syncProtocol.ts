export const CHUNK_SIZE = 64 * 1024;
export const DEFAULT_SYNC_PORT = 7840;

export type ClientRole = "host" | "client";

export type AnnotationOp = "add" | "modify" | "remove";

export type HelloMessage = {
  type: "hello";
  originId: string;
  role: ClientRole;
};

export type RequestPdfMessage = {
  type: "request-pdf";
  originId: string;
};

export type PdfMetaMessage = {
  type: "pdf-meta";
  originId: string;
  name: string;
  size: number;
  chunks: number;
};

export type PdfChunkMessage = {
  type: "pdf-chunk";
  originId: string;
  name: string;
  index: number;
  total: number;
  data: string;
};

export type AnnotationMessage = {
  type: "annotation";
  originId: string;
  op: AnnotationOp;
  page: number;
  id: string;
  object?: Record<string, unknown>;
};

export type PageMessage = {
  type: "page";
  originId: string;
  page: number;
};

export type SyncMessage =
  | HelloMessage
  | RequestPdfMessage
  | PdfMetaMessage
  | PdfChunkMessage
  | AnnotationMessage
  | PageMessage;

export function serializeSyncMessage(message: SyncMessage): string {
  return JSON.stringify(message);
}

export function parseSyncMessage(raw: string): SyncMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid sync message");
  }

  if (!isSyncMessage(parsed)) {
    throw new Error("Invalid sync message");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSyncMessage(value: unknown): value is SyncMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (typeof value.originId !== "string") {
    return false;
  }

  switch (value.type) {
    case "hello":
      return value.role === "host" || value.role === "client";
    case "request-pdf":
      return true;
    case "pdf-meta":
      return (
        typeof value.name === "string" &&
        typeof value.size === "number" &&
        typeof value.chunks === "number"
      );
    case "pdf-chunk":
      return (
        typeof value.name === "string" &&
        typeof value.index === "number" &&
        typeof value.total === "number" &&
        typeof value.data === "string"
      );
    case "annotation":
      return (
        (value.op === "add" || value.op === "modify" || value.op === "remove") &&
        typeof value.page === "number" &&
        typeof value.id === "string"
      );
    case "page":
      return typeof value.page === "number";
    default:
      return false;
  }
}

export function encodePdfChunks(
  bytes: Uint8Array,
  originId = "host",
  name = "document.pdf",
): PdfChunkMessage[] {
  const total = Math.max(1, Math.ceil(bytes.length / CHUNK_SIZE));
  const chunks: PdfChunkMessage[] = [];

  for (let index = 0; index < total; index += 1) {
    const slice = bytes.subarray(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    chunks.push({
      type: "pdf-chunk",
      originId,
      name,
      index,
      total,
      data: bytesToBase64(slice),
    });
  }

  return chunks;
}

export function decodePdfChunks(chunks: PdfChunkMessage[]): Uint8Array {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  const totalBytes = ordered.reduce(
    (sum, chunk) => sum + base64ToBytes(chunk.data).length,
    0,
  );
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of ordered) {
    const part = base64ToBytes(chunk.data);
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
