# JWW/JWC Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let 「開く」 import `.jww` / `.jwc` by converting them to a vector PDF via ezjww-core and pdf-lib, then treat the result as a normal project drawing.

**Architecture:** Tauri parses CAD bytes with ezjww-core and returns exploded DXF JSON. The frontend draws one vector PDF page with pdf-lib and writes `図面/{stem}.pdf` (or `工程表/`). Existing PDF open/annotate/sync is unchanged. Original CAD files stay on disk.

**Tech Stack:** Svelte 5, pdf-lib, Tauri v2, ezjww-core v0.3.2 (git), Vitest, Rust unit tests.

## Global Constraints

- Svelte 5 only (`$props()`, `onclick`). Logic lives in `src/lib/utils/`, not `.svelte`.
- Tauri commands use camelCase invoke keys. New commands go in `lib.rs` handler.
- Do not keep original `.jww` / `.jwc` in the project folder.
- Browser demo does not convert CAD.
- Do not commit unless the user asks.
- Tests sit next to the code as `*.test.ts`. Mock `@tauri-apps/api/core` like existing tests.

## File map

- Create: `src/lib/utils/cadImport.ts`, `src/lib/utils/cadImport.test.ts`
- Create: `src/lib/utils/dxfToPdf.ts`, `src/lib/utils/dxfToPdf.test.ts`
- Create: `src-tauri/src/cad_dxf.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/explorer_dialog.rs`
- Modify: `src/lib/utils/fileAccess.ts`, `fileAccess.test.ts`
- Modify: `src/lib/utils/projectActions.ts`, `projectActions.test.ts`
- Modify: `src/lib/utils/projectDrop.ts`, `projectDrop.test.ts`

---

### Task 1: CAD file names

**Files:**
- Create: `src/lib/utils/cadImport.ts`
- Test: `src/lib/utils/cadImport.test.ts`

**Interfaces:**
- Produces: `isCadDrawingBasename(name: string): boolean`, `cadPdfBasename(name: string): string | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { cadPdfBasename, isCadDrawingBasename } from "./cadImport";

describe("isCadDrawingBasename", () => {
  it("accepts jww and jwc basenames and rejects nested or hidden names", () => {
    expect(isCadDrawingBasename("1F.jww")).toBe(true);
    expect(isCadDrawingBasename("旧図.JWC")).toBe(true);
    expect(isCadDrawingBasename("A.pdf")).toBe(false);
    expect(isCadDrawingBasename(".hidden.jww")).toBe(false);
    expect(isCadDrawingBasename("nested/a.jww")).toBe(false);
  });
});

describe("cadPdfBasename", () => {
  it("replaces the cad extension with pdf", () => {
    expect(cadPdfBasename("1F.jww")).toBe("1F.pdf");
    expect(cadPdfBasename("旧図.JWC")).toBe("旧図.pdf");
    expect(cadPdfBasename("A.pdf")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/cadImport.test.ts`
Expected: FAIL because `cadImport.ts` does not exist

- [ ] **Step 3: Write minimal implementation**

```ts
function isSafeBasename(name: string): boolean {
  return Boolean(name && !name.startsWith(".") && !name.includes("/") && !name.includes("\\") && !name.includes(".."));
}

export function isCadDrawingBasename(name: string): boolean {
  const lower = name.toLowerCase();
  return isSafeBasename(name) && (lower.endsWith(".jww") || lower.endsWith(".jwc"));
}

export function cadPdfBasename(name: string): string | null {
  if (!isCadDrawingBasename(name)) return null;
  return name.replace(/\.(jww|jwc)$/i, ".pdf");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/cadImport.test.ts`
Expected: PASS

---

### Task 2: DXF JSON to vector PDF

**Files:**
- Create: `src/lib/utils/dxfToPdf.ts`
- Test: `src/lib/utils/dxfToPdf.test.ts`

**Interfaces:**
- Consumes: DXF entity objects with `type`, coordinates in mm, Y-up
- Produces: `dxfDocumentToPdf(doc: DxfDocumentJson): Promise<Uint8Array>`

- [ ] **Step 1: Write the failing test** that a LINE from (0,0) to (100,0) produces `%PDF` bytes and a page larger than the line in points.
- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement bbox, mm→pt, draw LINE/CIRCLE/ARC/ELLIPSE/TEXT/POINT/SOLID/FILLED_POLYGON, skip frozen and INSERT**
- [ ] **Step 4: Tests pass**

---

### Task 3: ezjww-core parse command

**Files:**
- Create: `src-tauri/src/cad_dxf.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `parse_cad_to_dxf(bytes: Vec<u8>) -> Result<serde_json::Value, String>`
- ConvertOptions: explode_inserts true, max_block_nesting 32, text_em_scale 1.0
- JWC coordinates: PaperMillimeters

- [ ] **Step 1: Rust tests for empty/garbage bytes returning Japanese error**
- [ ] **Step 2: Add ezjww-core git dep tag v0.3.2, implement parse, register command**
- [ ] **Step 3: `cargo test --manifest-path src-tauri/Cargo.toml cad_dxf`**

---

### Task 4: Picker + import + drop

**Files:**
- Modify: `explorer_dialog.rs`, `fileAccess.ts`, `projectActions.ts`, `projectDrop.ts` and tests

**Interfaces:**
- Consumes: `isCadDrawingBasename`, `cadPdfBasename`, `parseCadToDxf` (invoke), `dxfDocumentToPdf`
- Produces: converted PDF written with `writeBinaryFile`, original CAD not moved/deleted

- [ ] **Step 1: Failing tests for dialog filter, import of `.jww` writing `図面/1F.pdf`, drop not deleting source**
- [ ] **Step 2: Wire picker filters and conversion in import/drop**
- [ ] **Step 3: `npm test` and `npm run check`**

---

## Spec coverage

- Open dialog jww/jwc → Task 4
- ezjww parse + explode + JWC paper mm → Task 3
- Vector PDF → Task 2
- `図面/{stem}.pdf`, keep original → Task 4
- Errors + browser skip → Task 3/4
- Drop path → Task 4
