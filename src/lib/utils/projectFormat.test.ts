import { describe, expect, it } from "vitest";
import {
  annotationFileName,
  createProjectMeta,
  displayLinkTitle,
  dropRecent,
  folderDisplayName,
  isAllowedLinkUrl,
  isProjectPdfBasename,
  isProjectPdfRelPath,
  joinProjectPdfRelPath,
  listPdfFileNames,
  listPdfsOfKind,
  parseProjectJson,
  parseProjectWorkflowStatus,
  PROJECT_PDF_DIRS,
  PROJECT_WORKFLOW_STATUSES,
  projectPdfKind,
  projectWorkflowLabel,
  rememberRecent,
  renamedProjectRelPath,
  serializeProjectJson,
  splitProjectsByWorkflow,
  isProjectCadRelPath,
  listCadFiles,
  listSidebarCadFiles,
  pairedDrawingPdfRelPath,
  projectRenameStem,
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

  it("skips disallowed link urls and keeps valid links", () => {
    const parsed = parseProjectJson(
      JSON.stringify({
        id: "x",
        name: "n",
        createdAt: "t",
        links: [
          { id: "1", title: "ok", url: "https://1drv.ms/f/s!abc" },
          { id: "2", title: "bad-js", url: "javascript:alert(1)" },
          { id: "3", title: "bad-file", url: "file:///C:/tmp/x.pdf" },
        ],
      }),
    );

    expect(parsed).toEqual({
      id: "x",
      name: "n",
      createdAt: "t",
      status: "open",
      links: [{ id: "1", title: "ok", url: "https://1drv.ms/f/s!abc" }],
    });
  });

  it("defaults missing workflow status to 未着手 and keeps a valid status", () => {
    const withoutStatus = parseProjectJson(
      JSON.stringify({
        id: "x",
        name: "n",
        createdAt: "t",
        links: [],
      }),
    );
    expect(withoutStatus.status).toBe("open");
    expect(createProjectMeta("現場A", new Date("2026-08-30T08:00:00.000Z")).status).toBe("open");

    const withStatus = parseProjectJson(
      JSON.stringify({
        id: "x",
        name: "n",
        createdAt: "t",
        status: "reviewing",
        links: [],
      }),
    );
    expect(withStatus.status).toBe("reviewing");
    expect(parseProjectJson(serializeProjectJson(withStatus)).status).toBe("reviewing");
  });
});

describe("project workflow status", () => {
  it("labels Backlog-like project states in Japanese", () => {
    expect(PROJECT_WORKFLOW_STATUSES.map(projectWorkflowLabel)).toEqual([
      "未着手",
      "詳細確認中",
      "発注待ち",
      "対応中",
      "完了",
    ]);
    expect(parseProjectWorkflowStatus("closed")).toBe("closed");
    expect(parseProjectWorkflowStatus("waiting_order")).toBe("waiting_order");
    expect(parseProjectWorkflowStatus("unknown")).toBe("open");
  });

  it("moves completed projects into a separate list", () => {
    expect(
      splitProjectsByWorkflow([
        { path: "/a", name: "a", status: "open" },
        { path: "/b", name: "b", status: "closed" },
        { path: "/c", name: "c", status: "in_progress" },
        { path: "/d", name: "d" },
      ]),
    ).toEqual({
      active: [
        { path: "/a", name: "a", status: "open" },
        { path: "/c", name: "c", status: "in_progress" },
        { path: "/d", name: "d" },
      ],
      completed: [{ path: "/b", name: "b", status: "closed" }],
    });
  });
});

describe("folderDisplayName", () => {
  it("uses the last path segment on unix and windows paths", () => {
    expect(folderDisplayName("/projects/現場A")).toBe("現場A");
    expect(folderDisplayName("C:\\data\\現場A")).toBe("現場A");
    expect(folderDisplayName("C:/Users/me/現場A")).toBe("現場A");
    expect(folderDisplayName("\\\\?\\C:\\Users\\me\\現場A")).toBe("現場A");
  });

  it("ignores a trailing separator", () => {
    expect(folderDisplayName("/projects/現場A/")).toBe("現場A");
    expect(folderDisplayName("C:\\data\\現場A\\")).toBe("現場A");
  });

  it("falls back when the path is empty", () => {
    expect(folderDisplayName("")).toBe("無題プロジェクト");
    expect(folderDisplayName("/")).toBe("無題プロジェクト");
  });
});

describe("annotationFileName", () => {
  it("appends .json to a pdf basename", () => {
    expect(annotationFileName("1F平面図.pdf")).toBe("1F平面図.pdf.json");
  });

  it("accepts kind-prefixed annotation names and still rejects other nested paths", () => {
    expect(annotationFileName("図面/1F.pdf")).toBe("図面__1F.pdf.json");
    expect(annotationFileName("工程表/週間工程.pdf")).toBe("工程表__週間工程.pdf.json");
    expect(annotationFileName("図面JWW/1F.pdf")).toBe("図面JWW__1F.pdf.json");
    expect(annotationFileName("図面JWW/1F.jww")).toBe("図面JWW__1F.jww.json");
    expect(() => annotationFileName("nested/A.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName(".hidden.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName("../x.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName("a\\b.pdf")).toThrow(/invalid/i);
  });
});

describe("isProjectPdfBasename", () => {
  it("accepts only folder-root pdf basenames", () => {
    expect(isProjectPdfBasename("A.pdf")).toBe(true);
    expect(isProjectPdfBasename(".hidden.pdf")).toBe(false);
    expect(isProjectPdfBasename("nested/A.pdf")).toBe(false);
    expect(isProjectPdfBasename("A.txt")).toBe(false);
  });
});

describe("project pdf kinds", () => {
  it("treats root and 図面 paths as drawings, 工程表 as schedules, 図面JWW as cad", () => {
    expect(projectPdfKind("A.pdf")).toBe("drawing");
    expect(projectPdfKind("図面/1F.pdf")).toBe("drawing");
    expect(projectPdfKind("工程表/週間工程.pdf")).toBe("schedule");
    expect(projectPdfKind("図面JWW/1F.pdf")).toBe("cad");
    expect(joinProjectPdfRelPath("drawing", "1F.pdf")).toBe("図面/1F.pdf");
    expect(joinProjectPdfRelPath("schedule", "週間工程.pdf")).toBe("工程表/週間工程.pdf");
    expect(joinProjectPdfRelPath("cad", "1F.pdf")).toBe("図面JWW/1F.pdf");
    expect(PROJECT_PDF_DIRS.drawing).toBe("図面");
    expect(PROJECT_PDF_DIRS.schedule).toBe("工程表");
    expect(PROJECT_PDF_DIRS.cad).toBe("図面JWW");
  });

  it("accepts legacy root pdfs and kind subfolder pdfs", () => {
    expect(isProjectPdfRelPath("A.pdf")).toBe(true);
    expect(isProjectPdfRelPath("図面/A.pdf")).toBe(true);
    expect(isProjectPdfRelPath("工程表/A.pdf")).toBe(true);
    expect(isProjectPdfRelPath("図面JWW/A.pdf")).toBe(true);
    expect(isProjectPdfRelPath("other/A.pdf")).toBe(false);
    expect(isProjectPdfRelPath("図面/../A.pdf")).toBe(false);
    expect(isProjectPdfRelPath(".hidden.pdf")).toBe(false);
  });

  it("splits a mixed list into drawings, cad, and schedules", () => {
    expect(
      listPdfsOfKind(["A.pdf", "図面/B.pdf", "図面JWW/J.pdf", "工程表/C.pdf", "工程表/D.pdf"], "drawing"),
    ).toEqual(["A.pdf", "図面/B.pdf"]);
    expect(listPdfsOfKind(["A.pdf", "図面/B.pdf", "図面JWW/J.pdf", "工程表/C.pdf"], "schedule")).toEqual([
      "工程表/C.pdf",
    ]);
    expect(listPdfsOfKind(["A.pdf", "図面/B.pdf", "図面JWW/J.pdf", "工程表/C.pdf"], "cad")).toEqual([
      "図面JWW/J.pdf",
    ]);
  });

  it("treats jww/jwc under 図面JWW as cad source files, not pdfs", () => {
    expect(isProjectCadRelPath("図面JWW/1F.jww")).toBe(true);
    expect(isProjectCadRelPath("図面JWW/旧図.JWC")).toBe(true);
    expect(isProjectCadRelPath("図面JWW/1F.pdf")).toBe(false);
    expect(isProjectCadRelPath("図面/1F.jww")).toBe(false);
    expect(isProjectPdfRelPath("図面JWW/1F.jww")).toBe(false);
    expect(listCadFiles(["図面/A.pdf", "図面JWW/1F.jww", "図面JWW/1F.pdf", "図面JWW/旧図.jwc"])).toEqual([
      "図面JWW/1F.jww",
      "図面JWW/旧図.jwc",
    ]);
    expect(
      listSidebarCadFiles(["図面/A.pdf", "図面JWW/1F.jww", "図面JWW/1F.pdf", "工程表/C.pdf"]),
    ).toEqual(["図面JWW/1F.jww", "図面JWW/1F.pdf"]);
    expect(pairedDrawingPdfRelPath("図面JWW/1F.jww")).toBe("図面/1F.pdf");
    expect(pairedDrawingPdfRelPath("図面JWW/旧図.JWC")).toBe("図面/旧図.pdf");
    expect(pairedDrawingPdfRelPath("図面/1F.pdf")).toBeNull();
    expect(projectRenameStem("図面JWW/1F.jww")).toBe("1F");
    expect(projectRenameStem("工程表/週間工程.pdf")).toBe("週間工程");
  });
});

describe("renamedProjectRelPath", () => {
  it("keeps the folder and original extension while changing the stem", () => {
    expect(renamedProjectRelPath("図面/1F.pdf", "2F")).toBe("図面/2F.pdf");
    expect(renamedProjectRelPath("図面JWW/1F.jww", "平面図")).toBe("図面JWW/平面図.jww");
    expect(renamedProjectRelPath("図面JWW/旧図.jwc", "旧図.jwc")).toBe("図面JWW/旧図.jwc");
    expect(renamedProjectRelPath("工程表/週間工程.pdf", "月間工程.pdf")).toBe("工程表/月間工程.pdf");
  });

  it("rejects empty, nested, or extension-changing names", () => {
    expect(renamedProjectRelPath("図面/1F.pdf", "")).toBeNull();
    expect(renamedProjectRelPath("図面/1F.pdf", "..")).toBeNull();
    expect(renamedProjectRelPath("図面/1F.pdf", "a/b")).toBeNull();
    expect(renamedProjectRelPath("図面/1F.pdf", ".hidden")).toBeNull();
    expect(renamedProjectRelPath("図面JWW/1F.jww", "1F.pdf")).toBeNull();
  });
});

describe("listPdfFileNames", () => {
  it("keeps only pdf files and excludes dot entries", () => {
    expect(
      listPdfFileNames([".blueprint-sync", "a.pdf", "notes.txt", "B.PDF", ".hidden.pdf"]),
    ).toEqual(["a.pdf", "B.PDF"]);
  });

  it("excludes names with path separators", () => {
    expect(listPdfFileNames(["a.pdf", "subdir/a.pdf", "a\\b.pdf"])).toEqual(["a.pdf"]);
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

  it("drops a matching path", () => {
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
