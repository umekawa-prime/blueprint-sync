import { zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { importZipPdfsIntoFolder } from "./zipImport";

const pdfA = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const pdfB = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32]);

describe("importZipPdfsIntoFolder", () => {
  it("writes every pdf from a zip into the drawing folder", async () => {
    const zip = zipSync({
      "1F.pdf": pdfA,
      "nested/2F.pdf": pdfB,
    });
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const result = await importZipPdfsIntoFolder({
      zipBytes: zip,
      kind: "drawing",
      projectFolder: "/projects/a",
      pathExists: vi.fn().mockResolvedValue(false),
      writeFile,
    });

    expect(result.imported).toEqual(["図面/1F.pdf", "図面/2F.pdf"]);
    expect(writeFile).toHaveBeenCalledWith("/projects/a/図面/1F.pdf", pdfA);
    expect(writeFile).toHaveBeenCalledWith("/projects/a/図面/2F.pdf", pdfB);
  });

  it("writes schedule pdfs into 工程表 and skips names that already exist", async () => {
    const zip = zipSync({
      "週間工程.pdf": pdfA,
      "既存.pdf": pdfB,
    });
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const pathExists = vi.fn().mockImplementation(async (path: string) => path.endsWith("既存.pdf"));

    const result = await importZipPdfsIntoFolder({
      zipBytes: zip,
      kind: "schedule",
      projectFolder: "/projects/a",
      pathExists,
      writeFile,
    });

    expect(result.imported).toEqual(["工程表/週間工程.pdf"]);
    expect(result.skipped).toEqual(["既存.pdf"]);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("rejects a zip that contains no pdfs", async () => {
    const zip = zipSync({ "notes.txt": new Uint8Array([1, 2, 3]) });

    await expect(
      importZipPdfsIntoFolder({
        zipBytes: zip,
        kind: "drawing",
        projectFolder: "/projects/a",
        pathExists: vi.fn(),
        writeFile: vi.fn(),
      }),
    ).rejects.toThrow(/PDF/);
  });
});
