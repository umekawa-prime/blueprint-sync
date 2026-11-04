import { normalizeFsPath } from "./projectMove";

export type FolderLock = { release(): void };

const held = new Map<string, () => void>();

function lockName(folder: string): string {
  return "blueprint-sync:" + normalizeFsPath(folder);
}

/** Take a per-folder lock shared by all tabs. Returns null when another tab holds it. */
export async function acquireFolderLock(folder: string): Promise<FolderLock | null> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) {
    return { release() {} };
  }
  const name = lockName(folder);
  return new Promise<FolderLock | null>((resolve, reject) => {
    locks
      .request(name, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        return new Promise<void>((done) => {
          const release = () => {
            if (held.get(name) === release) {
              held.delete(name);
            }
            done();
          };
          held.set(name, release);
          resolve({ release });
        });
      })
      .catch(reject);
  });
}

export function releaseFolderLock(folder: string): void {
  held.get(lockName(folder))?.();
}
