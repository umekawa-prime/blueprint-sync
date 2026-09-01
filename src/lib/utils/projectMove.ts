export function normalizeFsPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

export function shouldDeleteSourceAfterCopy(source: string, dest: string): boolean {
  return normalizeFsPath(source) !== normalizeFsPath(dest);
}
