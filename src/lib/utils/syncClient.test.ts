import { describe, expect, it } from "vitest";
import { connectionQrPayload, parseConnectionQrPayload } from "./syncClient";

describe("connection QR payload", () => {
  it("parses a JSON payload produced for the host QR code", () => {
    const payload = connectionQrPayload("ws://192.168.1.8:7840");
    expect(parseConnectionQrPayload(payload)).toBe("ws://192.168.1.8:7840");
  });

  it("accepts a raw WebSocket URL", () => {
    expect(parseConnectionQrPayload("ws://10.0.0.2:7840")).toBe(
      "ws://10.0.0.2:7840",
    );
  });

  it("accepts a bare IPv4 address and applies the default port", () => {
    expect(parseConnectionQrPayload("192.168.43.1")).toBe(
      "ws://192.168.43.1:7840",
    );
  });

  it("rejects unrelated text", () => {
    expect(() => parseConnectionQrPayload("not-a-host")).toThrow();
  });
});
