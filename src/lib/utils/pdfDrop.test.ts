import { describe, expect, it } from "vitest";
import { firstDroppedPdf, firstDroppedPdfOrZip, isDroppedPdfFile, isDroppedZipFile } from "./pdfDrop";

describe("isDroppedPdfFile", () => {
  it("accepts the application/pdf MIME type", () => {
    expect(isDroppedPdfFile({ name: "plan.pdf", type: "application/pdf" })).toBe(true);
  });

  it("accepts a .pdf filename when the MIME type is empty (Linux file managers)", () => {
    expect(isDroppedPdfFile({ name: "図面.PDF", type: "" })).toBe(true);
  });

  it("rejects non-pdf files even if they claim a pdf MIME type is missing", () => {
    expect(isDroppedPdfFile({ name: "notes.txt", type: "" })).toBe(false);
    expect(isDroppedPdfFile({ name: "photo.png", type: "image/png" })).toBe(false);
  });
});

describe("firstDroppedPdf", () => {
  it("returns the first pdf in a file list", () => {
    const txt = new File(["a"], "notes.txt", { type: "text/plain" });
    const pdf = new File(["b"], "A.pdf", { type: "" });
    expect(firstDroppedPdf([txt, pdf])).toBe(pdf);
  });

  it("returns null when nothing is a pdf", () => {
    expect(firstDroppedPdf(null)).toBeNull();
    expect(firstDroppedPdf([new File(["a"], "notes.txt")])).toBeNull();
  });
});

describe("isDroppedZipFile", () => {
  it("accepts zip mime types and a .zip filename", () => {
    expect(isDroppedZipFile({ name: "plans.zip", type: "application/zip" })).toBe(true);
    expect(isDroppedZipFile({ name: "図面.ZIP", type: "" })).toBe(true);
    expect(isDroppedZipFile({ name: "A.pdf", type: "application/pdf" })).toBe(false);
  });
});

describe("firstDroppedPdfOrZip", () => {
  it("returns the first pdf or zip in a file list", () => {
    const txt = new File(["a"], "notes.txt", { type: "text/plain" });
    const zip = new File(["b"], "plans.zip", { type: "" });
    expect(firstDroppedPdfOrZip([txt, zip])).toBe(zip);
    expect(firstDroppedPdfOrZip([new File(["a"], "notes.txt")])).toBeNull();
  });
});
