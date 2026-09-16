import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * @param {Record<string, string | undefined>} env
 * @param {{
 *   isWindows: boolean,
 *   gnuLinkDirs?: string[],
 *   clangDir?: string | null,
 *   clangCl?: string | null,
 *   clang?: string | null,
 *   msvcLinkerDir?: string | null,
 *   msvcLib?: string | null,
 *   msvcInclude?: string | null,
 *   rustupToolchain?: string | null,
 *   pathDelimiter?: string,
 * }} options
 * @returns {Record<string, string | undefined>}
 */
export function applyWindowsMsvcEnv(env, options) {
  if (!options.isWindows) {
    return env;
  }

  const delimiter = options.pathDelimiter ?? ";";
  const gnuLinkDirs = new Set((options.gnuLinkDirs ?? []).map((dir) => normalizePath(dir)));
  const parts = (env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .filter((dir) => !gnuLinkDirs.has(normalizePath(dir)));

  const next = { ...env };
  const prefix = [];
  if (options.clangDir) {
    prefix.push(options.clangDir);
  }
  if (options.msvcLinkerDir) {
    prefix.push(options.msvcLinkerDir);
  }
  const prefixNorm = new Set(prefix.map((dir) => normalizePath(dir)));
  const rest = parts.filter((dir) => !prefixNorm.has(normalizePath(dir)));
  next.PATH = [...prefix, ...rest].join(delimiter);
  const clangCc = options.clangCl || options.clang;
  if (clangCc) {
    if (!env.CC) {
      next.CC = clangCc;
    }
    if (!env.CXX) {
      next.CXX = clangCc;
    }
    if (!env["CC_aarch64-pc-windows-msvc"]) {
      next["CC_aarch64-pc-windows-msvc"] = clangCc;
    }
    if (!env.CC_aarch64_pc_windows_msvc) {
      next.CC_aarch64_pc_windows_msvc = clangCc;
    }
  }
  if (options.msvcLib) {
    next.LIB = options.msvcLib;
  }
  if (options.msvcInclude) {
    next.INCLUDE = options.msvcInclude;
  }
  if (options.rustupToolchain) {
    next.RUSTUP_TOOLCHAIN = options.rustupToolchain;
  }
  return next;
}

/**
 * @param {{ isWindows: boolean, hasArm64MsvcLinker: boolean, hasX64MsvcLinker: boolean }} options
 * @returns {string | null}
 */
export function selectWindowsRustupToolchain({ isWindows, hasArm64MsvcLinker, hasX64MsvcLinker }) {
  if (!isWindows || hasArm64MsvcLinker) {
    return null;
  }
  if (hasX64MsvcLinker) {
    return "stable-x86_64-pc-windows-msvc";
  }
  return null;
}

/**
 * @param {string | undefined} command
 */
export function rustCommandsNeedWindowsMsvc(command) {
  return command === "dev" || command === "build";
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ existsSync?: typeof existsSync, readdirSync?: typeof readdirSync }} [io]
 */
export function discoverWindowsMsvcOptions(env = process.env, io = {}) {
  const exists = io.existsSync ?? existsSync;
  const readDir = io.readdirSync ?? readdirSync;
  const isWindows = process.platform === "win32";
  if (!isWindows) {
    return { isWindows: false };
  }

  const delimiter = path.delimiter;
  const toolchain = findMsvcToolchain(env, exists, readDir);
  const clang = findWindowsClangBin(env, exists);
  const gnuLinkDirs = (env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .filter((dir) => isGnuCoreutilsLinkDir(dir, exists));
  const hasArm64MsvcLinker = toolchain.arch === "arm64";
  const hasX64MsvcLinker = toolchain.arch === "x64" || hasArm64MsvcLinker;

  return {
    isWindows: true,
    gnuLinkDirs,
    clangDir: clang.clangDir,
    clangCl: clang.clangCl,
    clang: clang.clang,
    msvcLinkerDir: toolchain.linkerDir,
    msvcLib: toolchain.lib,
    msvcInclude: toolchain.include,
    rustupToolchain: selectWindowsRustupToolchain({
      isWindows: true,
      hasArm64MsvcLinker,
      hasX64MsvcLinker,
    }),
    hasArm64MsvcLinker,
    hasX64MsvcLinker,
    pathDelimiter: delimiter,
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {typeof existsSync} exists
 */
export function findWindowsClangBin(env, exists) {
  const programFiles = env["ProgramFiles"] ?? "C:\\Program Files";
  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const dirs = [
    path.join(programFiles, "LLVM", "bin"),
    path.join(programFilesX86, "LLVM", "bin"),
    path.join(programFilesX86, "Microsoft Visual Studio", "2022", "BuildTools", "VC", "Tools", "Llvm", "ARM64", "bin"),
    path.join(programFilesX86, "Microsoft Visual Studio", "2022", "BuildTools", "VC", "Tools", "Llvm", "bin"),
    path.join(programFiles, "Microsoft Visual Studio", "2022", "BuildTools", "VC", "Tools", "Llvm", "ARM64", "bin"),
    path.join(programFiles, "Microsoft Visual Studio", "2022", "BuildTools", "VC", "Tools", "Llvm", "bin"),
  ];
  for (const clangDir of dirs) {
    const clangCl = path.join(clangDir, "clang-cl.exe");
    const clang = path.join(clangDir, "clang.exe");
    const hasCl = exists(clangCl);
    const hasClang = exists(clang);
    if (hasCl || hasClang) {
      return {
        clangDir,
        clangCl: hasCl ? clangCl : null,
        clang: hasClang ? clang : null,
      };
    }
  }
  return { clangDir: null, clangCl: null, clang: null };
}

/**
 * @param {string} dir
 * @param {typeof existsSync} exists
 */
function isGnuCoreutilsLinkDir(dir, exists) {
  if (/Microsoft Visual Studio/i.test(dir)) {
    return false;
  }
  const linkPath = path.join(dir, "link.exe");
  if (!exists(linkPath)) {
    return false;
  }
  // Git for Windows / MSYS2 ship GNU coreutils as link.exe.
  return /[/\\](usr[/\\]bin|Git[/\\]usr[/\\]bin|msys64[/\\]usr[/\\]bin)[/\\]?$/i.test(dir);
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {typeof existsSync} exists
 * @param {typeof readdirSync} readDir
 */
function findMsvcToolchain(env, exists, readDir) {
  const programFiles = env["ProgramFiles"] ?? "C:\\Program Files";
  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const vsRoots = [
    path.join(programFilesX86, "Microsoft Visual Studio", "2022", "BuildTools"),
    path.join(programFiles, "Microsoft Visual Studio", "2022", "BuildTools"),
    path.join(programFilesX86, "Microsoft Visual Studio", "2022", "Community"),
    path.join(programFiles, "Microsoft Visual Studio", "2022", "Community"),
    path.join(programFilesX86, "Microsoft Visual Studio", "2022", "Professional"),
    path.join(programFiles, "Microsoft Visual Studio", "2022", "Professional"),
  ];

  const hosts = [
    ["arm64", "Hostarm64", "arm64"],
    ["x64", "Hostarm64", "x64"],
    ["x64", "Hostx64", "x64"],
  ];

  for (const vsRoot of vsRoots) {
    const msvcRoot = path.join(vsRoot, "VC", "Tools", "MSVC");
    if (!exists(msvcRoot)) {
      continue;
    }
    const versions = readDir(msvcRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const version of versions) {
      const versionRoot = path.join(msvcRoot, version);
      for (const [arch, host, target] of hosts) {
        const linkerDir = path.join(versionRoot, "bin", host, target);
        const linker = path.join(linkerDir, "link.exe");
        const libDir = path.join(versionRoot, "lib", target);
        if (!exists(linker) || !exists(libDir)) {
          continue;
        }
        const sdk = findWindowsSdk(env, exists, readDir, target);
        return {
          arch,
          linkerDir,
          lib: [libDir, ...sdk.lib].join(";"),
          include: [path.join(versionRoot, "include"), ...sdk.include].join(";"),
        };
      }
    }
  }

  return { arch: null, linkerDir: null, lib: null, include: null };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {typeof existsSync} exists
 * @param {typeof readdirSync} readDir
 * @param {string} target
 */
function findWindowsSdk(env, exists, readDir, target) {
  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const kits = path.join(programFilesX86, "Windows Kits", "10");
  const libRoot = path.join(kits, "Lib");
  const includeRoot = path.join(kits, "Include");
  if (!exists(libRoot) || !exists(includeRoot)) {
    return { lib: [], include: [] };
  }
  const versions = readDir(libRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const version of versions) {
    const um = path.join(libRoot, version, "um", target);
    const ucrt = path.join(libRoot, version, "ucrt", target);
    const include = path.join(includeRoot, version);
    if (exists(um) && exists(ucrt) && exists(include)) {
      return {
        lib: [um, ucrt],
        include: [
          path.join(include, "ucrt"),
          path.join(include, "um"),
          path.join(include, "shared"),
        ],
      };
    }
  }
  return { lib: [], include: [] };
}

/**
 * @param {string} dir
 */
function normalizePath(dir) {
  return dir.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}
