# `export.py` — file-by-file walkthrough

## Template grouping

```python
def build_template_groups() -> list[TemplateGroup]:
    prefixes: list[str] = []
    for field in DORA_FIELDS:
        prefix = ".".join(field["code"].split(".")[:2])
        if prefix not in prefixes:
            prefixes.append(prefix)
    ...
```

Derived from `DORA_FIELDS`' own code prefixes (`"b_01.01.0010".split(".")
[:2]` joined back gives `"b_01.01"`) rather than hand-copied from the web
app's `dora-field-groups.ts`. A new field code with a new prefix is
picked up automatically here; the TS side still needs its own list
updated by hand, and `test_build_template_groups_matches_three_esma_templates`
exists specifically to catch the two drifting apart.

## Eligibility

Two layers, deliberately kept separate:

```python
def is_fully_reviewed(field_codes, reviews) -> bool:
    return all(code in reviews for code in field_codes)
```

Pure, no I/O — every field code must be a key in `reviews`, regardless of
what decision it holds. This is coverage, not correctness.

```python
def determine_export_eligibility(workspace_id, client=None) -> ExportEligibility:
    ...
```

DB-touching. Same "latest version with `validation_results` present"
eligibility rule the Review pages already use, plus the stricter
`is_fully_reviewed()` gate on top. Returns both `included` and `excluded`
(with a reason) rather than just a filtered list — the excluded set is
what powers both `manifest.txt`'s "why wasn't X in this export" section
and the Export page's own summary.

## Reviewer names

```python
def _reviewer_display_names(docs, client) -> dict[str, str]:
    reviewer_ids = {review["reviewed_by"] for doc in docs for review in doc.reviews.values() if review.get("reviewed_by")}
    ...
    resp = client.table("profiles").select("id, display_name").in_("id", list(reviewer_ids)).execute()
    return {row["id"]: row["display_name"] for row in resp.data or [] if row.get("display_name")}
```

`field_reviews.reviewed_by` and `profiles.id` are sibling foreign keys to
`auth.users.id`, not a direct FK to each other — PostgREST can't
auto-embed `profiles` through `field_reviews`, so this is a small,
separate query rather than a nested select.

## CSV / manifest builders

All pure functions taking already-fetched data — no client, no query,
just formatting. `_build_template_csv` calls `compute_effective_values`
(reused unmodified from `revalidate.py`) per document so the exported
cell is exactly the same value the Review UI's badges were computed
against, not a second, potentially-drifting calculation of "the real
value."

`_build_sources_csv` iterates all of `DORA_FIELDS` (not just the fields
present in a document's `extracted` map) so every included document
contributes exactly 13 rows regardless of which fields it actually had
values for — the CHECK constraint on `field_reviews` guarantees a review
row exists for every field on a fully-reviewed document, so this can't
under-produce rows silently.

## Zip assembly

```python
def build_export_zip(workspace_id: str) -> bytes:
    ...
    ws_resp = (
        client.table("workspaces")
        .select("id, name")
        .eq("id", workspace_id)
        .maybe_single()
        .execute()
    )
    if not ws_resp or not ws_resp.data:
        raise ValueError(...)
```

Uses `maybe_single()`, not `single()` — see CHALLENGES.md C1 for why
`single()` was the wrong call here and how it was caught.

Everything is written into an `io.BytesIO()` via `zipfile.ZipFile`,
returned as raw `bytes` — no temp files, no Storage round-trip.

## Router — `GET /pipeline/workspaces/{workspace_id}/export`

```python
@router.get("/workspaces/{workspace_id}/export", ...)
async def export_workspace(workspace_id: str) -> Response:
    try:
        zip_bytes = build_export_zip(workspace_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(content=zip_bytes, media_type="application/zip", headers={...})
```

Plain `Response`, not `StreamingResponse` — the whole zip exists in
memory before the endpoint returns, so there's nothing to stream
incrementally. Unauthenticated at this layer like every other pipeline
endpoint; the caller (the Next.js Route Handler) is the trust boundary —
see `03_export_ui_walkthrough.md`.
