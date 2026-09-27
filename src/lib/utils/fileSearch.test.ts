import { describe, expect, it } from "vitest";
import { fileSearchOpenPlan, filterProjectFileNames } from "./fileSearch";

const files = [
  ".blueprint-sync/project.json",
  ".blueprint-sync/annotations/図面__平面.pdf.json",
  "図面/2397_調剤室.pdf",
  "図面/電気設備設計図_一式.pdf",
  "平面図/03_A-003_平面図.pdf",
  "JWW/E05_電灯設備平面図.jww",
  "図面JWW/天井伏図.dxf",
  "ルール書/納品予定表.pdf",
  "TODO.md",
];

describe("filterProjectFileNames", () => {
  it("lists filenames in the project folder and skips internal sync files", () => {
    expect(filterProjectFileNames(files, "")).toEqual([
      "JWW/E05_電灯設備平面図.jww",
      "TODO.md",
      "ルール書/納品予定表.pdf",
      "図面/2397_調剤室.pdf",
      "図面/電気設備設計図_一式.pdf",
      "図面JWW/天井伏図.dxf",
      "平面図/03_A-003_平面図.pdf",
    ]);
  });

  it("matches a partial filename without case sensitivity", () => {
    expect(filterProjectFileNames(files, "zzzz")).toEqual([]);
    expect(filterProjectFileNames(files, "調剤")).toEqual(["図面/2397_調剤室.pdf"]);
    expect(filterProjectFileNames(files, "todo")).toEqual(["TODO.md"]);
  });

  it("matches every whitespace-separated token against the filename or folder", () => {
    expect(filterProjectFileNames(files, "平面 電灯")).toEqual(["JWW/E05_電灯設備平面図.jww"]);
    expect(filterProjectFileNames(files, "平面図")).toEqual([
      "JWW/E05_電灯設備平面図.jww",
      "平面図/03_A-003_平面図.pdf",
    ]);
  });
});

describe("fileSearchOpenPlan", () => {
  it("opens drawings the app already knows inside the viewer", () => {
    expect(fileSearchOpenPlan("図面/2397_調剤室.pdf")).toEqual({
      kind: "project",
      relPath: "図面/2397_調剤室.pdf",
    });
    expect(fileSearchOpenPlan("図面JWW/天井伏図.dxf")).toEqual({
      kind: "project",
      relPath: "図面JWW/天井伏図.dxf",
    });
  });

  it("opens other CAD files in Jw_cad and everything else with the OS", () => {
    expect(fileSearchOpenPlan("JWW/E05_電灯設備平面図.jww")).toEqual({
      kind: "cad",
      relPath: "JWW/E05_電灯設備平面図.jww",
    });
    expect(fileSearchOpenPlan("平面図/03_A-003_平面図.pdf")).toEqual({
      kind: "external",
      relPath: "平面図/03_A-003_平面図.pdf",
    });
  });

  it("rejects paths that leave the project folder", () => {
    expect(fileSearchOpenPlan("../secret.pdf")).toBeNull();
    expect(fileSearchOpenPlan(".blueprint-sync/project.json")).toBeNull();
  });
});
