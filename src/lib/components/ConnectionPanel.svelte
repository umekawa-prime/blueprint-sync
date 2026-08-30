<script lang="ts">
  import QRCode from "qrcode";
  import { connectionStore } from "$lib/stores/connectionStore.svelte";
  import {
    connectAsClient,
    startHost,
    stopHost,
  } from "$lib/utils/connectionActions";
  import { connectionQrPayload } from "$lib/utils/syncClient";
  import { detectPlatform } from "$lib/utils/platform";
  import QrScanner from "./QrScanner.svelte";

  let {
    open = $bindable(false),
  }: {
    open: boolean;
  } = $props();

  let qrUrl = $state("");
  let hostInput = $state("");
  let showScanner = $state(false);
  let starting = $state(false);
  const platform = detectPlatform();

  $effect(() => {
    if (connectionStore.url) {
      void QRCode.toDataURL(connectionQrPayload(connectionStore.url), {
        width: 240,
        margin: 1,
      }).then((url) => {
        qrUrl = url;
      });
    } else {
      qrUrl = "";
    }
  });

  async function host() {
    starting = true;
    try {
      await startHost();
    } catch (error) {
      connectionStore.status = "error";
      connectionStore.error =
        error instanceof Error ? error.message : "ホストを開始できませんでした";
    } finally {
      starting = false;
    }
  }

  function connect() {
    try {
      connectAsClient(hostInput);
      open = false;
    } catch (error) {
      connectionStore.error =
        error instanceof Error ? error.message : "接続先が不正です";
      connectionStore.status = "error";
    }
  }
</script>

{#if open}
  <div class="absolute inset-0 z-20 flex items-start justify-end bg-slate-950/70 p-4">
    <section class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold">接続設定（オフライン同期）</h2>
        <button class="text-slate-400" onclick={() => (open = false)}>閉じる</button>
      </div>

      <p class="mb-4 text-xs leading-5 text-slate-400">
        インターネットは使いません。Windows をホストにし、Android のテザリングまたは
        モバイルルーターの同一LANで接続します。
      </p>

      <div class="mb-4 grid grid-cols-2 gap-2">
        <button
          class="rounded px-3 py-2 text-sm {connectionStore.role === 'host'
            ? 'bg-cyan-700'
            : 'bg-slate-800'}"
          onclick={() => (connectionStore.role = 'host')}
        >
          Windows ホスト
        </button>
        <button
          class="rounded px-3 py-2 text-sm {connectionStore.role === 'client'
            ? 'bg-cyan-700'
            : 'bg-slate-800'}"
          onclick={() => (connectionStore.role = 'client')}
        >
          Android クライアント
        </button>
      </div>

      {#if connectionStore.role === "host"}
        <div class="space-y-3">
          {#if connectionStore.status === "hosting"}
            {#if qrUrl}
              <img class="mx-auto rounded bg-white p-2" src={qrUrl} alt="接続用QRコード" />
            {/if}
            <p class="text-center text-sm text-cyan-200">{connectionStore.url}</p>
            {#if connectionStore.addresses.length > 1}
              <p class="text-xs text-slate-400">
                他のIP: {connectionStore.addresses.join(", ")}
              </p>
            {/if}
            <button class="w-full rounded bg-rose-800 px-3 py-2 text-sm" onclick={stopHost}>
              待機を停止
            </button>
          {:else}
            <button
              class="w-full rounded bg-cyan-700 px-3 py-2 text-sm"
              onclick={host}
              disabled={starting}
            >
              {starting ? "起動中..." : "接続待機を開始"}
            </button>
          {/if}
        </div>
      {:else}
        <div class="space-y-3">
          {#if showScanner}
            <QrScanner
              onDetected={(value) => {
                hostInput = value;
                showScanner = false;
                connect();
              }}
              onCancel={() => (showScanner = false)}
            />
          {:else}
            <button
              class="w-full rounded bg-slate-800 px-3 py-2 text-sm"
              onclick={() => (showScanner = true)}
            >
              QRコードを読み取る
            </button>
            <label class="block text-xs text-slate-400">
              または IP / ws:// を入力
              <input
                class="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="192.168.43.1 または ws://192.168.43.1:7840"
                bind:value={hostInput}
              />
            </label>
            <button class="w-full rounded bg-cyan-700 px-3 py-2 text-sm" onclick={connect}>
              接続
            </button>
          {/if}
        </div>
      {/if}

      {#if connectionStore.error}
        <p class="mt-3 text-sm text-rose-300">{connectionStore.error}</p>
      {/if}

      <p class="mt-4 text-[11px] text-slate-500">検出プラットフォーム: {platform}</p>
    </section>
  </div>
{/if}
