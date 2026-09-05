import { describe, expect, it } from "vitest";
import { emptyHistory } from "./editHistory";
import {
  closeTabList,
  createProjectTab,
  findTabByFolder,
  rememberLiveTab,
  sameProjectFolder,
  type ProjectTab,
  type TabSession,
} from "./projectTabs";

function session(folder: string): TabSession {
  return {
    folder,
    meta: null,
    pdfs: [],
    currentPdf: "",
    error: "",
    annotations: { byPage: {}, photoPins: {} },
    history: emptyHistory(),
    pdf: { name: "未読み込み", bytes: null, pageIndex: 0, zoom: 1, status: "" },
  };
}

describe("sameProjectFolder", () => {
  it("treats windows and trailing-slash variants as the same project", () => {
    expect(sameProjectFolder("C:\\work\\現場A", "C:/work/現場A/")).toBe(true);
    expect(sameProjectFolder("/a", "/b")).toBe(false);
  });
});

describe("findTabByFolder", () => {
  it("finds an open tab regardless of path separators", () => {
    const tabs = [createProjectTab({ id: "t1", folder: "C:\\work\\A", name: "A" })];
    expect(findTabByFolder(tabs, "C:/work/A")?.id).toBe("t1");
  });
});

describe("rememberLiveTab", () => {
  it("stores the live session on the active tab and leaves others untouched", () => {
    const tabs: ProjectTab[] = [
      createProjectTab({ id: "a", folder: "/a", name: "a" }),
      createProjectTab({ id: "b", folder: "/b", name: "b" }),
    ];
    const next = rememberLiveTab(tabs, "a", session("/a"));
    expect(next[0].session?.folder).toBe("/a");
    expect(next[1].session).toBeNull();
  });
});

describe("closeTabList", () => {
  it("activates the right neighbor, then the left, and reports the last tab", () => {
    const tabs = [
      createProjectTab({ id: "a", folder: "/a", name: "a" }),
      createProjectTab({ id: "b", folder: "/b", name: "b" }),
      createProjectTab({ id: "c", folder: "/c", name: "c" }),
    ];
    expect(closeTabList(tabs, "b", "b")).toEqual({
      tabs: [tabs[0], tabs[2]],
      nextActiveId: "c",
      closedLast: false,
    });
    expect(closeTabList(tabs, "c", "c").nextActiveId).toBe("b");
    expect(closeTabList([tabs[0]], "a", "a")).toEqual({
      tabs: [],
      nextActiveId: null,
      closedLast: true,
    });
  });
});
