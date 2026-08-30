import { invoke } from "@tauri-apps/api/core";
import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { connectionStore } from "$lib/stores/connectionStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import {
  connectSync,
  parseConnectionQrPayload,
  type SyncConnection,
} from "./syncClient";
import { encodePdfChunks, type SyncMessage } from "./syncProtocol";
import { isTauriRuntime } from "./platform";

export type ServerInfo = {
  ip: string;
  port: number;
  url: string;
  addresses: string[];
};

export async function startHost(port = 7840): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("ホスト機能は Tauri アプリ上でのみ利用できます");
  }

  connectionStore.reset();
  connectionStore.role = "host";
  connectionStore.status = "connecting";

  const info = await invoke<ServerInfo>("start_sync_server", { port });
  connectionStore.ip = info.ip;
  connectionStore.port = info.port;
  connectionStore.url = info.url;
  connectionStore.addresses = info.addresses;
  connectionStore.connection = attachSocket(`ws://127.0.0.1:${info.port}`, "host");
  connectionStore.status = "hosting";
}

export async function stopHost(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("stop_sync_server").catch(() => undefined);
  }
  connectionStore.reset();
}

export function connectAsClient(raw: string): void {
  const url = parseConnectionQrPayload(raw);
  connectionStore.reset();
  connectionStore.role = "client";
  connectionStore.url = url;
  connectionStore.status = "connecting";
  connectionStore.connection = attachSocket(url, "client");
}

export function broadcastAnnotation(
  op: "add" | "modify" | "remove",
  page: number,
  id: string,
  object?: Record<string, unknown>,
) {
  send({
    type: "annotation",
    originId: connectionStore.connection?.clientId ?? "local",
    op,
    page,
    id,
    object,
  });
}

export function broadcastPage(page: number) {
  send({
    type: "page",
    originId: connectionStore.connection?.clientId ?? "local",
    page,
  });
}

export function sendCurrentPdf() {
  if (!pdfStore.bytes || connectionStore.role !== "host") {
    return;
  }
  const originId = connectionStore.connection?.clientId ?? "host";
  const chunks = encodePdfChunks(pdfStore.bytes, originId, pdfStore.name);
  send({
    type: "pdf-meta",
    originId,
    name: pdfStore.name,
    size: pdfStore.bytes.length,
    chunks: chunks.length,
  });
  for (const chunk of chunks) {
    send(chunk);
  }
}

function attachSocket(url: string, role: "host" | "client"): SyncConnection {
  const connection = connectSync(url, role, {
    onOpen() {
      if (role === "client") {
        connectionStore.status = "connected";
        connection.send({
          type: "request-pdf",
          originId: connection.clientId,
        });
      }
    },
    onClose() {
      if (connectionStore.status !== "idle") {
        connectionStore.status = "error";
        connectionStore.error = "接続が切断されました";
      }
    },
    onError() {
      connectionStore.status = "error";
      connectionStore.error = "接続に失敗しました";
    },
    onMessage: handleRemoteMessage,
    async onPdf(name, bytes) {
      annotationStore.clear();
      await pdfStore.load(name, bytes);
    },
  });
  return connection;
}

function handleRemoteMessage(message: SyncMessage) {
  if (message.type === "hello" && connectionStore.role === "host") {
    connectionStore.peerCount += 1;
    sendCurrentPdf();
    return;
  }

  if (message.type === "request-pdf" && connectionStore.role === "host") {
    sendCurrentPdf();
    return;
  }

  if (message.type === "page") {
    pdfStore.muteSync = true;
    void pdfStore.setPage(message.page).finally(() => {
      pdfStore.muteSync = false;
    });
    return;
  }

  if (message.type === "annotation") {
    annotationStore.applyRemote(
      message.page,
      message.id,
      message.object,
      message.op === "remove",
    );
  }
}

function send(message: SyncMessage) {
  connectionStore.connection?.send(message);
}
