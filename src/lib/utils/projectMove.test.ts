import { describe, expect, it } from "vitest";
import { shouldDeleteSourceAfterCopy } from "./projectMove";

describe("shouldDeleteSourceAfterCopy", () => {
  it("deletes the original only when the copy landed in a different path", () => {
    expect(
      shouldDeleteSourceAfterCopy("/downloads/工程.pdf", "/projects/a/工程表/工程.pdf"),
    ).toBe(true);
    expect(
      shouldDeleteSourceAfterCopy("C:\\dl\\A.pdf", "C:\\projects\\a\\図面\\A.pdf"),
    ).toBe(true);
  });

  it("does not delete when the source is already the project file", () => {
    expect(
      shouldDeleteSourceAfterCopy("/projects/a/図面/A.pdf", "/projects/a/図面/A.pdf"),
    ).toBe(false);
    expect(
      shouldDeleteSourceAfterCopy("C:\\proj\\A.pdf", "C:/proj/A.pdf"),
    ).toBe(false);
  });
});
