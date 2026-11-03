import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultSignCommand,
  defaultXwinArch,
  tauriBuildArgs,
  WINDOWS_ARM64_TARGET,
  WINDOWS_BUILD_TARGETS,
  WINDOWS_X64_TARGET,
} from "../../../scripts/windowsArm64Build.mjs";

describe("package scripts", () => {
  it("syncs SvelteKit before Vite so tsconfig can extend .svelte-kit/tsconfig.json", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));

    expect(pkg.scripts.prepare).toBe("svelte-kit sync");
    expect(pkg.scripts.dev).toBe("svelte-kit sync && vite dev");
    expect(pkg.scripts["build:web"]).toBe("svelte-kit sync && vite build");
  });
});

describe("Windows ARM64 build", () => {
  it("keeps the Vite frontend build out of npm run build so Tauri cannot recurse", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
    const conf = JSON.parse(readFileSync(path.resolve("src-tauri/tauri.conf.json"), "utf8"));

    expect(pkg.scripts["build:web"]).toBe("svelte-kit sync && vite build");
    expect(conf.build.beforeBuildCommand).toBe("npm run build:web");
    expect(pkg.scripts.build).toBe("node scripts/windowsArm64Build.mjs");
    expect(conf.bundle.windows.signCommand).toEqual({
      cmd: "node",
      args: ["scripts/signWindowsPe.mjs", "%1"],
    });
    expect(defaultSignCommand().cmd).toContain("node");
    expect(defaultSignCommand().args).toEqual([
      expect.stringContaining("signWindowsPe.mjs"),
      "%1",
    ]);
  });

  it("asks Tauri for x64 and ARM64 NSIS installers", () => {
    expect(WINDOWS_X64_TARGET).toBe("x86_64-pc-windows-msvc");
    expect(WINDOWS_ARM64_TARGET).toBe("aarch64-pc-windows-msvc");
    expect(WINDOWS_BUILD_TARGETS).toEqual([
      "x86_64-pc-windows-msvc",
      "aarch64-pc-windows-msvc",
    ]);
    expect(defaultXwinArch()).toBe("x86_64,aarch64");
    expect(tauriBuildArgs({ target: WINDOWS_X64_TARGET, nativeWindows: true })).toEqual([
      "build",
      "--target",
      "x86_64-pc-windows-msvc",
      "--bundles",
      "nsis",
    ]);
    expect(tauriBuildArgs({ target: WINDOWS_ARM64_TARGET, nativeWindows: false })).toEqual([
      "build",
      "--target",
      "aarch64-pc-windows-msvc",
      "--bundles",
      "nsis",
      "--runner",
      "cargo-xwin",
    ]);
  });
});
