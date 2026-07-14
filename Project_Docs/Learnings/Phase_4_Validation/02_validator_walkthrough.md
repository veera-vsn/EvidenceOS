# `validator.py` and Stage C wiring — file-by-file walkthrough

## `apps/api/app/pipeline/validator.py`

### Shape

```
ValidationStatus = Literal["pass", "fail", "warning", "skipped"]

@dataclass
class ValidationResult:
    field_code: str
    rule_id: str
    rule_label: str
    status: ValidationStatus
    message: str | None
```

One dataclass instance per `(field, rule)` pair examined. `validate_fields()`
is the single public entry point:

```python
def validate_fields(values: Mapping[str, str | None]) -> list[ValidationResult]:
    results = []
    results.extend(_check_required_fields(values))
    results.extend(_check_date_format(values))
    results.append(_check_date_logic(values))
    results.append(_check_notice_period(values))
    results.extend(_check_country_codes(values))
    results.append(_check_lei_format(values))
    results.append(_check_criticality_value(values))
    return results
```

Every `_check_*` function takes the same `Mapping[str, str | None]` and
returns either one `ValidationResult` (single-field rules) or a list
(rules that iterate multiple field codes, like `REQUIRED_FIELD` running
over all 13 fields). None of them touch the database, the network, or each
other — `validate_fields()` is the only place that composes them.

### `_check_required_fields`

Iterates `DORA_FIELDS` (imported from `field_extractor.py` — the same
catalogue Stage B used to build its extraction prompt, so the two stages
can never drift on what "the 13 fields" means) and fails any code not in
`_OPTIONAL_FIELD_CODES` that has a blank value. `_is_blank()` treats both
`None` and whitespace-only strings as blank, because an LLM can return
`"   "` as readily as `None` for a field it didn't find.

### `_check_date_format` / `_check_date_logic`

Two separate rules deliberately. `DATE_FORMAT` checks each date field in
isolation using `date.fromisoformat()` — this also rejects calendar-invalid
dates like `2025-02-30` for free, since `fromisoformat` parses and
validates in one step rather than just pattern-matching digits.
`DATE_LOGIC` is a cross-field rule (needs both start and end) and is
attached to the end-date field code, because that is the value a reviewer
would actually correct. It reports `skipped`, not `fail`, when either date
is missing or already malformed — `DATE_FORMAT` already reported that
problem, and reporting the same underlying issue as two different failures
would double-count it in any pass-rate metric built on top of this table.

### `_check_notice_period`

Parses with `int()` inside a `try/except ValueError` rather than a regex —
correctly accepts `"90"`, `"-5"`, `" 30 "` (after `.strip()`) and rejects
`"thirty days"` without needing to special-case whitespace or leading
signs in a pattern.

### `_check_country_codes` / `_check_lei_format`

Both normalise case (`.strip().upper()`) before comparing, since the LLM
extraction is not guaranteed to preserve the exact casing a spec expects.
`ISO_3166_1_ALPHA_2` is a 249-entry `frozenset` built from a multi-line
string literal split on whitespace — chosen over a Python list literal
because a wall of two-letter codes is easier to scan and diff in this
layout than one entry per line would be.

### `_check_criticality_value`

The one rule that returns `warning` instead of `fail` — see the design
decision in `01_overview.md`. `_ALLOWED_CRITICALITY_VALUES` is a small,
deliberately loose set (`critical`, `important`, `yes`, `no`, etc.) since
this field is free text the LLM extracted from prose, not a coded value
from a fixed vocabulary in the source contract.

## `apps/api/app/pipeline/ocr_worker.py` — Stage C wiring

Added after the existing Stage B (extraction) block, gated on
`extraction_ok` (a new local flag; previously the function only tracked
`ocr_ok`):

```python
if extraction_ok:
    client.table("pipeline_run_documents").update(
        {"validation_status": "running"}
    ).eq(...).execute()

    values = {f.field_code: f.extracted_value for f in fields}
    results = validate_fields(values)

    rows = [
        {
            "document_version_id": version_id,
            "field_code": r.field_code,
            "rule_id": r.rule_id,
            "rule_label": r.rule_label,
            "status": r.status,
            "message": r.message,
        }
        for r in results
    ]
    client.table("validation_results").upsert(
        rows, on_conflict="document_version_id,field_code,rule_id"
    ).execute()

    client.table("pipeline_run_documents").update(
        {"validation_status": "completed"}
    ).eq(...).execute()
```

Every branch that previously set only `extraction_status` to `failed` or
`skipped` was extended to also set `validation_status` to `skipped` in the
same update call — OCR failure, empty-text skip, and extraction failure all
now propagate through to Stage C's status rather than leaving it stuck at
`pending` forever.

## `apps/web/.../pipeline/page.tsx` — `ValidationBadges`

```tsx
function ValidationBadges({ results }: { results: ... }) {
  const visible = results.filter((r) => r.status !== "skipped");
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {visible.map((r) => (
        <span
          key={r.rule_id}
          title={r.message ?? r.rule_label}
          className={`... ${VALIDATION_BADGE_STYLES[r.status as ValidationStatus]}`}
        >
          {r.rule_id.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}
```

Rendered inside the existing per-field row, filtered to the field's own
`field_code` before being passed in. `skipped` results are filtered out at
render time rather than at the query or Stage C level — the row still
exists in the database (so the audit trail is complete) but a reviewer
looking at a field with a legitimately blank optional value does not need
a grey "no-op" badge cluttering the row.

`VALIDATION_BADGE_STYLES` maps status to a Tailwind class string using the
existing `success` / `danger` / `warning` / `foreground` design tokens
already defined for `ConfidencePip`, so the badges inherit the same colour
language the confidence pips use rather than introducing a second palette.
