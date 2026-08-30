import {
  decodePdfChunks,
  parseSyncMessage,
  serializeSyncMessage,
  type ClientRole,
  type PdfChunkMessage,
  type SyncMessage,
} from "./syncProtocol";

export type SyncHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: SyncMessage) => void;
  onPdf?: (name: string, bytes: Uint8Array) => void;
};

export type SyncConnection = {
  clientId: string;
  send: (message: Exclude<SyncMessage, "originId"> & { originId?: string }) => void;
  close: () => void;
};

export function connectSync(
  url: string,
  role: ClientRole,
  handlers: SyncHandlers = {},
): SyncConnection {
  const clientId = crypto.randomUUID();
  const socket = new WebSocket(url);
  const incomingChunks = new Map<string, PdfChunkMessage[]>();

  socket.addEventListener("open", () => {
    socket.send(
      serializeSyncMessage({
        type: "hello",
        originId: clientId,
        role,
      }),
    );
    handlers.onOpen?.();
  });

  socket.addEventListener("close", () => {
    handlers.onClose?.();
  });

  socket.addEventListener("error", (error) => {
    handlers.onError?.(error);
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      return;
    }

    const message = parseSyncMessage(event.data);
    if (message.originId === clientId) {
      return;
    }

    handlers.onMessage?.(message);

    if (message.type === "pdf-chunk") {
      const key = `${message.originId}:${message.name}`;
      const collected = incomingChunks.get(key) ?? [];
      collected.push(message);
      incomingChunks.set(key, collected);
      if (collected.length === message.total) {
        handlers.onPdf?.(message.name, decodePdfChunks(collected));
        incomingChunks.delete(key);
      }
    }
  });

  return {
    clientId,
    send(message) {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(
        serializeSyncMessage({
          ...message,
          originId: message.originId ?? clientId,
        } as SyncMessage),
      );
    },
    close() {
      socket.close();
    },
  };
}

export function connectionQrPayload(url: string): string {
  return JSON.stringify({ app: "blueprint-sync", url });
}

export function parseConnectionQrPayload(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as { url?: string };
    if (parsed.url) {
      return parsed.url;
    }
  } catch {
    // fall through to host:port handling
  }

  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(trimmed)) {
    return trimmed.includes(":") ? `ws://${trimmed}` : `ws://${trimmed}:7840`;
  }

  throw new Error("QRコードまたは接続先を解析できませんでした");
}
