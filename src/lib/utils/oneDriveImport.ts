import {
  isPdfMagic,
  oneDriveChildrenUrl,
  oneDriveContentUrl,
  oneDriveRootUrl,
  pdfItemsFromDriveChildren,
  suggestedPdfFileName,
} from "./oneDriveShare";
import {
  isAllowedLinkUrl,
  joinProjectPdfRelPath,
  type ProjectPdfKind,
} from "./projectFormat";

export type HttpGetResult = {
  status: number;
  contentType: string;
  contentDisposition: string;
  bytes: Uint8Array;
};

export type OneDriveImportDeps = {
  shareUrl: string;
  kind: ProjectPdfKind;
  projectFolder: string;
  fallbackTitle?: string;
  httpGet: (url: string) => Promise<HttpGetResult>;
  pathExists: (path: string) => Promise<boolean>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
};

export type OneDriveImportResult = {
  imported: string[];
  skipped: string[];
};

function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}

function isJsonPayload(result: HttpGetResult): boolean {
  return result.contentType.toLowerCase().includes("json") && !isPdfMagic(result.bytes);
}

function assertOk(result: HttpGetResult, context: string): void {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `${context}に失敗しました（HTTP ${result.status}）。公開リンクか確認してください`,
    );
  }
}

async function savePdf(
  deps: OneDriveImportDeps,
  bytes: HttpGetResult,
  itemName?: string,
): Promise<string> {
  if (!isPdfMagic(bytes.bytes) && !bytes.contentType.toLowerCase().includes("pdf")) {
    throw new Error("ダウンロードしたファイルはPDFではありません");
  }
  const name = suggestedPdfFileName({
    contentDisposition: bytes.contentDisposition,
    fallbackTitle: deps.fallbackTitle,
    itemName,
  });
  const relPath = joinProjectPdfRelPath(deps.kind, name);
  const destPath = `${deps.projectFolder}/${relPath}`;
  if (await deps.pathExists(destPath)) {
    return `__skipped__:${name}`;
  }
  await deps.writeFile(destPath, bytes.bytes);
  return relPath;
}

export async function importOneDrivePdfsIntoFolder(
  deps: OneDriveImportDeps,
): Promise<OneDriveImportResult> {
  if (!isAllowedLinkUrl(deps.shareUrl)) {
    throw new Error("http または https の URL だけ取り込めます");
  }

  const root = await deps.httpGet(oneDriveRootUrl(deps.shareUrl));
  assertOk(root, "OneDriveの参照");

  const imported: string[] = [];
  const skipped: string[] = [];

  const remember = (saved: string) => {
    if (saved.startsWith("__skipped__:")) {
      skipped.push(saved.slice("__skipped__:".length));
      return;
    }
    imported.push(saved);
  };

  if (isPdfMagic(root.bytes)) {
    remember(await savePdf(deps, root));
    return { imported, skipped };
  }

  if (!isJsonPayload(root)) {
    remember(await savePdf(deps, root));
    return { imported, skipped };
  }

  const meta = parseJson(root.bytes) as Record<string, unknown>;
  if (meta.file) {
    const content = await deps.httpGet(oneDriveContentUrl(deps.shareUrl));
    assertOk(content, "OneDriveのダウンロード");
    remember(
      await savePdf(deps, content, typeof meta.name === "string" ? meta.name : undefined),
    );
    return { imported, skipped };
  }

  if (meta.folder) {
    const children = await deps.httpGet(oneDriveChildrenUrl(deps.shareUrl));
    assertOk(children, "OneDriveフォルダの一覧");
    const items = pdfItemsFromDriveChildren(parseJson(children.bytes));
    if (items.length === 0) {
      throw new Error("共有フォルダにPDFが見つかりませんでした");
    }
    for (const item of items) {
      const file = await deps.httpGet(item.url);
      assertOk(file, item.name);
      remember(await savePdf(deps, file, item.name));
    }
    return { imported, skipped };
  }

  throw new Error("OneDriveからPDFを取得できませんでした");
}
