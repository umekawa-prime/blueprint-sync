import { joinProjectPdfRelPath, type ProjectPdfKind } from "./projectFormat";
import { pdfEntriesFromZip } from "./zipPdf";

export type ZipImportDeps = {
  zipBytes: Uint8Array;
  kind: ProjectPdfKind;
  projectFolder: string;
  pathExists: (path: string) => Promise<boolean>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
};

export type ZipImportResult = {
  imported: string[];
  skipped: string[];
};

export async function importZipPdfsIntoFolder(deps: ZipImportDeps): Promise<ZipImportResult> {
  const entries = pdfEntriesFromZip(deps.zipBytes);
  if (entries.length === 0) {
    throw new Error("ZIPにPDFが見つかりませんでした");
  }

  const imported: string[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    const relPath = joinProjectPdfRelPath(deps.kind, entry.name);
    const destPath = `${deps.projectFolder}/${relPath}`;
    if (await deps.pathExists(destPath)) {
      skipped.push(entry.name);
      continue;
    }
    await deps.writeFile(destPath, entry.bytes);
    imported.push(relPath);
  }
  return { imported, skipped };
}
