import { describe, expect, it } from "vitest";
import {
  annotationFileName,
  createProjectMeta,
  displayLinkTitle,
  dropRecent,
  isAllowedLinkUrl,
  listPdfFileNames,
  parseProjectJson,
  rememberRecent,
  serializeProjectJson,
} from "./projectFormat";

describe("isAllowedLinkUrl", () => {
  it("allows http and https only", () => {
    expect(isAllowedLinkUrl("https://1drv.ms/f/s!abc")).toBe(true);
    expect(isAllowedLinkUrl("http://example.com/x")).toBe(true);
    expect(isAllowedLinkUrl("file:///C:/tmp")).toBe(false);
    expect(isAllowedLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedLinkUrl("not a url")).toBe(false);
  });
});

describe("project.json", () => {
  it("round-trips a valid document", () => {
    const meta = createProjectMeta("現場A", new Date("2026-08-30T08:00:00.000Z"));
    meta.links.push({
      id: "link-1",
      title: "共有フォルダ",
      url: "https://1drv.ms/f/s!abc",
    });
    expect(parseProjectJson(serializeProjectJson(meta))).toEqual(meta);
  });

  it("rejects missing fields", () => {
    expect(() => parseProjectJson("{}")).toThrow(/invalid project/i);
    expect(() =>
      parseProjectJson(JSON.stringify({ id: "x", name: "n", createdAt: "t", links: "nope" })),
    ).toThrow(/invalid project/i);
  });
});

describe("annotationFileName", () => {
  it("appends .json to a pdf basename", () => {
    expect(annotationFileName("1F平面図.pdf")).toBe("1F平面図.pdf.json");
  });

  it("rejects path separators and parent segments", () => {
    expect(() => annotationFileName("../x.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName("a/b.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName("a\\b.pdf")).toThrow(/invalid/i);
  });
});

describe("listPdfFileNames", () => {
  it("keeps only pdf files and excludes dot entries", () => {
    expect(
      listPdfFileNames([".blueprint-sync", "a.pdf", "notes.txt", "B.PDF", ".hidden.pdf"]),
    ).toEqual(["a.pdf", "B.PDF"]);
  });
});

describe("rememberRecent", () => {
  it("moves an existing path to the front and caps at 8", () => {
    const current = Array.from({ length: 8 }, (_, i) => ({
      name: `p${i}`,
      path: `/p${i}`,
    }));
    const next = rememberRecent(current, { name: "p3", path: "/p3" }, 8);
    expect(next).toHaveLength(8);
    expect(next[0]).toEqual({ name: "p3", path: "/p3" });
    expect(next.filter((item) => item.path === "/p3")).toHaveLength(1);
  });

  it("drops a missing path", () => {
    expect(dropRecent([{ name: "a", path: "/a" }], "/a")).toEqual([]);
  });
});

describe("displayLinkTitle", () => {
  it("falls back to the url", () => {
    expect(displayLinkTitle({ id: "1", title: "", url: "https://1drv.ms/x" })).toBe(
      "https://1drv.ms/x",
    );
  });
});
