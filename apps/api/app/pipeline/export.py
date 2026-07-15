"""Workspace-wide draft xBRL-CSV export (Phase 6).

Builds an in-memory zip containing one CSV per ESMA template
(RT.01.01/RT.02.01/RT.03.01), an `evidence_audit_trail.csv` source trail, and
a `disclaimer_manifest.txt` disclaimer -- for every document in a workspace
whose latest version is both validated and *fully reviewed*.

This is a structured draft aid, not a taxonomy-conformant xBRL-CSV filing.
A real EBA/ESMA XBRL-CSV package needs a licensed DPM/taxonomy artefact and
an XBRL processor (e.g. Arelle) to validate against -- neither exists in
this repo. See Project_Docs/Learnings/Phase_6_Export/01_overview.md for
what genuine taxonomy conformance would require.

Nothing here is persisted: the zip is rebuilt fully in-memory on every
request from `extraction_results` and `field_reviews`, which are already
the source of truth. Regeneration is cheap, so there is no `exports` table
and no Storage write path.
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime

import structlog
from supabase import Client

from app.core.supabase import get_service_client
from app.pipeline.field_extractor import DORA_FIELDS
from app.pipeline.revalidate import compute_effective_values

log = structlog.get_logger(__name__)

DISCLAIMER = (
    "This export is a structured draft aid for your organisation's own "
    "review before filing with your National Competent Authority (NCA). "
    "It is NOT a taxonomy-validated xBRL-CSV filing under the DORA RTS, "
    "and has not been checked against the EBA/ESMA DPM or any XBRL "
    "processor. You remain responsible for validating and submitting the "
    "final RoI."
)

_GROUP_LABELS: dict[str, str] = {
    "RT.01.01": "Contractual arrangements",
    "RT.02.01": "ICT third-party providers",
    "RT.03.01": "Outsourced functions",
}


# ---------------------------------------------------------------------------
# Template grouping (pure)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TemplateGroup:
    """One ESMA RoI template, derived from a DORA_FIELDS code prefix."""

    code: str  # "RT.01.01"
    label: str  # "Contractual arrangements"
    prefix: str  # "b_01.01"


def build_template_groups() -> list[TemplateGroup]:
    """Derive ESMA template groups from DORA_FIELDS code prefixes.

    A field code like "b_01.01.0010" has prefix "b_01.01"; the ESMA
    template code is "RT." + the prefix's numeric portion ("01.01"). This
    is derived from the catalogue rather than hand-copied (as
    dora-field-groups.ts on the web side is) so a new field code is picked
    up automatically instead of requiring two lists to stay in sync.
    """
    prefixes: list[str] = []
    for field in DORA_FIELDS:
        prefix = ".".join(field["code"].split(".")[:2])
        if prefix not in prefixes:
            prefixes.append(prefix)

    groups: list[TemplateGroup] = []
    for prefix in prefixes:
        rt_code = "RT." + prefix[2:]
        groups.append(
            TemplateGroup(code=rt_code, label=_GROUP_LABELS.get(rt_code, rt_code), prefix=prefix)
        )
    return groups


def fields_for_group(group: TemplateGroup) -> list[dict[str, str]]:
    """DORA_FIELDS entries belonging to one template group, catalogue order."""
    return [f for f in DORA_FIELDS if f["code"].startswith(group.prefix)]


# ---------------------------------------------------------------------------
# Eligibility (pure predicate; DB-touching resolver below)
# ---------------------------------------------------------------------------


def is_fully_reviewed(
    field_codes: Iterable[str],
    reviews: Mapping[str, Mapping[str, str | None]],
) -> bool:
    """True if every extracted field code has *any* field_reviews row.

    Coverage, not correctness -- approved/edited/rejected all count as
    "reviewed". This is the export-eligibility gate; compute_effective_values
    (reused from revalidate.py, not modified) still decides what value each
    field contributes once a document passes this gate.
    """
    return all(code in reviews for code in field_codes)


@dataclass(frozen=True)
class ExportableDocument:
    """One document whose latest version is validated and fully reviewed."""

    document_id: str
    document_name: str
    document_version_id: str
    extracted: dict[str, str | None]
    reviews: dict[str, Mapping[str, str | None]]


@dataclass(frozen=True)
class ExcludedDocument:
    """One document that did not qualify for export, and why."""

    document_id: str
    document_name: str
    reason: str  # "not_validated" | "incomplete_review"


@dataclass(frozen=True)
class ExportEligibility:
    included: list[ExportableDocument]
    excluded: list[ExcludedDocument]


def determine_export_eligibility(
    workspace_id: str, client: Client | None = None
) -> ExportEligibility:
    """Determine which documents in a workspace are export-ready.

    Eligibility for the latest version of each document: at least one
    validation_results row (validated at least once -- same rule the
    Review list page uses), AND is_fully_reviewed() over its extracted
    fields. Always recomputed from the DB here -- this is the
    authoritative gate; the Next.js Export page's own copy of this logic
    is display-only.
    """
    client = client or get_service_client()

    resp = (
        client.table("documents")
        .select(
            "id, name,"
            " document_versions("
            "   id, version_number,"
            "   extraction_results(field_code, extracted_value),"
            "   validation_results(field_code),"
            "   field_reviews(field_code, decision, edited_value, notes, reviewed_by, reviewed_at)"
            " )"
        )
        .eq("workspace_id", workspace_id)
        .execute()
    )

    included: list[ExportableDocument] = []
    excluded: list[ExcludedDocument] = []

    for doc in resp.data or []:
        versions = doc.get("document_versions") or []
        validated = [v for v in versions if v.get("validation_results")]
        if not validated:
            excluded.append(ExcludedDocument(doc["id"], doc["name"], "not_validated"))
            continue

        latest = max(validated, key=lambda v: v["version_number"])
        extraction_rows = latest.get("extraction_results") or []
        field_codes = [r["field_code"] for r in extraction_rows]
        reviews = {r["field_code"]: r for r in (latest.get("field_reviews") or [])}

        if not is_fully_reviewed(field_codes, reviews):
            excluded.append(ExcludedDocument(doc["id"], doc["name"], "incomplete_review"))
            continue

        included.append(
            ExportableDocument(
                document_id=doc["id"],
                document_name=doc["name"],
                document_version_id=latest["id"],
                extracted={r["field_code"]: r["extracted_value"] for r in extraction_rows},
                reviews=reviews,
            )
        )

    return ExportEligibility(included=included, excluded=excluded)


def _reviewer_display_names(
    docs: list[ExportableDocument], client: Client
) -> dict[str, str]:
    """Map reviewed_by user IDs to a display name for the audit trail.

    field_reviews.reviewed_by and profiles.id are sibling foreign keys to
    auth.users.id, not a direct FK to each other, so this can't be a
    PostgREST auto-embed -- it's a small second query. Falls back to the
    raw ID for any user with no profile row.
    """
    reviewer_ids: set[str] = set()
    for doc in docs:
        for review in doc.reviews.values():
            reviewed_by = review.get("reviewed_by")
            if reviewed_by:
                reviewer_ids.add(reviewed_by)

    if not reviewer_ids:
        return {}

    resp = (
        client.table("profiles")
        .select("id, display_name")
        .in_("id", list(reviewer_ids))
        .execute()
    )
    return {row["id"]: row["display_name"] for row in resp.data or [] if row.get("display_name")}


# ---------------------------------------------------------------------------
# CSV / manifest builders (pure -- take already-fetched data)
# ---------------------------------------------------------------------------


def _template_csv_name(group: TemplateGroup) -> str:
    """"RT.01.01" + "Contractual arrangements" -> "RT_01_01_contractual_arrangements.csv"."""
    return f"{group.code.replace('.', '_')}_{group.label.lower().replace(' ', '_')}.csv"


def _build_template_csv(group: TemplateGroup, docs: list[ExportableDocument]) -> str:
    """One row per included document; header uses catalogue labels (not the
    stored extraction_results.field_label) to avoid drift if an old row's
    label differs from the current catalogue."""
    fields = fields_for_group(group)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["document_id", "document_name"] + [f["label"] for f in fields])
    for doc in docs:
        effective = compute_effective_values(doc.extracted, doc.reviews)
        writer.writerow(
            [doc.document_id, doc.document_name] + [effective.get(f["code"]) or "" for f in fields]
        )
    return out.getvalue()


def _build_sources_csv(
    docs: list[ExportableDocument], reviewer_names: Mapping[str, str]
) -> str:
    """One row per (document, field_code) across all 13 fields -- the
    evidence trail tying every cell to a source document, decision, and
    reviewer identity."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        [
            "document_id",
            "document_name",
            "field_code",
            "field_label",
            "effective_value",
            "decision",
            "reviewed_by",
            "reviewed_at",
        ]
    )
    for doc in docs:
        effective = compute_effective_values(doc.extracted, doc.reviews)
        for field in DORA_FIELDS:
            code = field["code"]
            review = doc.reviews.get(code, {})
            reviewed_by = review.get("reviewed_by") or ""
            writer.writerow(
                [
                    doc.document_id,
                    doc.document_name,
                    code,
                    field["label"],
                    effective.get(code) or "",
                    review.get("decision", ""),
                    reviewer_names.get(reviewed_by, reviewed_by),
                    review.get("reviewed_at", ""),
                ]
            )
    return out.getvalue()


def _build_manifest(workspace_name: str, eligibility: ExportEligibility) -> str:
    lines = [
        f"EvidenceOS xBRL-CSV export (draft) -- {workspace_name}",
        f"Generated at: {datetime.now(UTC).isoformat()}",
        f"Documents included: {len(eligibility.included)}",
        f"Documents excluded: {len(eligibility.excluded)}",
        "",
        DISCLAIMER,
    ]
    if eligibility.excluded:
        lines += ["", "Excluded documents:"]
        lines += [f"  - {d.document_name} ({d.reason})" for d in eligibility.excluded]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Zip assembly (DB-touching entry point)
# ---------------------------------------------------------------------------


def build_export_zip(workspace_id: str) -> bytes:
    """Build the in-memory export zip for one workspace.

    Raises ValueError if the workspace does not exist (caller maps this to
    an HTTP 404).

    determine_export_eligibility() and this function are not unit-tested
    against a mocked Supabase client -- no such harness exists elsewhere
    in this codebase (revalidate_document_version isn't unit-tested
    either, only its pure compute_effective_values half is). Verified
    instead via a manual end-to-end pass against a real workspace.
    """
    client = get_service_client()

    # maybe_single(), not single() -- single() raises a postgrest APIError
    # (PGRST116) for zero rows instead of returning data=None, which would
    # otherwise skip the not-found check below entirely and surface as an
    # unhandled 500 instead of the intended 404.
    ws_resp = (
        client.table("workspaces")
        .select("id, name")
        .eq("id", workspace_id)
        .maybe_single()
        .execute()
    )
    if not ws_resp or not ws_resp.data:
        raise ValueError(f"Workspace {workspace_id!r} not found.")
    workspace_name = ws_resp.data["name"]

    eligibility = determine_export_eligibility(workspace_id, client=client)
    reviewer_names = _reviewer_display_names(eligibility.included, client)
    groups = build_template_groups()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for group in groups:
            zf.writestr(_template_csv_name(group), _build_template_csv(group, eligibility.included))
        zf.writestr(
            "evidence_audit_trail.csv", _build_sources_csv(eligibility.included, reviewer_names)
        )
        zf.writestr("disclaimer_manifest.txt", _build_manifest(workspace_name, eligibility))

    log.info(
        "export_built",
        workspace_id=workspace_id,
        included=len(eligibility.included),
        excluded=len(eligibility.excluded),
    )
    return buffer.getvalue()
