import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const env = { ...process.env };
const isWsl =
  Boolean(process.env.WSL_DISTRO_NAME) ||
  (existsSync("/proc/version") &&
    readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft"));

if (isWsl) {
  // WSLg + WebKitGTK often fails GPU compositing (MESA/ZINK) and the window
  // then shows a blank/500-like page. Force software rendering.
  env.WEBKIT_DISABLE_COMPOSITING_MODE ??= "1";
  env.WEBKIT_DISABLE_DMABUF_RENDERER ??= "1";
  env.LIBGL_ALWAYS_SOFTWARE ??= "1";
}

const child = spawn("tauri", process.argv.slice(2), {
  env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
