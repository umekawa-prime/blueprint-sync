import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

export const PUBLISHER = "Mitra Blueprint Sync";
const cacheRoot = path.join(os.homedir(), ".cache", "blueprint-sync");
const certDir = path.join(cacheRoot, "codesign");
const crossRoot = path.join(cacheRoot, "win-cross");
const crossPrefix = path.join(crossRoot, "root");
const debsDir = path.join(crossRoot, "debs");

export function codeSignPaths() {
  return {
    certDir,
    pfx: path.join(certDir, "codesign.pfx"),
    cer: path.join(certDir, "codesign.cer"),
    passFile: path.join(certDir, "pfx.pass"),
    key: path.join(certDir, "codesign.key"),
    pem: path.join(certDir, "codesign.pem"),
  };
}

function runQuiet(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

function run(command, args, options = {}) {
  const result = runQuiet(command, args, options);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  }
  return result;
}

function extractDeb(name) {
  mkdirSync(debsDir, { recursive: true });
  mkdirSync(crossPrefix, { recursive: true });
  const already = readdirSync(debsDir).some((file) => file.startsWith(`${name}_`) && file.endsWith(".deb"));
  if (!already) {
    run("apt-get", ["download", name], { cwd: debsDir });
  }
  for (const file of readdirSync(debsDir).filter((item) => item.startsWith(`${name}_`) && item.endsWith(".deb"))) {
    run("dpkg-deb", ["-x", path.join(debsDir, file), crossPrefix]);
  }
}

/**
 * @param {{
 *   platform?: NodeJS.Platform,
 *   arch?: string,
 *   env?: NodeJS.ProcessEnv,
 *   existsSync?: typeof existsSync,
 *   readdirSync?: typeof readdirSync,
 * }} [options]
 * @returns {string | null}
 */
export function findWindowsSignTool(options = {}) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const env = options.env ?? process.env;
  const exists = options.existsSync ?? existsSync;
  const readDir = options.readdirSync ?? readdirSync;
  if (platform !== "win32") {
    return null;
  }

  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const binRoot = path.join(programFilesX86, "Windows Kits", "10", "bin");
  if (!exists(binRoot)) {
    return null;
  }

  const versions = readDir(binRoot)
    .map((entry) => (typeof entry === "string" ? entry : entry.name))
    .filter((name) => /^\d+\./.test(name))
    .sort()
    .reverse();
  const hosts = arch === "arm64" ? ["arm64", "x64", "x86"] : ["x64", "x86"];
  for (const version of versions) {
    for (const host of hosts) {
      const exe = path.join(binRoot, version, host, "signtool.exe");
      if (exists(exe)) {
        return exe;
      }
    }
  }
  return null;
}

export function ensureOsslSigncode() {
  const bin = path.join(crossPrefix, "usr/bin/osslsigncode");
  if (!existsSync(bin)) {
    console.log("Fetching osslsigncode for Authenticode signing…");
    extractDeb("osslsigncode");
  }
  if (!existsSync(bin)) {
    throw new Error("osslsigncode を用意できませんでした。");
  }
  return bin;
}

export function ensureCodeSignCert() {
  const paths = codeSignPaths();
  mkdirSync(paths.certDir, { recursive: true });
  if (existsSync(paths.pfx) && existsSync(paths.cer) && existsSync(paths.passFile)) {
    return paths;
  }

  const password = `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  writeFileSync(paths.passFile, password, { mode: 0o600 });
  console.log("Creating a local Authenticode certificate for development signing…");
  run("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:4096",
    "-sha256",
    "-days",
    "3650",
    "-nodes",
    "-keyout",
    paths.key,
    "-out",
    paths.pem,
    "-subj",
    `/CN=${PUBLISHER}/O=Mitra`,
    "-addext",
    "extendedKeyUsage=codeSigning",
    "-addext",
    "keyUsage=digitalSignature,keyCertSign",
    "-addext",
    "basicConstraints=critical,CA:true",
  ]);
  run("openssl", ["x509", "-in", paths.pem, "-outform", "DER", "-out", paths.cer]);
  run("openssl", [
    "pkcs12",
    "-export",
    "-inkey",
    paths.key,
    "-in",
    paths.pem,
    "-out",
    paths.pfx,
    "-passout",
    `pass:${password}`,
    "-name",
    PUBLISHER,
  ]);
  return paths;
}

function signWithSignTool(signtool, abs, pfx, password) {
  const common = ["sign", "/fd", "SHA256", "/f", pfx, "/p", password, "/d", PUBLISHER];
  let result = runQuiet(signtool, [
    ...common,
    "/tr",
    "http://timestamp.digicert.com",
    "/td",
    "SHA256",
    abs,
  ]);
  if (result.status !== 0) {
    result = runQuiet(signtool, [...common, abs]);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`signtool failed for ${abs}`);
  }
}

function signWithOsslSigncode(osslsigncode, abs, pfx, password) {
  const signed = `${abs}.signed`;
  const common = [
    "sign",
    "-pkcs12",
    pfx,
    "-pass",
    password,
    "-n",
    PUBLISHER,
    "-h",
    "sha256",
    "-in",
    abs,
    "-out",
    signed,
  ];
  let result = runQuiet(osslsigncode, [...common, "-t", "http://timestamp.digicert.com"]);
  if (result.status !== 0) {
    result = runQuiet(osslsigncode, common);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`osslsigncode failed for ${abs}`);
  }
  copyFileSync(signed, abs);
  unlinkSync(signed);
}

export function signPeFile(filePath) {
  const abs = path.resolve(filePath);
  if (!existsSync(abs)) {
    throw new Error(`sign target missing: ${abs}`);
  }
  const paths = ensureCodeSignCert();
  const password = readFileSync(paths.passFile, "utf8").trim();
  const signtool = findWindowsSignTool();
  if (signtool) {
    signWithSignTool(signtool, abs, paths.pfx, password);
    return;
  }
  signWithOsslSigncode(ensureOsslSigncode(), abs, paths.pfx, password);
}

export function writeInstallerTrustFiles(destDir) {
  const paths = ensureCodeSignCert();
  const cerName = "BlueprintSync-CodeSigning.cer";
  copyFileSync(paths.cer, path.join(destDir, cerName));
  writeFileSync(
    path.join(destDir, "Install-BlueprintSync.cmd"),
    `@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo Importing the Blueprint Sync development certificate...
certutil -user -addstore -f Root "${cerName}"
certutil -user -addstore -f TrustedPublisher "${cerName}"
powershell -NoProfile -Command "Get-ChildItem -LiteralPath '%cd%' -Filter '*.exe' | Unblock-File"
for %%F in (*-setup.exe) do (
  start "" "%%F"
  goto :done
)
:done
`,
    { encoding: "utf8" },
  );
}
