import { pwaStore } from "$lib/stores/pwaStore.svelte";
import { isTauriRuntime } from "./platform";

export function shouldRegisterServiceWorker(
  isTauri = isTauriRuntime(),
  hasSw = typeof navigator !== "undefined" && "serviceWorker" in navigator,
  isDev = import.meta.env.DEV,
): boolean {
  return !isTauri && hasSw && !isDev;
}

export async function registerWebServiceWorker(): Promise<void> {
  if (!shouldRegisterServiceWorker()) {
    return;
  }
  try {
    // Classic script: SvelteKit emits a classic service worker in production builds.
    await navigator.serviceWorker.register("/service-worker.js");
    await navigator.serviceWorker.ready;
    pwaStore.offlineReady = true;
  } catch (error) {
    console.warn("service worker registration failed", error);
  }
}
