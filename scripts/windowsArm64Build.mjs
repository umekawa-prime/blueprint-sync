import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeInstallerTrustFiles } from "./windowsCodeSign.mjs";

export const WINDOWS_ARM64_TARGET = "aarch64-pc-windows-msvc";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = path.join(os.homedir(), ".cache", "blueprint-sync");
const crossRoot = path.join(cacheRoot, "win-cross");
const crossPrefix = path.join(crossRoot, "root");
const crossBin = path.join(crossRoot, "bin");
const debsDir = path.join(crossRoot, "debs");

const LINUX_PACKAGES = [
  "nsis",
  "nsis-common",
  "nsis-pluginapi",
  "llvm-18",
  "llvm-18-runtime",
  "llvm-18-linker-tools",
  "libllvm18",
  "libpfm4",
  "clang-18",
  "libclang-cpp18",
  "libclang1-18",
  "libclang-common-18-dev",
  "lld-18",
  "clang",
  "lld",
  "llvm",
];

const TOOL_LINKS = [
  ["llvm-rc", ["usr/bin/llvm-rc-18", "usr/bin/llvm-rc", "usr/lib/llvm-18/bin/llvm-rc"]],
  ["clang", ["usr/bin/clang-18", "usr/lib/llvm-18/bin/clang"]],
  ["clang-cl", ["usr/bin/clang-cl-18", "usr/lib/llvm-18/bin/clang-cl", "usr/bin/clang-18"]],
  ["clang++", ["usr/bin/clang++-18", "usr/lib/llvm-18/bin/clang++"]],
  ["lld", ["usr/bin/lld-18", "usr/lib/llvm-18/bin/lld"]],
  ["lld-link", ["usr/bin/lld-link-18", "usr/lib/llvm-18/bin/lld-link"]],
  ["ld.lld", ["usr/bin/ld.lld-18", "usr/lib/llvm-18/bin/ld.lld"]],
];

export function tauriBuildArgs({ nativeWindows, signCommand }) {
  const args = ["build", "--target", WINDOWS_ARM64_TARGET, "--bundles", "nsis"];
  if (!nativeWindows) {
    args.push("--runner", "cargo-xwin");
  }
  if (signCommand) {
    args.push("--config", JSON.stringify({ bundle: { windows: { signCommand } } }));
  }
  return args;
}

export function defaultSignCommand() {
  return {
    cmd: process.execPath,
    args: [path.join(rootDir, "scripts/signWindowsPe.mjs"), "%1"],
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf8",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  }
  return result;
}

function commandExists(command, env = process.env) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    env,
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

function which(command, env = process.env) {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(finder, [command], {
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim().split(/\r?\n/)[0] || null;
}

function ensureRustTarget() {
  run("rustup", ["target", "add", WINDOWS_ARM64_TARGET]);
}

function ensureCargoXwin() {
  if (which("cargo-xwin")) {
    return;
  }
  console.log("Installing cargo-xwin (Windows MSVC sysroot downloader)…");
  run("cargo", ["install", "--locked", "cargo-xwin"]);
}

function ensureLinuxCrossTools() {
  mkdirSync(crossBin, { recursive: true });
  mkdirSync(crossPrefix, { recursive: true });
  mkdirSync(debsDir, { recursive: true });

  const makensis = path.join(crossPrefix, "usr/bin/makensis");
  const clang = path.join(crossPrefix, "usr/bin/clang-18");
  const llvmRc = path.join(crossPrefix, "usr/bin/llvm-rc-18");
  const needExtract = ![makensis, clang, llvmRc].every((file) => existsSync(file));

  if (needExtract) {
    console.log("Fetching NSIS / LLVM / clang packages for Windows cross-compilation…");
    run("apt-get", ["download", ...LINUX_PACKAGES], { cwd: debsDir });
    for (const name of readdirSync(debsDir).filter((file) => file.endsWith(".deb"))) {
      run("dpkg-deb", ["-x", path.join(debsDir, name), crossPrefix]);
    }
  }

  for (const [linkName, relatives] of TOOL_LINKS) {
    const target = relatives.map((relative) => path.join(crossPrefix, relative)).find(existsSync);
    if (!target) {
      continue;
    }
    const link = path.join(crossBin, linkName);
    rmSync(link, { force: true });
    symlinkSync(target, link);
    try {
      chmodSync(target, 0o755);
    } catch {
      // extracted files are already executable
    }
  }

  writeMakensisWrapper();
}

function writeMakensisWrapper() {
  const real = path.join(crossPrefix, "usr/bin/makensis");
  const nsisDir = path.join(crossPrefix, "usr/share/nsis");
  if (!existsSync(real) || !existsSync(nsisDir)) {
    return;
  }
  if (existsSync("/usr/share/nsis/Stubs")) {
    return;
  }
  const source = path.join(rootDir, "scripts/nsisPathPreload.c");
  const soPath = path.join(crossRoot, "nsis-path-preload.so");
  run("gcc", ["-shared", "-fPIC", "-o", soPath, source, "-ldl"]);
  const wrapper = path.join(crossBin, "makensis");
  rmSync(wrapper, { force: true });
  writeFileSync(
    wrapper,
    `#!/usr/bin/env bash
set -euo pipefail
export BP_NSIS_ROOT=${JSON.stringify(nsisDir)}
export LD_PRELOAD=${JSON.stringify(soPath)}\${LD_PRELOAD:+:\$LD_PRELOAD}
exec ${JSON.stringify(real)} "$@"
`,
    { mode: 0o755 },
  );
}

function linuxCrossEnv() {
  const libDirs = [
    path.join(crossPrefix, "usr/lib/x86_64-linux-gnu"),
    path.join(crossPrefix, "lib/x86_64-linux-gnu"),
    path.join(crossPrefix, "usr/lib/llvm-18/lib"),
    path.join(crossPrefix, "usr/lib"),
  ].filter((dir) => existsSync(dir));
  const nsisDir = path.join(crossPrefix, "usr/share/nsis");
  const extraPath = [
    crossBin,
    path.join(crossPrefix, "usr/lib/llvm-18/bin"),
    path.join(crossPrefix, "usr/bin"),
  ].join(path.delimiter);
  return {
    ...process.env,
    PATH: `${extraPath}${path.delimiter}${process.env.PATH ?? ""}`,
    LD_LIBRARY_PATH: [...libDirs, process.env.LD_LIBRARY_PATH ?? ""]
      .filter(Boolean)
      .join(path.delimiter),
    NSISDIR: existsSync(nsisDir) ? nsisDir : process.env.NSISDIR,
    NSIS_PATH: existsSync(nsisDir) ? nsisDir : process.env.NSIS_PATH,
    XWIN_CACHE_DIR: process.env.XWIN_CACHE_DIR ?? path.join(cacheRoot, "xwin"),
    XWIN_ARCH: process.env.XWIN_ARCH ?? "aarch64",
    // clang-cl passes /imsvc; ring's cc-rs invokes clang and treats that as a path.
    XWIN_CROSS_COMPILER: process.env.XWIN_CROSS_COMPILER ?? "clang",
  };
}

function windowsDownloadsDir() {
  if (process.env.USERPROFILE) {
    const dir = path.join(process.env.USERPROFILE, "Downloads");
    if (existsSync(dir)) {
      return dir;
    }
  }
  const users = "/mnt/c/Users";
  if (!existsSync(users)) {
    return null;
  }
  for (const name of readdirSync(users)) {
    if (["Public", "Default", "Default User", "All Users"].includes(name)) {
      continue;
    }
    const dir = path.join(users, name, "Downloads");
    if (existsSync(dir)) {
      return dir;
    }
  }
  return null;
}

function cargoTargetDir(env = process.env) {
  return env.CARGO_TARGET_DIR || path.join(rootDir, "src-tauri", "target");
}

function copyInstaller(env) {
  const bundleDir = path.join(
    cargoTargetDir(env),
    WINDOWS_ARM64_TARGET,
    "release",
    "bundle",
    "nsis",
  );
  if (!existsSync(bundleDir)) {
    console.log(`Installer directory not found: ${bundleDir}`);
    return;
  }
  const installers = readdirSync(bundleDir).filter((name) => name.endsWith("-setup.exe"));
  if (installers.length === 0) {
    console.log(`No NSIS installer in ${bundleDir}`);
    return;
  }
  const downloads = windowsDownloadsDir();
  for (const name of installers) {
    const from = path.join(bundleDir, name);
    console.log(`Windows ARM64 installer: ${from}`);
    if (!downloads) {
      continue;
    }
    const to = path.join(downloads, name);
    copyFileSync(from, to);
    console.log(`Copied to ${to}`);
  }
  writeInstallerTrustFiles(bundleDir);
  if (downloads) {
    writeInstallerTrustFiles(downloads);
    console.log(`Trust helper: ${path.join(downloads, "Install-BlueprintSync.cmd")}`);
  }
}

function prepare() {
  ensureRustTarget();
  if (process.platform === "win32") {
    return process.env;
  }
  ensureCargoXwin();
  if (!commandExists("makensis") || !which("clang-cl") || !which("llvm-rc")) {
    ensureLinuxCrossTools();
  }
  const env = linuxCrossEnv();
  for (const tool of ["makensis", "clang-cl", "llvm-rc", "cargo-xwin"]) {
    if (!which(tool, env) && !commandExists(tool, env)) {
      throw new Error(
        `${tool} が見つかりません。Ubuntu なら \`sudo apt install nsis lld llvm clang\` のあと再実行してください。`,
      );
    }
  }
  return env;
}

export async function buildWindowsArm64() {
  const nativeWindows = process.platform === "win32";
  const env = prepare();
  const args = tauriBuildArgs({ nativeWindows, signCommand: defaultSignCommand() });
  const tauriCli = path.join(rootDir, "scripts/tauri.mjs");

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tauriCli, ...args], {
      cwd: rootDir,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`tauri build terminated (${signal})`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`tauri build failed (${code})`));
        return;
      }
      resolve();
    });
  });

  copyInstaller(env);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  buildWindowsArm64().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
