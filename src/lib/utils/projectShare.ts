import { isProjectPdfBasename } from "./projectFormat";
import type { ProjectMeta } from "./projectFormat";
import { bpsyncFileName, packProjectZip, unpackProjectZip } from "./projectPackage";
import { shareFileBytes, type ShareFileBytesDeps } from "./shareFile";
import { isZipBasename } from "./zipPdf";

export type IncomingPlan =
  | { action: "install-project"; meta: ProjectMeta; files: Record<string, Uint8Array> }
  | { action: "overwrite-project"; meta: ProjectMeta; files: Record<string, Uint8Array> }
  | { action: "confirm-overwrite"; meta: ProjectMeta; files: Record<string, Uint8Array> }
  | { action: "import-pdfs"; zipBytes: Uint8Array }
  | { action: "import-pdf"; name: string; bytes: Uint8Array }
  | { action: "ask-new-from-pdf"; name: string; bytes: Uint8Array }
  | { action: "reject"; reason: string };

export type BuildProjectZipDeps = {
  folder: string;
  listFiles: (folder: string) => Promise<string[]>;
  readFile: (path: string) => Promise<Uint8Array>;
};

export async function buildProjectZip(deps: BuildProjectZipDeps): Promise<Uint8Array> {
  const root = deps.folder.replace(/[/\\]+$/, "");
  const rels = await deps.listFiles(root);
  const files: Record<string, Uint8Array> = {};
  for (const rel of rels) {
    const normalized = rel.replaceAll("\\", "/");
    files[normalized] = await deps.readFile(`${root}/${normalized}`);
  }
  return packProjectZip(files);
}

export function planIncoming(input: {
  name: string;
  bytes: Uint8Array;
  projectOpen: boolean;
  existingIds: string[];
  overwrite?: boolean;
}): IncomingPlan {
  if (isZipBasename(input.name)) {
    const unpacked = unpackProjectZip(input.bytes);
    if (unpacked.kind === "invalid") {
      return { action: "reject", reason: unpacked.reason };
    }
    if (unpacked.kind === "pdfs") {
      if (!input.projectOpen) {
        return {
          action: "reject",
          reason: "先にプロジェクトを開くか、一式を共有してください",
        };
      }
      return { action: "import-pdfs", zipBytes: input.bytes };
    }
    const exists = input.existingIds.includes(unpacked.meta.id);
    if (exists && !input.overwrite) {
      return {
        action: "confirm-overwrite",
        meta: unpacked.meta,
        files: unpacked.files,
      };
    }
    if (exists && input.overwrite) {
      return {
        action: "overwrite-project",
        meta: unpacked.meta,
        files: unpacked.files,
      };
    }
    return {
      action: "install-project",
      meta: unpacked.meta,
      files: unpacked.files,
    };
  }

  if (isProjectPdfBasename(input.name)) {
    if (input.projectOpen) {
      return { action: "import-pdf", name: input.name, bytes: input.bytes };
    }
    return { action: "ask-new-from-pdf", name: input.name, bytes: input.bytes };
  }

  return { action: "reject", reason: "PDF または ZIP を選んでください" };
}

export async function shareProjectBundle(deps: {
  persist: () => Promise<boolean>;
  folder: string;
  name: string;
  listFiles: (folder: string) => Promise<string[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  share: (input: ShareFileBytesDeps) => Promise<void>;
}): Promise<"shared" | "persist-failed" | "pack-failed"> {
  const persisted = await deps.persist();
  if (!persisted) {
    return "persist-failed";
  }
  try {
    const bytes = await buildProjectZip({
      folder: deps.folder,
      listFiles: deps.listFiles,
      readFile: deps.readFile,
    });
    await deps.share({
      name: bpsyncFileName(deps.name),
      bytes,
      mime: "application/zip",
    });
    return "shared";
  } catch {
    return "pack-failed";
  }
}

export { shareFileBytes };
