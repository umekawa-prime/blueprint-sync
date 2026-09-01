import { describe, expect, it } from "vitest";
import {
  encodeOneDriveShareToken,
  filenameFromContentDisposition,
  isOneDriveShareUrl,
  isPdfMagic,
  oneDriveChildrenUrl,
  oneDriveContentUrl,
  oneDriveRootUrl,
  pdfItemsFromDriveChildren,
  suggestedPdfFileName,
} from "./oneDriveShare";

describe("isOneDriveShareUrl", () => {
  it("accepts 1drv, onedrive.live, and sharepoint hosts", () => {
    expect(isOneDriveShareUrl("https://1drv.ms/b/s!Abc")).toBe(true);
    expect(isOneDriveShareUrl("https://onedrive.live.com/redir?resid=1")).toBe(true);
    expect(isOneDriveShareUrl("https://contoso.sharepoint.com/:b:/g/personal/a/xyz")).toBe(true);
    expect(isOneDriveShareUrl("https://example.com/file.pdf")).toBe(false);
  });
});

describe("encodeOneDriveShareToken", () => {
  it("encodes a sharing URL as an unpadded u! base64url token", () => {
    const token = encodeOneDriveShareToken("https://1drv.ms/b/s!Abc");
    expect(token.startsWith("u!")).toBe(true);
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
    expect(token).not.toContain("=");
    expect(oneDriveRootUrl("https://1drv.ms/b/s!Abc")).toBe(
      `https://api.onedrive.com/v1.0/shares/${token}/root`,
    );
    expect(oneDriveContentUrl("https://1drv.ms/b/s!Abc")).toBe(
      `https://api.onedrive.com/v1.0/shares/${token}/root/content`,
    );
    expect(oneDriveChildrenUrl("https://1drv.ms/b/s!Abc")).toBe(
      `https://api.onedrive.com/v1.0/shares/${token}/root/children`,
    );
  });
});

describe("filenameFromContentDisposition", () => {
  it("reads a quoted filename", () => {
    expect(filenameFromContentDisposition('attachment; filename="plan.pdf"')).toBe("plan.pdf");
  });

  it("decodes RFC 5987 UTF-8 filenames", () => {
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''%E5%9B%B3%E9%9D%A2.pdf")).toBe(
      "図面.pdf",
    );
  });
});

describe("suggestedPdfFileName", () => {
  it("prefers a valid Content-Disposition name, then title.pdf, then a default", () => {
    expect(
      suggestedPdfFileName({
        contentDisposition: 'attachment; filename="1F.pdf"',
        fallbackTitle: "ignored",
      }),
    ).toBe("1F.pdf");
    expect(suggestedPdfFileName({ fallbackTitle: "週間工程" })).toBe("週間工程.pdf");
    expect(suggestedPdfFileName({})).toBe("onedrive.pdf");
  });

  it("rejects path-like disposition names", () => {
    expect(
      suggestedPdfFileName({
        contentDisposition: 'attachment; filename="../x.pdf"',
        fallbackTitle: "安全",
      }),
    ).toBe("安全.pdf");
  });
});

describe("isPdfMagic", () => {
  it("detects the PDF header", () => {
    expect(isPdfMagic(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(isPdfMagic(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});

describe("pdfItemsFromDriveChildren", () => {
  it("keeps pdf files and uses a download url", () => {
    expect(
      pdfItemsFromDriveChildren({
        value: [
          {
            name: "a.pdf",
            file: { mimeType: "application/pdf" },
            "@content.downloadUrl": "https://cdn.example/a",
          },
          { name: "notes.txt", file: { mimeType: "text/plain" } },
          { name: "sub", folder: { childCount: 2 } },
          {
            name: "B.PDF",
            file: {},
            "@microsoft.graph.downloadUrl": "https://cdn.example/b",
          },
        ],
      }),
    ).toEqual([
      { name: "a.pdf", url: "https://cdn.example/a" },
      { name: "B.PDF", url: "https://cdn.example/b" },
    ]);
  });
});
