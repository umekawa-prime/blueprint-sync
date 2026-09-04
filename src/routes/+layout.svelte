<script lang="ts">
  import { Toaster } from "svelte-sonner";
  import "@fontsource-variable/noto-sans-jp";
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
<Toaster
  theme="dark"
  position="bottom-right"
  duration={2000}
  visibleToasts={1}
  closeButton={false}
  offset="16px"
  toastOptions={{
    style:
      'font-size: 12px; padding: 8px 12px; font-family: "Noto Sans JP Variable", sans-serif;',
  }}
/>
