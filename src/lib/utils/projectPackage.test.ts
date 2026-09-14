import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { serializeAnnotations } from "./annotationPersist";
import { serializeProjectJson, type ProjectMeta } from "./projectFormat";
import {
  bpsyncFileName,
  isSafeProjectZipPath,
  packProjectZip,
  sanitizeShareBaseName,
  unpackProjectZip,
} from "./projectPackage";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

function sampleMeta(): ProjectMeta {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "現場A",
    createdAt: "2026-09-06T00:00:00.000Z",
    status: "open",
    links: [],
  };
}

function samplePinFile(): string {
  return serializeAnnotations(
    { 0: { a: { id: "a", type: "path" } } },
    {
      0: {
        "pin-1": {
          id: "pin-1",
          nx: 0.4,
          ny: 0.6,
          thumbnailDataUrl: "data:image/jpeg;base64,aaa",
          imageDataUrl: "data:image/jpeg;base64,bbb",
        },
      },
    },
  );
}

describe("sanitizeShareBaseName", () => {
  it("strips path separators and control characters, and falls back to project", () => {
    expect(sanitizeShareBaseName("現場A/1F")).toBe("現場A1F");
    expect(sanitizeShareBaseName("a\\b:c")).toBe("abc");
    expect(sanitizeShareBaseName("\u0000")).toBe("project");
    expect(sanitizeShareBaseName("   ")).toBe("project");
  });
});

describe("bpsyncFileName", () => {
  it("uses the sanitized project name and .bpsync.zip suffix", () => {
    expect(bpsyncFileName("現場A")).toBe("現場A.bpsync.zip");
    expect(bpsyncFileName("../x")).toBe("..x.bpsync.zip");
    expect(bpsyncFileName("")).toBe("project.bpsync.zip");
  });
});

describe("isSafeProjectZipPath", () => {
  it("allows the project tree including .blueprint-sync", () => {
    expect(isSafeProjectZipPath(".blueprint-sync/project.json")).toBe(true);
    expect(isSafeProjectZipPath(".blueprint-sync/annotations/図面__1F.pdf.json")).toBe(true);
    expect(isSafeProjectZipPath("図面/1F.pdf")).toBe(true);
    expect(isSafeProjectZipPath("工程表/週間.pdf")).toBe(true);
    expect(isSafeProjectZipPath("legacy.pdf")).toBe(true);
  });

  it("rejects traversal, __MACOSX, and other dot segments", () => {
    expect(isSafeProjectZipPath("../escape.pdf")).toBe(false);
    expect(isSafeProjectZipPath("図面/../x.pdf")).toBe(false);
    expect(isSafeProjectZipPath("__MACOSX/._1F.pdf")).toBe(false);
    expect(isSafeProjectZipPath(".DS_Store")).toBe(false);
    expect(isSafeProjectZipPath("図面/.hidden.pdf")).toBe(false);
  });
});

describe("packProjectZip / unpackProjectZip", () => {
  it("round-trips project.json, drawings, and photo pins without a root folder name", () => {
    const meta = sampleMeta();
    const annotation = samplePinFile();
    const zip = packProjectZip({
      ".blueprint-sync/project.json": strToU8(serializeProjectJson(meta)),
      "図面/1F平面図.pdf": pdfBytes,
      ".blueprint-sync/annotations/図面__1F平面図.pdf.json": strToU8(annotation),
    });

    const unpacked = unpackProjectZip(zip);
    expect(unpacked.kind).toBe("project");
    if (unpacked.kind !== "project") {
      return;
    }
    expect(unpacked.meta).toEqual(meta);
    expect(unpacked.files["図面/1F平面図.pdf"]).toEqual(pdfBytes);
    expect(JSON.parse(new TextDecoder().decode(unpacked.files[".blueprint-sync/annotations/図面__1F平面図.pdf.json"]))).toEqual(
      JSON.parse(annotation),
    );

    const names = Object.keys(unzipSync(zip));
    expect(names.some((name) => name.startsWith("現場A/"))).toBe(false);
    expect(names).toContain(".blueprint-sync/project.json");
  });

  it("does not treat a zip without project.json as a project bundle", () => {
    const zip = zipSync({
      "1F.pdf": pdfBytes,
    });
    expect(unpackProjectZip(zip)).toEqual({ kind: "pdfs" });
  });

  it("rejects a corrupt zip and an invalid project.json", () => {
    expect(unpackProjectZip(new Uint8Array([1, 2, 3, 4]))).toEqual({
      kind: "invalid",
      reason: "ZIPが壊れています",
    });
    const zip = zipSync({
      ".blueprint-sync/project.json": strToU8("{not json}"),
    });
    expect(unpackProjectZip(zip)).toEqual({
      kind: "invalid",
      reason: "project.json が見つからないか、内容が不正です",
    });
  });

  it("rejects path traversal and does not pack __MACOSX or extra dot files", () => {
    const zip = packProjectZip({
      ".blueprint-sync/project.json": strToU8(serializeProjectJson(sampleMeta())),
      "__MACOSX/._x": new Uint8Array([1]),
      ".DS_Store": new Uint8Array([2]),
      "../escape.pdf": pdfBytes,
      "図面/1F.pdf": pdfBytes,
    });
    const names = Object.keys(unzipSync(zip));
    expect(names).toEqual([".blueprint-sync/project.json", "図面/1F.pdf"]);

    const slipped = zipSync({
      "../escape.pdf": pdfBytes,
      ".blueprint-sync/project.json": strToU8(serializeProjectJson(sampleMeta())),
    });
    expect(unpackProjectZip(slipped).kind).toBe("invalid");
  });
});
