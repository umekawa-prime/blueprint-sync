import { describe, expect, it } from "vitest";
import { applyWslGraphicsEnv } from "../../../scripts/wslGraphicsEnv.mjs";

describe("applyWslGraphicsEnv", () => {
  it("leaves non-WSL environments unchanged", () => {
    const env = { DISPLAY: ":0" };
    expect(applyWslGraphicsEnv(env, false)).toEqual({ DISPLAY: ":0" });
  });

  it("forces X11 and software WebKit on WSL so the window can appear on Windows", () => {
    const env = applyWslGraphicsEnv({ DISPLAY: ":0", WAYLAND_DISPLAY: "wayland-0" }, true);
    expect(env.GDK_BACKEND).toBe("x11");
    expect(env.WEBKIT_DISABLE_COMPOSITING_MODE).toBe("1");
    expect(env.WEBKIT_DISABLE_DMABUF_RENDERER).toBe("1");
    expect(env.LIBGL_ALWAYS_SOFTWARE).toBe("1");
  });

  it("does not override an explicit GDK_BACKEND", () => {
    const env = applyWslGraphicsEnv({ GDK_BACKEND: "wayland" }, true);
    expect(env.GDK_BACKEND).toBe("wayland");
  });
});
