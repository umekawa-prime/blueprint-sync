import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  encodePdfChunks,
  parseSyncMessage,
  serializeSyncMessage,
  type SyncMessage,
} from "./syncProtocol";

describe("syncProtocol", () => {
  it("round-trips an annotation add message", () => {
    const message: SyncMessage = {
      type: "annotation",
      originId: "client-a",
      op: "add",
      page: 2,
      id: "obj-1",
      object: { type: "path", path: "M 0 0 L 10 10" },
    };

    const parsed = parseSyncMessage(serializeSyncMessage(message));

    expect(parsed).toEqual(message);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSyncMessage("{not-json")).toThrow(/invalid sync message/i);
  });

  it("rejects payloads without a type", () => {
    expect(() => parseSyncMessage(JSON.stringify({ originId: "x" }))).toThrow(
      /invalid sync message/i,
    );
  });

  it("splits a PDF into base64 chunks and reassembles the original bytes", () => {
    const bytes = Uint8Array.from(
      { length: CHUNK_SIZE * 2 + 17 },
      (_, i) => i % 256,
    );

    const chunks = encodePdfChunks(bytes);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.type === "pdf-chunk")).toBe(true);
    expect(chunks[0]?.index).toBe(0);
    expect(chunks[2]?.index).toBe(2);
    expect(chunks[0]?.total).toBe(3);

    const reassembled = new Uint8Array(bytes.length);
    for (const chunk of chunks) {
      const part = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
      reassembled.set(part, chunk.index * CHUNK_SIZE);
    }

    expect(reassembled).toEqual(bytes);
  });

  it("builds a hello message with role and client id", () => {
    const message: SyncMessage = {
      type: "hello",
      originId: "android-1",
      role: "client",
    };

    expect(parseSyncMessage(serializeSyncMessage(message))).toEqual(message);
  });
});
