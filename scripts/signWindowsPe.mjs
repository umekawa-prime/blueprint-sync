import path from "node:path";
import { fileURLToPath } from "node:url";
import { signPeFile } from "./windowsCodeSign.mjs";

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node scripts/signWindowsPe.mjs <file.exe>");
    process.exit(1);
  }
  try {
    signPeFile(target);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
