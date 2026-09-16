import { describe, expect, it } from "vitest";
import {
  applyWindowsMsvcEnv,
  findWindowsClangBin,
  rustCommandsNeedWindowsMsvc,
  selectWindowsRustupToolchain,
} from "../../../scripts/windowsMsvcEnv.mjs";

describe("applyWindowsMsvcEnv", () => {
  it("leaves non-Windows environments unchanged", () => {
    const env = { PATH: "/usr/bin:/bin" };
    expect(applyWindowsMsvcEnv(env, { isWindows: false })).toEqual({ PATH: "/usr/bin:/bin" });
  });

  it("drops Git/MSYS bins whose link.exe is GNU coreutils so rustc can see MSVC", () => {
    const env = applyWindowsMsvcEnv(
      { PATH: "C:\\Program Files\\Git\\usr\\bin;C:\\Windows\\system32;C:\\Users\\baseb\\.cargo\\bin" },
      {
        isWindows: true,
        gnuLinkDirs: ["C:\\Program Files\\Git\\usr\\bin"],
        pathDelimiter: ";",
      },
    );

    expect(env.PATH?.split(";")).toEqual([
      "C:\\Windows\\system32",
      "C:\\Users\\baseb\\.cargo\\bin",
    ]);
  });

  it("puts the MSVC linker directory first and sets LIB/INCLUDE", () => {
    const env = applyWindowsMsvcEnv(
      { PATH: "C:\\Windows\\system32" },
      {
        isWindows: true,
        gnuLinkDirs: [],
        msvcLinkerDir: "C:\\VS\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostarm64\\x64",
        msvcLib: "C:\\VS\\lib\\x64;C:\\Kits\\um\\x64",
        msvcInclude: "C:\\VS\\include;C:\\Kits\\ucrt",
        rustupToolchain: "stable-x86_64-pc-windows-msvc",
        pathDelimiter: ";",
      },
    );

    expect(env.PATH?.split(";")[0]).toBe(
      "C:\\VS\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostarm64\\x64",
    );
    expect(env.LIB).toBe("C:\\VS\\lib\\x64;C:\\Kits\\um\\x64");
    expect(env.INCLUDE).toBe("C:\\VS\\include;C:\\Kits\\ucrt");
    expect(env.RUSTUP_TOOLCHAIN).toBe("stable-x86_64-pc-windows-msvc");
  });

  it("puts LLVM clang on PATH and sets CC so ring can compile on ARM64 Windows", () => {
    const env = applyWindowsMsvcEnv(
      { PATH: "C:\\Windows\\system32" },
      {
        isWindows: true,
        gnuLinkDirs: [],
        clangDir: "C:\\Program Files\\LLVM\\bin",
        clangCl: "C:\\Program Files\\LLVM\\bin\\clang-cl.exe",
        msvcLinkerDir: "C:\\VS\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostarm64\\arm64",
        pathDelimiter: ";",
      },
    );

    expect(env.PATH?.split(";").slice(0, 2)).toEqual([
      "C:\\Program Files\\LLVM\\bin",
      "C:\\VS\\VC\\Tools\\MSVC\\14.44.35207\\bin\\Hostarm64\\arm64",
    ]);
    expect(env.CC).toBe("C:\\Program Files\\LLVM\\bin\\clang-cl.exe");
    expect(env.CXX).toBe("C:\\Program Files\\LLVM\\bin\\clang-cl.exe");
    expect(env["CC_aarch64-pc-windows-msvc"]).toBe("C:\\Program Files\\LLVM\\bin\\clang-cl.exe");
    expect(env.CC_aarch64_pc_windows_msvc).toBe("C:\\Program Files\\LLVM\\bin\\clang-cl.exe");
  });

  it("does not override a CC the user already set", () => {
    const env = applyWindowsMsvcEnv(
      { PATH: "C:\\Windows\\system32", CC: "C:\\custom\\clang.exe" },
      {
        isWindows: true,
        gnuLinkDirs: [],
        clangDir: "C:\\Program Files\\LLVM\\bin",
        clangCl: "C:\\Program Files\\LLVM\\bin\\clang-cl.exe",
        pathDelimiter: ";",
      },
    );

    expect(env.CC).toBe("C:\\custom\\clang.exe");
    expect(env.PATH?.split(";")[0]).toBe("C:\\Program Files\\LLVM\\bin");
  });
});

describe("findWindowsClangBin", () => {
  it("prefers standalone LLVM clang-cl when it exists", () => {
    const exists = (candidate) =>
      candidate === "C:\\Program Files\\LLVM\\bin\\clang-cl.exe" ||
      candidate === "C:\\Program Files\\LLVM\\bin\\clang.exe";

    expect(
      findWindowsClangBin(
        { ProgramFiles: "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)" },
        exists,
      ),
    ).toEqual({
      clangDir: "C:\\Program Files\\LLVM\\bin",
      clangCl: "C:\\Program Files\\LLVM\\bin\\clang-cl.exe",
      clang: "C:\\Program Files\\LLVM\\bin\\clang.exe",
    });
  });

  it("returns empty when neither clang nor clang-cl is installed", () => {
    expect(findWindowsClangBin({ ProgramFiles: "C:\\Program Files" }, () => false)).toEqual({
      clangDir: null,
      clangCl: null,
      clang: null,
    });
  });
});

describe("selectWindowsRustupToolchain", () => {
  it("keeps the host ARM64 toolchain when the ARM64 MSVC linker exists", () => {
    expect(
      selectWindowsRustupToolchain({
        isWindows: true,
        hasArm64MsvcLinker: true,
        hasX64MsvcLinker: true,
      }),
    ).toBeNull();
  });

  it("falls back to the x64 rustup toolchain so build scripts can link", () => {
    expect(
      selectWindowsRustupToolchain({
        isWindows: true,
        hasArm64MsvcLinker: false,
        hasX64MsvcLinker: true,
      }),
    ).toBe("stable-x86_64-pc-windows-msvc");
  });

  it("does not force a toolchain off Windows", () => {
    expect(
      selectWindowsRustupToolchain({
        isWindows: false,
        hasArm64MsvcLinker: false,
        hasX64MsvcLinker: false,
      }),
    ).toBeNull();
  });
});

describe("rustCommandsNeedWindowsMsvc", () => {
  it("injects a cargo target only for commands that compile the Windows desktop binary", () => {
    expect(rustCommandsNeedWindowsMsvc("dev")).toBe(true);
    expect(rustCommandsNeedWindowsMsvc("build")).toBe(true);
    expect(rustCommandsNeedWindowsMsvc("android")).toBe(false);
    expect(rustCommandsNeedWindowsMsvc("icon")).toBe(false);
  });
});
