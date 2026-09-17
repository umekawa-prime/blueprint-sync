import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

/** Windows + Vitest 4.1: importing from "vitest" loads a second runner. Use globals instead. */
/** @returns {import("vite").Plugin} */
function vitestUseGlobals() {
  return {
    name: "vitest-use-globals",
    enforce: "pre",
    transform(code, id) {
      if (!process.env.VITEST || !id.includes(".test.ts")) {
        return null;
      }
      return code.replace(/import\s*\{[^}]*\}\s*from\s*["']vitest["'];?\r?\n/, "");
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vitestUseGlobals(), tailwindcss(), sveltekit()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.ts"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
