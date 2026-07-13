# Phase 1 — Document Upload and Pipeline Model

## What we built

Phase 1 adds the data-ingestion spine of EvidenceOS: the ability to upload
compliance documents and queue them through a multi-stage processing pipeline.

### Four new database tables

| Table | Purpose |
|---|---|
| `documents` | One row per logical document (name, type, workspace). |
| `document_versions` | One row per uploaded binary. Each document starts at version 1; re-uploads increment. Holds the Supabase Storage path and `upload_status`. |
| `pipeline_runs` | One row per user-initiated processing run. Can cover multiple documents simultaneously. |
| `pipeline_run_documents` | Junction table: links a run to a specific document version, and holds per-stage status columns (`ocr_status`, `extraction_status`, …). |

### Three UI pages

| Page | Route | Role |
|---|---|---|
| Documents | `/dashboard/[workspaceSlug]/documents` | Upload files; see upload history. |
| Pipeline | `/dashboard/[workspaceSlug]/pipeline` | Select uploaded docs; start a run; view run history with stage breakdown. |
| Workspace layout | `/dashboard/[workspaceSlug]/layout.tsx` | Nav shell shared by both pages. |

### Storage bucket

A private Supabase Storage bucket called `documents` holds the actual file
binaries. Storage RLS ties each object to a workspace via the object path
(`{workspaceId}/{documentId}/{versionNumber}/{filename}`).

---

## Why this sequence matters for DORA RoI

DORA requires firms to submit an xBRL-CSV Register of Information.
The extraction pipeline (OCR → Extract → Normalise → Validate → Recommend)
is the core value proposition: it automates the mechanical reading and
quality-checking that firms currently do in spreadsheets.

Phase 1 creates the skeleton. Later phases will make each stage real:

- **Phase 2** — OCR worker (Azure Document Intelligence or equivalent)
- **Phase 3** — Field extraction and xBRL mapping
- **Phase 4** — The 116 ESMA validation checks
- **Phase 5** — AI recommendation engine + human review workflow
- **Phase 6** — xBRL-CSV export

---

## How it fits the overall architecture

```
Browser
  │  drag-and-drop → UploadZone (Client Component)
  │     │
  │     ├─ initiateUpload (Server Action) ──► Supabase DB
  │     │    creates document + document_version rows
  │     │
  │     ├─ supabase.storage.upload() ──────► Supabase Storage (direct)
  │     │
  │     └─ confirmUpload (Server Action) ──► Supabase DB
  │          marks version as 'uploaded'
  │
  └─ startPipelineRun (Server Action) ──────► Supabase DB
       creates pipeline_run + pipeline_run_documents rows
```

The browser uploads directly to Supabase Storage (cheaper, no streaming
through Next.js). The Server Actions create the DB bookkeeping on either
side. A background worker (Phase 2+) will pick up `pipeline_run_documents`
rows with `ocr_status = 'pending'` and advance each stage.

---

## Interview Q&A

**Q: Why does the browser upload directly to Supabase Storage instead of
going through your API?**

A: Two reasons — latency and cost. If we stream through Next.js, the file
travels client → server → Supabase and doubles the upload time and egress
cost. Direct-to-storage means client → Supabase only. The DB bookkeeping
still goes through server actions so we never lose track of an upload.
Storage RLS validates workspace membership from the JWT, so there is no
loss of security.

**Q: How does Storage RLS know which workspace an object belongs to?**

A: We embed the workspace ID as the first segment of the object path:
`{workspaceId}/{documentId}/1/{filename}`. The Storage RLS policy calls
`is_workspace_member((string_to_array(name, '/'))[1]::uuid)` — it parses
the first path segment as a UUID and checks workspace membership.

**Q: What happens if the browser crashes between step 2 (Storage upload)
and step 3 (confirmUpload)?**

A: The `document_version` row stays in `upload_status = 'uploading'`
indefinitely. The `failUpload` Server Action handles deliberate failures
(e.g. Storage error). Orphaned `uploading` rows can be cleaned up by a
scheduled job (not yet built) that checks `created_at` age. This is
acceptable for an MVP — the Storage object exists even if the DB row is
stale, so no data is lost.
