import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Japanese UI font", () => {
  it("bundles Noto Sans JP so CJK text renders without system fonts", () => {
    const layout = readFileSync(path.resolve("src/routes/+layout.svelte"), "utf8");
    const css = readFileSync(path.resolve("src/app.css"), "utf8");

    expect(layout).toContain("@fontsource-variable/noto-sans-jp");
    expect(css).toContain("Noto Sans JP Variable");
  });
});
