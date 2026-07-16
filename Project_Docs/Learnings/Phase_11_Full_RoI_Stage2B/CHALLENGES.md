# Phase 11 (Full RoI Stage 2B) — Challenges

Matching the format every earlier phase's `CHALLENGES.md` uses: symptom,
root cause, fix, lesson.

---

## C1 — A circular import between export.py and entity_export.py

**Symptom:** wiring `entity_export.py`'s builders into `export.py`
produced an import that would fail at runtime: `export.py` needed to
import the new builder functions from `entity_export.py`, but
`entity_export.py` needed `ExportableDocument` (defined in `export.py`)
to type the `B_03.01`/`B_03.02`/`B_04.01` builders, which take a list of
already-eligible documents.

**Root cause:** `ExportableDocument` living inside `export.py` made sense
when it was the only module that needed it (Phase 6). Stage 2B is the
first time a second module needs the same type, and the straightforward
`from app.pipeline.export import ExportableDocument` closes the loop:
`export.py` → `entity_export.py` → `export.py`.

**Fix:** moved `ExportableDocument` into a new, minimal
`export_types.py` module that both `export.py` and `entity_export.py`
import from. No behaviour change — same dataclass, same fields, just
relocated before either of the two modules that need it existed as a
pair.

**Lesson:** a shared type living inside "the module that happened to
need it first" is fine until a second module needs it too — at that
point, move it to a shared location rather than importing across the two
feature modules directly. Worth checking early in any phase that adds a
new module depending on an existing one: does the existing module need
anything back from the new one? If yes, that's the shared-type smell
before it becomes a broken import.

---

## C2 — The permission system correctly stopped a live-database DDL change
mid-implementation, even though the plan was already approved

**Symptom:** applying `supabase/migrations/0010_entity_profile.sql` to
the real Supabase project via the `apply_migration` MCP tool was denied
by the auto-mode permission classifier, mid-way through implementing an
already-approved plan.

**Root cause:** the classifier correctly identified two things at once:
(1) creating tables and RLS policies on the live/production Supabase
project is a genuine shared-resource, hard-to-instantly-reverse action,
regardless of how routine it is within this project's own history
(migrations `0001`–`0009` were all applied the same way); and (2) the
user had separately said, in the same conversation, that they would
handle deployment themselves — which the classifier read (correctly) as
a signal that live-infrastructure changes specifically might not be
covered by the general "go ahead and implement it" approval a few turns
earlier.

**Fix:** stopped, explained exactly what was needed and why (apply the
migration so `database.types.ts` — a "DO NOT EDIT BY HAND" generated
file — could be regenerated accurately for the frontend work), and gave
the user two concrete options rather than guessing which one they'd
prefer. They approved applying it directly; the same `apply_migration`
call then succeeded once given explicit, in-the-moment confirmation.

**Lesson:** a broad approval ("implement the plan") does not automatically
cover every category of action inside that plan, especially ones a user
has separately signalled they want control over (deployment, in this
case). When a permission boundary triggers on an action that really is
categorically different from the rest of the work (editing files vs.
mutating shared live infrastructure), stopping to ask is the right
outcome even mid-task, not a failure to route around — and it cost one
extra turn, not a rewrite.
