import path from "node:path";
import { describe, expect, it } from "vitest";
import { findWindowsSignTool } from "../../../scripts/windowsCodeSign.mjs";

describe("findWindowsSignTool", () => {
  it("returns null outside Windows", () => {
    expect(findWindowsSignTool({ platform: "linux" })).toBeNull();
  });

  it("prefers ARM64 signtool on ARM64 Windows", () => {
    const binRoot = path.join("C:\\Kits", "Windows Kits", "10", "bin");
    const arm64 = path.join(binRoot, "10.0.26100.0", "arm64", "signtool.exe");
    const x64 = path.join(binRoot, "10.0.26100.0", "x64", "signtool.exe");
    const found = findWindowsSignTool({
      platform: "win32",
      arch: "arm64",
      env: { "ProgramFiles(x86)": "C:\\Kits" },
      existsSync: (candidate) =>
        candidate === binRoot || candidate === arm64 || candidate === x64,
      readdirSync: (dir) => (dir === binRoot ? ["10.0.26100.0"] : []),
    });
    expect(found).toBe(arm64);
  });
});
