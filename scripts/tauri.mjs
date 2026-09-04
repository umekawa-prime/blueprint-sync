import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyWslGraphicsEnv } from "./wslGraphicsEnv.mjs";

const isWsl =
  Boolean(process.env.WSL_DISTRO_NAME) ||
  (existsSync("/proc/version") &&
    readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft"));

const env = applyWslGraphicsEnv({ ...process.env }, isWsl);
const tauriCli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/@tauri-apps/cli/tauri.js",
);

const child = spawn(process.execPath, [tauriCli, ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
