import type { ClientRole } from "$lib/utils/syncProtocol";
import type { SyncConnection } from "$lib/utils/syncClient";

export type ConnectionStatus =
  | "idle"
  | "hosting"
  | "connecting"
  | "connected"
  | "error";

class ConnectionStore {
  role = $state<ClientRole>("host");
  status = $state<ConnectionStatus>("idle");
  url = $state("");
  ip = $state("");
  port = $state(7840);
  addresses = $state<string[]>([]);
  error = $state("");
  peerCount = $state(0);
  connection = $state<SyncConnection | null>(null);

  get isHost() {
    return this.role === "host";
  }

  get canSync() {
    return this.status === "connected" || this.status === "hosting";
  }

  reset() {
    this.connection?.close();
    this.connection = null;
    this.status = "idle";
    this.error = "";
    this.peerCount = 0;
  }
}

export const connectionStore = new ConnectionStore();
