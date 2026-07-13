# Phase 1 — Pipeline Model Walkthrough

## File layout

```
apps/web/src/app/dashboard/[workspaceSlug]/pipeline/
├── page.tsx            # Server Component — data fetch + run history table
├── start-run-form.tsx  # Client Component — checkbox selector + submit
└── actions.ts          # Server Action — startPipelineRun
```

---

## `actions.ts` — `startPipelineRun`

```ts
export async function startPipelineRun(
  workspaceId: string,
  workspaceSlug: string,
  documentVersionIds: string[],
): Promise<{ error?: string }>
```

1. Auth-gate.
2. Validate `documentVersionIds.length > 0`.
3. Insert `pipeline_runs` row → get `runId`.
4. Bulk-insert `pipeline_run_documents` rows (one per version ID).
5. `revalidatePath` so the server component refreshes.

The run is created in `status = 'queued'`. All stage columns default to
`'pending'`. A background worker (Phase 2+) will poll for queued runs
and advance the stages.

---

## `start-run-form.tsx` — checkbox selector

```ts
const uploadedDocs = documents.filter(
  (d) => d.latest_version?.upload_status === "uploaded",
);
```

Only documents with a successfully uploaded version are shown. Documents
still uploading or failed are excluded — you cannot run a pipeline on a
file that hasn't landed in Storage yet.

State: `Set<string>` of selected `document_version_id` values. Set makes
toggle O(1) and deduplication trivial.

```ts
startTransition(async () => {
  const result = await startPipelineRun(workspaceId, workspaceSlug, Array.from(selected));
  …
});
```

`useTransition` wraps the Server Action call so the UI stays interactive
during the async round-trip. `isPending` drives the disabled state and
button label.

---

## `page.tsx` — run history

The page makes two Supabase queries:

**1. Documents for the form:**

```ts
.from("documents")
.select("id, name, file_type, …, document_versions(id, upload_status, version_number)")
.eq("workspace_id", workspace.id)
```

**2. Run history with deep join:**

```ts
.from("pipeline_runs")
.select(`
  id, status, created_at, …,
  pipeline_run_documents (
    document_version_id,
    ocr_status, extraction_status, normalisation_status,
    validation_status, recommendation_status,
    document_versions ( documents ( name, file_type ) )
  )
`)
.eq("workspace_id", workspace.id)
.order("created_at", { ascending: false })
```

This is a three-level join: `pipeline_runs` → `pipeline_run_documents` →
`document_versions` → `documents`. Supabase's PostgREST syntax handles this
with nested `select` strings. The `.returns<...>()` call provides TypeScript
type safety for the deeply nested result.

### Stage display

Five stage columns are rendered as a table. Each cell shows a `StagePip`
component with a Unicode icon:

| Status | Icon | Meaning |
|---|---|---|
| pending | `○` | Not yet started |
| running | `◑` | Worker is processing |
| completed | `●` | Stage done |
| failed | `✕` | Stage errored |
| skipped | `—` | Skipped (e.g. CSV has no OCR) |

Icons are intentionally monochrome text rather than SVGs — they render
consistently across fonts, require zero bundle weight, and work in email
or print.

---

## The broader pipeline design

Phase 1 creates the DB rows. Phases 2–5 will make the stages real:

```
queued → (worker picks up) → running
   document loop:
     ocr_status: pending → running → completed
     extraction_status: pending → running → completed
     …
   all docs done → pipeline_run.status = 'completed'
```

A worker will `SELECT … FOR UPDATE SKIP LOCKED` on `pipeline_runs` where
`status = 'queued'`, claim the run, and update stages sequentially. `SKIP
LOCKED` prevents two workers from picking the same run simultaneously.

The `stage_status = 'skipped'` value handles file-type-specific stages —
CSVs do not need OCR (they are already structured text), so `ocr_status`
would be set to `'skipped'` rather than run.

---

## Interview Q&A

**Q: Why a separate `pipeline_runs` table instead of a status column on
`documents`?**

A: Because a single document can be processed multiple times (e.g. after
re-upload or after validation rules change), and multiple documents can be
processed in one batch. A `pipeline_runs` table gives us independent run
history for each document version, runnable in parallel or sequence, with
a clean audit trail.

**Q: How does `useTransition` improve the experience compared to a plain
`useState` approach?**

A: Without `useTransition`, a long async operation blocks React's render
cycle — the UI freezes. `useTransition` marks the update as non-urgent, so
React can process higher-priority events (e.g. hover, typing) in between.
The `isPending` flag lets us grey out the button and show "Starting…"
without blocking anything.

**Q: What happens if the user closes the tab after starting a run?**

A: Nothing bad. The `pipeline_run` row is already in the DB in `queued`
state. The worker will pick it up regardless of whether the browser is still
open. When the user returns, `router.refresh()` or a hard page reload will
show the updated run status.

**Q: How would you scale the pipeline to handle 500 documents simultaneously?**

A: The current schema supports it already — the worker loop processes each
`pipeline_run_documents` row independently. We would add a job queue
(e.g. BullMQ or Supabase pgmq) so multiple worker instances can pick
different documents from the same run in parallel. The `FOR UPDATE SKIP LOCKED`
pattern on the queue table prevents double-processing.
