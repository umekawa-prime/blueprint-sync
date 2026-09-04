/**
 * @param {Record<string, string | undefined>} env
 * @param {boolean} isWsl
 * @returns {Record<string, string | undefined>}
 */
export function applyWslGraphicsEnv(env, isWsl) {
  if (!isWsl) {
    return env;
  }
  const next = { ...env };
  next.WEBKIT_DISABLE_COMPOSITING_MODE ??= "1";
  next.WEBKIT_DISABLE_DMABUF_RENDERER ??= "1";
  next.LIBGL_ALWAYS_SOFTWARE ??= "1";
  // WSLg surfaces GTK windows to Windows through Xwayland; the Wayland backend
  // creates a surface that never gets a visible RAIL window.
  next.GDK_BACKEND ??= "x11";
  return next;
}
