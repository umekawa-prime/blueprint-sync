import { describe, expect, it, beforeEach } from "vitest";
import {
  WEB_DEMO_FOLDER,
  enableWebDemo,
  isWebDemo,
  resetWebDemo,
  webHas,
  webListPdfs,
  webPut,
  webReadBytes,
} from "./webDemoFs";

describe("webDemoFs", () => {
  beforeEach(() => {
    resetWebDemo();
    enableWebDemo();
  });

  it("lists drawings so the sidebar can select them", () => {
    webPut(`${WEB_DEMO_FOLDER}/図面/既存図.pdf`, new Uint8Array([1]));
    webPut(`${WEB_DEMO_FOLDER}/図面/追加図.pdf`, new Uint8Array([2]));
    webPut(`${WEB_DEMO_FOLDER}/工程表/週間工程.pdf`, new Uint8Array([3]));

    expect(isWebDemo()).toBe(true);
    expect(webListPdfs(WEB_DEMO_FOLDER)).toEqual([
      "工程表/週間工程.pdf",
      "図面/既存図.pdf",
      "図面/追加図.pdf",
    ]);
    expect(webHas(`${WEB_DEMO_FOLDER}/図面/追加図.pdf`)).toBe(true);
    expect(webReadBytes(`${WEB_DEMO_FOLDER}/図面/追加図.pdf`)).toEqual(new Uint8Array([2]));
  });
});
