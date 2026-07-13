# Phase 1 — Upload & Storage Walkthrough

## File layout

```
apps/web/src/app/dashboard/[workspaceSlug]/documents/
├── page.tsx            # Server Component — fetches + renders document list
├── upload-zone.tsx     # Client Component — drag-and-drop UI + upload logic
├── actions.ts          # Server Actions — initiateUpload, confirmUpload, failUpload
└── document-utils.ts   # Pure util — extensionToDocumentType (no "use server")
```

---

## `document-utils.ts`

```ts
export function extensionToDocumentType(filename: string): DocumentType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, DocumentType> = {
    pdf: "pdf", docx: "docx", xlsx: "xlsx", csv: "csv",
  };
  return ext ? (map[ext] ?? null) : null;
}
```

This lives in its own file — not in `actions.ts` — because Next.js requires
**every export from a `"use server"` file to be an async function**. A sync
utility exported from `actions.ts` would cause a build error.

Rule to carry forward: shared utilities that are neither server-only nor
client-only should live in plain `.ts` files with no directive.

---

## `actions.ts` — the two-step protocol

### Step 1: `initiateUpload`

```ts
export async function initiateUpload(workspaceId, filename, fileType)
  : Promise<InitiateUploadResult | { error: string }>
```

1. Auth-gate: `supabase.auth.getUser()` → redirect to `/login` if null.
2. Insert `documents` row — gets back the new `doc.id`.
3. Sanitise the filename (only alphanumerics, dots, dashes, underscores,
   spaces; collapse repeated spaces to underscores). This is what goes into
   the Storage path. The display name in `documents.name` stays raw.
4. Build `storagePath = {workspaceId}/{doc.id}/1/{safeFilename}`.
5. Insert `document_versions` row with `upload_status = 'uploading'`.
6. Return `{ documentId, versionId, storagePath }`.

### Step 2: `confirmUpload`

```ts
export async function confirmUpload(versionId, sizeBytes, workspaceSlug)
  : Promise<{ error?: string }>
```

Updates the version to `upload_status = 'uploaded'` and records `size_bytes`.
Calls `revalidatePath` so the Server Component re-fetches the document list
when the browser calls `router.refresh()`.

### `failUpload`

Called by the client if the Storage upload errors. Updates the version to
`upload_status = 'failed'` so the row does not linger as `uploading`.

---

## `upload-zone.tsx` — client-side flow

### State

```ts
type FileStatus = "queued" | "uploading" | "done" | "failed";
interface FileEntry { id: string; file: File; status: FileStatus; error?: string; }
const [entries, setEntries] = useState<FileEntry[]>([]);
```

Every file gets a local UUID (`crypto.randomUUID()`) so React can key the
list and we can update individual rows without mutating the array.

### Sequential uploads

```ts
newEntries.reduce(
  (chain, entry) => chain.then(() => uploadFile(entry)),
  Promise.resolve(),
).then(() => router.refresh());
```

Files are uploaded one at a time (chained promises). Parallel uploads would
saturate the connection on mobile and make per-file progress harder to track.
`router.refresh()` runs after the whole batch to trigger a Server Component
re-fetch.

### Drag and drop

Native HTML events — no library. `onDragOver`, `onDragLeave`, `onDrop` on
the drop-target div. `onDrop` filters files by extension before enqueuing.

The hidden `<input type="file" multiple>` is triggered programmatically via
`inputRef.current?.click()` for the click-to-browse path.

### `uploadFile` — step-by-step

```
1. extensionToDocumentType(entry.file.name) → null? mark failed, return.
2. initiateUpload(workspaceId, filename, fileType) → { versionId, storagePath }
3. supabase.storage.from('documents').upload(storagePath, file, { upsert: false })
   → error? failUpload(versionId), mark failed, return.
4. confirmUpload(versionId, file.size, workspaceSlug)
   → error? mark failed, return.
5. mark done.
```

`{ upsert: false }` means a duplicate path is an error, not an overwrite.
That protects version integrity — version 1 of a document can only ever be
written once.

---

## `page.tsx` — document list

```ts
const { data: docs } = await supabase
  .from("documents")
  .select("*, document_versions(id, upload_status, version_number, size_bytes, uploaded_at)")
  .eq("workspace_id", workspace.id)
  .order("created_at", { ascending: false });
```

Uses Supabase's implicit join syntax to fetch related versions in one query.
The component picks the latest version by `version_number` for display.

A `VersionBadge` renders colour-coded status: uploaded (green), uploading
(yellow/pulsing), failed (red).

`formatBytes` converts raw bytes to a human string (`1.4 MB`, `830 KB`).

---

## Interview Q&A

**Q: Why not upload via a Next.js Route Handler instead of a Server Action
for the initiate step?**

A: Server Actions are simpler here — no `fetch()` call on the client,
automatic CSRF protection, and direct TypeScript type safety end-to-end.
Route Handlers make sense when you need a public URL (webhooks, third-party
redirects). For an internal auth-gated operation, Server Actions are the
better fit.

**Q: How do you handle a file that fails mid-upload?**

A: `uploadFile` catches the Supabase Storage error, calls `failUpload` to
mark the DB row, and surfaces the error message in the UI. The user can then
re-select the file (the input's `value` is reset to `""` after each change
event, so the same file can be re-picked). A new `document_version` row will
be created on the next attempt (version_number still 1, but a new UUID).

**Q: The filename sanitisation only removes special chars — could two files
with similar names collide in Storage?**

A: The path is `{workspaceId}/{documentId}/{versionNumber}/{filename}`.
`documentId` is a unique UUID, so two documents with the same filename in
the same workspace will always have different paths. Collision is impossible.
