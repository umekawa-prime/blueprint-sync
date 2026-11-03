import { spawnSync } from "node:child_process";
import {
  accessSync,
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriConfig = JSON.parse(
  readFileSync(path.join(rootDir, "src-tauri/tauri.conf.json"), "utf8"),
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  }
}

function tryRun(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  return result.error || result.status !== 0 ? null : result.stdout.trim();
}

function runPowerShell(command) {
  return tryRun("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
}

// Removable drives plugged in after WSL starts are not auto-mounted under /mnt.
// Those are returned as Windows drive targets and written through powershell.exe.
function getWslUsbTargets() {
  const driveLetters = runPowerShell(
    "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' | ForEach-Object { $_.DeviceID }",
  );
  if (!driveLetters) {
    return [];
  }
  return driveLetters
    .split(/\r?\n/)
    .map((drive) => drive.trim().match(/^([A-Za-z]):$/))
    .filter(Boolean)
    .map(([, letter]) => {
      const mount = `/mnt/${letter.toLowerCase()}`;
      return isMountPoint(mount)
        ? { kind: "posix", dir: mount }
        : { kind: "windows", dir: `${letter.toUpperCase()}:\\` };
    });
}

function isMountPoint(candidate) {
  const target = tryRun("findmnt", ["--noheadings", "--raw", "--target", candidate, "--output", "TARGET"]);
  return target !== null && path.resolve(target) === path.resolve(candidate);
}

function getLinuxUsbMounts() {
  const user = process.env.USER;
  const roots = [
    user && path.join("/media", user),
    user && path.join("/run/media", user),
    "/mnt/chromeos/removable",
  ].filter(Boolean);
  const mounts = [];
  for (const root of roots) {
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      continue;
    }
    for (const name of readdirSync(root)) {
      const candidate = path.join(root, name);
      if (statSync(candidate).isDirectory() && isMountPoint(candidate)) {
        mounts.push(candidate);
      }
    }
  }
  return mounts;
}

function discoverUsbTarget() {
  if (process.env.LINUX_USB_MOUNT) {
    const mount = path.resolve(process.env.LINUX_USB_MOUNT);
    if (!existsSync(mount) || !statSync(mount).isDirectory()) {
      throw new Error(`LINUX_USB_MOUNT must point to an existing directory: ${mount}`);
    }
    return { kind: "posix", dir: mount };
  }

  const mounts = [
    ...getWslUsbTargets(),
    ...getLinuxUsbMounts().map((dir) => ({ kind: "posix", dir })),
  ].filter((target, index, all) => all.findIndex((other) => other.dir === target.dir) === index);
  if (mounts.length === 0) {
    throw new Error(
      "No mounted USB drive found. Connect and mount the USB drive, or set LINUX_USB_MOUNT to its mount path.",
    );
  }
  if (mounts.length > 1) {
    throw new Error(
      `More than one USB drive was found (${mounts.map((target) => target.dir).join(", ")}). Set LINUX_USB_MOUNT to choose one.`,
    );
  }
  return mounts[0];
}

function sha256(file) {
  const hash = createHash("sha256");
  hash.update(readFileSync(file));
  return hash.digest("hex");
}

if (process.platform !== "linux") {
  throw new Error("The Linux USB build must be run on Linux or WSL.");
}

const usbTarget = discoverUsbTarget();
if (usbTarget.kind === "posix") {
  accessSync(usbTarget.dir, 2);
}
run("npm", ["run", "tauri", "--", "build", "--bundles", "deb"]);

const artifact = path.join(
  rootDir,
  "src-tauri/target/release/bundle/deb",
  `${tauriConfig.productName}_${tauriConfig.version}_amd64.deb`,
);
if (!existsSync(artifact) || !statSync(artifact).isFile()) {
  throw new Error(`Linux package was not generated at ${artifact}`);
}

let destination;
let copiedHash;
if (usbTarget.kind === "posix") {
  destination = path.join(usbTarget.dir, path.basename(artifact));
  copyFileSync(artifact, destination);
  copiedHash = sha256(destination);
} else {
  const source = tryRun("wslpath", ["-w", artifact]);
  if (!source) {
    throw new Error(`Could not resolve a Windows path for ${artifact}`);
  }
  destination = `${usbTarget.dir}${path.basename(artifact)}`;
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  copiedHash = runPowerShell(
    `Copy-Item -LiteralPath ${quote(source)} -Destination ${quote(destination)} -Force; ` +
      `(Get-FileHash -Algorithm SHA256 -LiteralPath ${quote(destination)}).Hash`,
  );
  if (!copiedHash) {
    throw new Error(`Copying to ${destination} via powershell.exe failed`);
  }
}
if (sha256(artifact) !== copiedHash.toLowerCase()) {
  throw new Error(`Copied package verification failed: ${destination}`);
}
console.log(`Linux package copied and verified: ${destination}`);
