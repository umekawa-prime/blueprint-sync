<script lang="ts">
  import { Toaster } from "svelte-sonner";
  import "@fontsource-variable/noto-sans-jp";
  import "../app.css";
  import { safeAreaPaddingCss } from "$lib/utils/chromeLayout";

  let { children } = $props();
</script>

<div class="box-border flex h-full min-h-0 flex-col" style={safeAreaPaddingCss()}>
  {@render children()}
</div>
<Toaster
  theme="dark"
  position="bottom-right"
  duration={2000}
  visibleToasts={1}
  closeButton={false}
  offset="calc(16px + env(safe-area-inset-bottom, 0px))"
  toastOptions={{
    style:
      'font-size: 12px; padding: 8px 12px; font-family: "Noto Sans JP Variable", sans-serif;',
  }}
/>
