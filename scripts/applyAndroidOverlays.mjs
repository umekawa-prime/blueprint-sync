import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedMainActivity = path.join(
  root,
  "src-tauri/gen/android/app/src/main/java/com/mitra/blueprintsync/MainActivity.kt",
);
const overlayMainActivity = path.join(root, "src-tauri/android/MainActivity.kt");

export function applyAndroidOverlays() {
  if (!existsSync(overlayMainActivity) || !existsSync(path.dirname(generatedMainActivity))) {
    return;
  }
  mkdirSync(path.dirname(generatedMainActivity), { recursive: true });
  copyFileSync(overlayMainActivity, generatedMainActivity);
}
