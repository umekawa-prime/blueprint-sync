import { beforeEach, describe, expect, it, vi } from "vitest";
import { shareFileBytes } from "./shareFile";

describe("shareFileBytes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("puts a File on the OS share sheet when the Web Share API accepts files", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const download = vi.fn();
    const bytes = Uint8Array.from([1, 2, 3]);

    await shareFileBytes({
      name: "現場A.bpsync.zip",
      bytes,
      mime: "application/zip",
      share,
      canShare,
      download,
    });

    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as { title: string; files: File[] };
    expect(payload.title).toBe("現場A.bpsync.zip");
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].name).toBe("現場A.bpsync.zip");
    expect(payload.files[0].type).toBe("application/zip");
    expect(download).not.toHaveBeenCalled();
  });

  it("falls back to a download when sharing files is not available", async () => {
    const download = vi.fn();
    const bytes = Uint8Array.from([9]);

    await shareFileBytes({
      name: "図面.pdf",
      bytes,
      mime: "application/pdf",
      share: undefined,
      canShare: () => false,
      download,
    });

    expect(download).toHaveBeenCalledWith("図面.pdf", bytes, "application/pdf");
  });
});
