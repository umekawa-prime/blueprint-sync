import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { serializeAnnotations } from "./annotationPersist";
import { serializeProjectJson, type ProjectMeta } from "./projectFormat";
import { packProjectZip } from "./projectPackage";
import { buildProjectZip, planIncoming, shareProjectBundle } from "./projectShare";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

function sampleMeta(id = "11111111-1111-4111-8111-111111111111"): ProjectMeta {
  return {
    id,
    name: "現場A",
    createdAt: "2026-09-06T00:00:00.000Z",
    status: "open",
    links: [],
  };
}

describe("buildProjectZip", () => {
  it("packs listed project files from the sandbox root", async () => {
    const files: Record<string, Uint8Array> = {
      ".blueprint-sync/project.json": strToU8(serializeProjectJson(sampleMeta())),
      "図面/1F.pdf": pdfBytes,
    };
    const zip = await buildProjectZip({
      folder: "/app/projects/11111111-1111-4111-8111-111111111111",
      listFiles: async () => Object.keys(files),
      readFile: async (path) => {
        const rel = path.replace("/app/projects/11111111-1111-4111-8111-111111111111/", "");
        return files[rel];
      },
    });
    const unpacked = (await import("./projectPackage")).unpackProjectZip(zip);
    expect(unpacked.kind).toBe("project");
    if (unpacked.kind === "project") {
      expect(unpacked.meta.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(unpacked.files["図面/1F.pdf"]).toEqual(pdfBytes);
    }
  });
});

describe("planIncoming", () => {
  it("installs a project bundle into a new sandbox id", () => {
    const zip = packProjectZip({
      ".blueprint-sync/project.json": strToU8(serializeProjectJson(sampleMeta())),
      "図面/1F.pdf": pdfBytes,
    });
    const plan = planIncoming({
      name: "現場A.bpsync.zip",
      bytes: zip,
      projectOpen: false,
      existingIds: [],
    });
    expect(plan.action).toBe("install-project");
    if (plan.action === "install-project") {
      expect(plan.meta.id).toBe("11111111-1111-4111-8111-111111111111");
    }
  });

  it("does not mix a bundle with the same id unless overwrite is confirmed", () => {
    const zip = packProjectZip({
      ".blueprint-sync/project.json": strToU8(serializeProjectJson(sampleMeta())),
    });
    expect(
      planIncoming({
        name: "現場A.bpsync.zip",
        bytes: zip,
        projectOpen: true,
        existingIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toMatchObject({ action: "confirm-overwrite" });
    expect(
      planIncoming({
        name: "現場A.bpsync.zip",
        bytes: zip,
        projectOpen: true,
        existingIds: ["11111111-1111-4111-8111-111111111111"],
        overwrite: true,
      }),
    ).toMatchObject({ action: "overwrite-project" });
  });

  it("asks to open a project before importing a zip that is only PDFs", () => {
    const zip = zipSync({ "1F.pdf": pdfBytes });
    expect(
      planIncoming({
        name: "図面.zip",
        bytes: zip,
        projectOpen: false,
        existingIds: [],
      }),
    ).toEqual({
      action: "reject",
      reason: "先にプロジェクトを開くか、一式を共有してください",
    });
    expect(
      planIncoming({
        name: "図面.zip",
        bytes: zip,
        projectOpen: true,
        existingIds: [],
      }),
    ).toMatchObject({ action: "import-pdfs" });
  });

  it("offers to create a project from a lone PDF when none is open", () => {
    expect(
      planIncoming({
        name: "1F.pdf",
        bytes: pdfBytes,
        projectOpen: false,
        existingIds: [],
      }),
    ).toMatchObject({ action: "ask-new-from-pdf", name: "1F.pdf" });
    expect(
      planIncoming({
        name: "1F.pdf",
        bytes: pdfBytes,
        projectOpen: true,
        existingIds: [],
      }),
    ).toMatchObject({ action: "import-pdf", name: "1F.pdf" });
  });

  it("rejects a broken zip", () => {
    expect(
      planIncoming({
        name: "broken.zip",
        bytes: new Uint8Array([1, 2, 3]),
        projectOpen: false,
        existingIds: [],
      }),
    ).toMatchObject({ action: "reject" });
  });
});

describe("shareProjectBundle", () => {
  it("persists annotations before packing and does not share if persist fails", async () => {
    const share = vi.fn();
    const persist = vi.fn().mockResolvedValue(false);

    await expect(
      shareProjectBundle({
        persist,
        folder: "/app/projects/a",
        name: "現場A",
        listFiles: async () => [".blueprint-sync/project.json"],
        readFile: async () => strToU8("{}"),
        share,
      }),
    ).resolves.toBe("persist-failed");

    expect(persist).toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it("shares a .bpsync.zip after a successful persist", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const zip = await shareProjectBundle({
      persist: async () => true,
      folder: "/app/projects/a",
      name: "現場A",
      listFiles: async () => [".blueprint-sync/project.json", "図面/1F.pdf"],
      readFile: async (path) => {
        if (path.endsWith("project.json")) {
          return strToU8(serializeProjectJson(sampleMeta()));
        }
        return pdfBytes;
      },
      share,
    });

    expect(zip).toBe("shared");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "現場A.bpsync.zip",
        mime: "application/zip",
      }),
    );
  });
});

describe("annotation pins stay inside the bundle", () => {
  it("keeps photoPins in the packed annotation json", async () => {
    const annotation = serializeAnnotations(
      {},
      {
        0: {
          "pin-1": {
            id: "pin-1",
            nx: 0.2,
            ny: 0.3,
            thumbnailDataUrl: "data:image/jpeg;base64,aaa",
            imageDataUrl: "data:image/jpeg;base64,bbb",
          },
        },
      },
    );
    const zip = await buildProjectZip({
      folder: "/p",
      listFiles: async () => [
        ".blueprint-sync/project.json",
        ".blueprint-sync/annotations/図面__1F.pdf.json",
      ],
      readFile: async (path) => {
        if (path.endsWith("project.json")) {
          return strToU8(serializeProjectJson(sampleMeta()));
        }
        return strToU8(annotation);
      },
    });
    const unpacked = (await import("./projectPackage")).unpackProjectZip(zip);
    expect(unpacked.kind).toBe("project");
    if (unpacked.kind !== "project") {
      return;
    }
    const parsed = JSON.parse(
      new TextDecoder().decode(unpacked.files[".blueprint-sync/annotations/図面__1F.pdf.json"]),
    );
    expect(parsed.photoPins[0]["pin-1"].id).toBe("pin-1");
  });
});
