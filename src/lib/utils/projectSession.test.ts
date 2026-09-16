import { describe, expect, it } from "vitest";
import {
  captureOpenSession,
  parseOpenSession,
  serializeOpenSession,
  type OpenSession,
} from "./projectSession";

const empty: OpenSession = { folders: [], activeFolder: null };

describe("parseOpenSession", () => {
  it("reads folders and the active folder from JSON", () => {
    expect(
      parseOpenSession(
        JSON.stringify({ folders: ["/a", "/b"], activeFolder: "/b" }),
      ),
    ).toEqual({ folders: ["/a", "/b"], activeFolder: "/b" });
  });

  it("returns an empty session for invalid JSON", () => {
    expect(parseOpenSession("{not json}")).toEqual(empty);
  });

  it("returns an empty session when folders are missing", () => {
    expect(parseOpenSession("{}")).toEqual(empty);
    expect(parseOpenSession("[]")).toEqual(empty);
  });

  it("drops blank folders and an active folder that is not open", () => {
    expect(
      parseOpenSession(
        JSON.stringify({ folders: ["", "/a", "/a"], activeFolder: "/missing" }),
      ),
    ).toEqual({ folders: ["/a"], activeFolder: null });
  });
});

describe("serializeOpenSession", () => {
  it("round-trips a session through JSON", () => {
    const session: OpenSession = { folders: ["/a"], activeFolder: "/a" };
    expect(parseOpenSession(serializeOpenSession(session))).toEqual(session);
  });
});

describe("captureOpenSession", () => {
  it("records open tab folders and the live folder", () => {
    expect(
      captureOpenSession({
        tabs: [
          { folder: "/a" },
          { folder: "/b" },
          { folder: "/a/" },
        ],
        activeFolder: "/b",
      }),
    ).toEqual({ folders: ["/a", "/b"], activeFolder: "/b" });
  });

  it("clears the session when no tabs are open", () => {
    expect(captureOpenSession({ tabs: [], activeFolder: "/a" })).toEqual(empty);
  });
});
