# `field_reviews` schema and re-validation — walkthrough

## `supabase/migrations/0009_field_reviews.sql`

```sql
create table public.field_reviews (
  id                   uuid        primary key default gen_random_uuid(),
  document_version_id  uuid        not null references public.document_versions(id) on delete cascade,
  field_code           text        not null,
  decision             text        not null check (decision in ('approved', 'edited', 'rejected')),
  edited_value         text,
  notes                text,
  reviewed_by          uuid        not null references auth.users(id) on delete restrict,
  reviewed_at          timestamptz not null default now(),

  constraint field_reviews_version_field_unique unique (document_version_id, field_code),
  constraint field_reviews_edited_requires_value check (decision <> 'edited' or edited_value is not null),
  constraint field_reviews_rejected_requires_notes check (decision <> 'rejected' or notes is not null)
);
```

`decision` is a `text` CHECK, not a Postgres enum — same choice
`validation_results.status` made in Phase 4, for the same reason: adding a
new decision type later (an "escalated" state, say) is an `ALTER TABLE ...
DROP CONSTRAINT / ADD CONSTRAINT`, not an `ALTER TYPE` migration touching
every column that references the enum.

The two `CHECK` constraints on `edited_value`/`notes` are conditional —
`decision <> 'edited' or edited_value is not null` reads as "either this
isn't an edit, or it has a value." They only bind the field they're
relevant to; an `approved` row can freely have both columns `null`.

## RLS — three policies, one gate

`field_reviews_select_member`: identical shape to `extraction_results` and
`validation_results` — any workspace member can read.

`field_reviews_insert_reviewer_admin_owner` /
`field_reviews_update_reviewer_admin_owner`: both require
`has_workspace_role(workspace_id, 'reviewer') or ... 'admin' or ... 'owner'`.
`has_workspace_role` is **exact-match only** (documented in its own
migration as intentional — "when we introduce hierarchy we bump this
function"), so every privileged policy in this schema OR-chains the roles
that should qualify rather than relying on any implied ranking. `viewer` is
deliberately excluded — the one role in the enum that should never be able
to write a review decision.

Both write policies also carry `reviewed_by = auth.uid()` in their `with
check`. This is not redundant with the role check: it stops a user with a
qualifying role from writing a review attributed to *someone else*. The
upsert path in `actions.ts` always sets `reviewed_by: user.id` from the
Server Action's own session, so this constraint should never actually
trigger in normal use — it exists as the enforcement boundary, not the
happy path.

No delete policy exists, matching `extraction_results` and
`validation_results` — rows disappear only via the `on delete cascade` FK
when the parent document is removed.

## `apps/api/app/pipeline/revalidate.py`

Two functions, deliberately separated by whether they touch the database:

```python
def compute_effective_values(extracted, reviews) -> dict[str, str | None]:
    effective = dict(extracted)
    for field_code, review in reviews.items():
        decision = review.get("decision")
        if decision == "edited":
            effective[field_code] = review.get("edited_value")
        elif decision == "rejected":
            effective[field_code] = None
        # 'approved' -> leave the original extracted value untouched.
    return effective
```

Pure, no I/O — the same shape `validator.py`'s `_check_*` functions take,
which is what makes `test_revalidate.py` able to test every decision
branch as a plain dict-in, dict-out function call with no fixtures.

```python
def revalidate_document_version(document_version_id: str) -> int:
    client = get_service_client()
    extracted = {...}  # from extraction_results
    reviews = {...}    # from field_reviews
    effective_values = compute_effective_values(extracted, reviews)
    results = validate_fields(effective_values)
    client.table("validation_results").upsert(
        rows, on_conflict="document_version_id,field_code,rule_id"
    ).execute()
    return len(rows)
```

This calls the *exact same* `validate_fields()` from `validator.py` that
Stage C in `ocr_worker.py` calls — no duplicated rule logic, no second
implementation of the determinism gate to keep in sync. The only new code
is the merge step that decides what value each rule should see.

## `apps/api/app/pipeline/router.py` — the revalidate endpoint

```python
@router.post("/documents/{document_version_id}/revalidate", ...)
async def revalidate_document(document_version_id: str) -> RevalidateResponse:
    rules_evaluated = revalidate_document_version(document_version_id)
    return RevalidateResponse(...)
```

Runs synchronously — not a `BackgroundTasks.add_task()` like the pipeline
trigger endpoint. The trigger endpoint returns 202 and lets OCR/extraction
run in the background because those steps can take seconds to minutes
(LLM calls, file downloads). Revalidation is pure in-process Python over
already-fetched rows — fast enough that the review Server Action can
`await` it directly and have fresh `validation_results` before it
revalidates the Next.js page cache.

## Server Action — `review/actions.ts`

`submitFieldReview` is one action with a discriminated-union payload
(`ReviewSubmission`), not three separate exported actions — the plumbing
(auth check → upsert → awaited revalidate call → `revalidatePath`) is
identical across all three decisions:

```ts
export type ReviewSubmission =
  | { decision: "approved" }
  | { decision: "edited"; editedValue: string }
  | { decision: "rejected"; notes: string };
```

The upsert always sets `notes`/`edited_value` to `null` for the branches
where they don't apply (`edited_value: submission.decision === "edited" ?
submission.editedValue : null`) — this is what lets the same row be
reused across a field's review history: approving a field that was
previously rejected clears out the old `notes` rather than leaving stale
data from a different decision sitting in the row.
