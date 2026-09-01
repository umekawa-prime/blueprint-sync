import { describe, expect, it, vi } from "vitest";
import { importOneDrivePdfsIntoFolder, type HttpGetResult } from "./oneDriveImport";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

function jsonResult(body: unknown): HttpGetResult {
  return {
    status: 200,
    contentType: "application/json",
    contentDisposition: "",
    bytes: new TextEncoder().encode(JSON.stringify(body)),
  };
}

function pdfResult(name = "plan.pdf"): HttpGetResult {
  return {
    status: 200,
    contentType: "application/pdf",
    contentDisposition: `attachment; filename="${name}"`,
    bytes: pdfBytes,
  };
}

describe("importOneDrivePdfsIntoFolder", () => {
  it("downloads a shared file into the drawing folder", async () => {
    const httpGet = vi
      .fn()
      .mockResolvedValueOnce(jsonResult({ file: { mimeType: "application/pdf" }, name: "1F.pdf" }))
      .mockResolvedValueOnce(pdfResult("1F.pdf"));
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const pathExists = vi.fn().mockResolvedValue(false);

    const result = await importOneDrivePdfsIntoFolder({
      shareUrl: "https://1drv.ms/b/s!Abc",
      kind: "drawing",
      projectFolder: "/projects/a",
      httpGet,
      pathExists,
      writeFile,
    });

    expect(result.imported).toEqual(["図面/1F.pdf"]);
    expect(writeFile).toHaveBeenCalledWith("/projects/a/図面/1F.pdf", pdfBytes);
  });

  it("downloads pdfs from a shared folder into 工程表", async () => {
    const httpGet = vi
      .fn()
      .mockResolvedValueOnce(jsonResult({ folder: { childCount: 2 } }))
      .mockResolvedValueOnce(
        jsonResult({
          value: [
            {
              name: "週間工程.pdf",
              file: {},
              "@content.downloadUrl": "https://cdn.example/schedule.pdf",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(pdfResult("週間工程.pdf"));
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const result = await importOneDrivePdfsIntoFolder({
      shareUrl: "https://1drv.ms/f/s!Folder",
      kind: "schedule",
      projectFolder: "/projects/a",
      httpGet,
      pathExists: vi.fn().mockResolvedValue(false),
      writeFile,
    });

    expect(httpGet).toHaveBeenNthCalledWith(3, "https://cdn.example/schedule.pdf");
    expect(result.imported).toEqual(["工程表/週間工程.pdf"]);
    expect(writeFile).toHaveBeenCalledWith("/projects/a/工程表/週間工程.pdf", pdfBytes);
  });

  it("skips names that already exist and does not overwrite", async () => {
    const httpGet = vi
      .fn()
      .mockResolvedValueOnce(jsonResult({ file: { mimeType: "application/pdf" }, name: "1F.pdf" }))
      .mockResolvedValueOnce(pdfResult("1F.pdf"));
    const writeFile = vi.fn();

    const result = await importOneDrivePdfsIntoFolder({
      shareUrl: "https://1drv.ms/b/s!Abc",
      kind: "drawing",
      projectFolder: "/projects/a",
      httpGet,
      pathExists: vi.fn().mockResolvedValue(true),
      writeFile,
    });

    expect(result.imported).toEqual([]);
    expect(result.skipped).toEqual(["1F.pdf"]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a non-pdf payload", async () => {
    const httpGet = vi
      .fn()
      .mockResolvedValueOnce(jsonResult({ file: { mimeType: "image/png" }, name: "photo.png" }))
      .mockResolvedValueOnce({
        status: 200,
        contentType: "image/png",
        contentDisposition: 'attachment; filename="photo.png"',
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      });

    await expect(
      importOneDrivePdfsIntoFolder({
        shareUrl: "https://1drv.ms/b/s!Abc",
        kind: "drawing",
        projectFolder: "/projects/a",
        httpGet,
        pathExists: vi.fn().mockResolvedValue(false),
        writeFile: vi.fn(),
      }),
    ).rejects.toThrow(/PDF/);
  });
});
