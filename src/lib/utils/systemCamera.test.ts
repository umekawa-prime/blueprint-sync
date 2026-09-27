import { describe, expect, it, vi } from "vitest";
import { shotsFromCameraRoll, watchSystemCameraShots } from "./systemCamera";

describe("watchSystemCameraShots", () => {
  it("imports photos saved after the Windows camera opens", async () => {
    const launch = vi.fn().mockResolvedValue(1_000);
    const listSince = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: "WIN_1.jpg", bytes: [1, 2, 3] },
        { name: "WIN_2.jpg", bytes: [4, 5] },
      ]);
    let clock = 0;
    const result = await watchSystemCameraShots({
      launch,
      listSince,
      sleep: async (ms) => {
        clock += ms;
      },
      shouldStop: () => false,
      intervalMs: 500,
      timeoutMs: 5_000,
      now: () => clock,
    });

    expect(launch).toHaveBeenCalledOnce();
    expect(listSince).toHaveBeenLastCalledWith(1_000);
    expect(result).toEqual({
      status: "captured",
      shots: [
        { name: "WIN_1.jpg", bytes: new Uint8Array([1, 2, 3]) },
        { name: "WIN_2.jpg", bytes: new Uint8Array([4, 5]) },
      ],
    });
  });

  it("stops when the user cancels", async () => {
    const result = await watchSystemCameraShots({
      launch: async () => 10,
      listSince: async () => [],
      sleep: async () => undefined,
      shouldStop: () => true,
      intervalMs: 0,
      timeoutMs: 5_000,
      now: () => 0,
    });
    expect(result).toEqual({ status: "cancelled" });
  });

  it("reports when no new photo appears before the wait ends", async () => {
    let clock = 0;
    const result = await watchSystemCameraShots({
      launch: async () => 10,
      listSince: async () => [],
      sleep: async (ms) => {
        clock += ms;
      },
      shouldStop: () => false,
      intervalMs: 500,
      timeoutMs: 1_000,
      now: () => clock,
    });
    expect(result).toEqual({ status: "timeout" });
  });

  it("surfaces a failure to open the camera app", async () => {
    const result = await watchSystemCameraShots({
      launch: async () => {
        throw new Error("Windows のカメラを起動できませんでした");
      },
      listSince: async () => [],
      sleep: async () => undefined,
      shouldStop: () => false,
    });
    expect(result).toEqual({
      status: "error",
      message: "Windows のカメラを起動できませんでした",
    });
  });
});

describe("shotsFromCameraRoll", () => {
  it("keeps image bytes as a Uint8Array", () => {
    expect(shotsFromCameraRoll([{ name: "a.jpg", bytes: [9] }])).toEqual([
      { name: "a.jpg", bytes: new Uint8Array([9]) },
    ]);
  });
});
