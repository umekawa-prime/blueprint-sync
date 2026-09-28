<script lang="ts">
  import type { Tool } from "$lib/stores/toolStore.svelte";

  let { tool }: { tool: Tool } = $props();
</script>

<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  {#if tool === "select"}
    <path d="M6 3.5 11.2 20l2.2-6.2L20 11.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
  {:else if tool === "stamp"}
    <circle cx="8" cy="9" r="3.2" stroke="currentColor" stroke-width="1.7" />
    <rect x="12" y="12" width="7" height="7" stroke="currentColor" stroke-width="1.7" />
  {:else if tool === "pen"}
    <path d="M14.5 4.5 19.5 9.5 9 20H4v-5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    <path d="M13 6 18 11" stroke="currentColor" stroke-width="1.7" />
  {:else if tool === "eraser"}
    <path d="M4 16.5 11.5 5.5l7 5.2-5.2 7.3H8.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    <path d="M4 19.5h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
  {:else if tool === "text"}
    <path d="M6 6h12M12 6v13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  {:else if tool === "pan"}
    <path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    <path d="m12 4 2.2 2.2M12 4 9.8 6.2M12 20l2.2-2.2M12 20 9.8 17.8M4 12l2.2-2.2M4 12l2.2 2.2M20 12l-2.2-2.2M20 12l-2.2 2.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
  {:else if tool === "rect"}
    <rect x="5" y="6" width="14" height="12" stroke="currentColor" stroke-width="1.7" />
  {:else if tool === "ellipse"}
    <ellipse cx="12" cy="12" rx="7.5" ry="5.5" stroke="currentColor" stroke-width="1.7" />
  {:else}
    <path d="M5 16.5 16.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    <path d="M13 5h5.5V10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
  {/if}
</svg>
