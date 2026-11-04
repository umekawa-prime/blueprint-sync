// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {}

  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: FileSystemHandle | string;
    }): Promise<FileSystemDirectoryHandle>;
  }
}

export {};
