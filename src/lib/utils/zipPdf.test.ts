import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { isZipBasename, pdfEntriesFromZip } from "./zipPdf";

const pdfA = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const pdfB = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32]);

describe("isZipBasename", () => {
  it("accepts a zip filename at the folder root", () => {
    expect(isZipBasename("図面.zip")).toBe(true);
    expect(isZipBasename("plans.ZIP")).toBe(true);
    expect(isZipBasename("../x.zip")).toBe(false);
    expect(isZipBasename("a.pdf")).toBe(false);
  });
});

describe("pdfEntriesFromZip", () => {
  it("extracts nested pdfs by basename and skips other files", () => {
    const zip = zipSync({
      "1F.pdf": pdfA,
      "nested/工程.pdf": pdfB,
      "readme.txt": strToU8("hello"),
      "folder/": new Uint8Array(),
    });

    expect(pdfEntriesFromZip(zip)).toEqual([
      { name: "1F.pdf", bytes: pdfA },
      { name: "工程.pdf", bytes: pdfB },
    ]);
  });

  it("skips zip-slip paths and duplicate basenames", () => {
    const zip = zipSync({
      "../escape.pdf": pdfA,
      "a/x.pdf": pdfA,
      "b/x.pdf": pdfB,
    });

    expect(pdfEntriesFromZip(zip)).toEqual([{ name: "x.pdf", bytes: pdfA }]);
  });
});
