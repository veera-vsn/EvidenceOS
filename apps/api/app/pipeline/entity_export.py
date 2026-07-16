"""Full RoI Stage 2B: the filer's own entity identity (Phase 11).

Unlike every other table `export.py` builds, `B_01.01`/`B_01.02`/`B_01.03`
and the `B_03.01`/`B_03.02`/`B_04.01` rows derived from them are not
extracted from a vendor document -- they describe the filer's own
organisation, entered once in workspace settings
(`entity_profiles`/`entity_branches`, migration 0010) rather than produced
by the extraction/validation/review pipeline. `B_02.03` and `B_03.03`
(intra-group tables) stay permanently empty until real multi-entity group
support exists -- see
Project_Docs/Learnings/Phase_11_Full_RoI_Stage2B/01_overview.md for why
that is deliberately out of scope for now.

Degrades gracefully: a workspace with no entity profile configured still
exports every document-level table (B_02.01 etc., see export.py)
completely unaffected -- only the profile-dependent CSVs here come back
empty (header row only), and `export.py` adds one manifest note
explaining why. This must never become a new gate on exporting contract
data.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Any

from supabase import Client

from app.pipeline.export_types import ExportableDocument
from app.pipeline.revalidate import compute_effective_values

_ARRANGEMENT_REF_CODE = "b_02.01.0010"
_PROVIDER_ID_CODE = "b_05.01.0010"
_PROVIDER_ID_TYPE_CODE = "b_05.01.0020"

# B_01.02's "Hierarchy" column has a real 5-value EBA enum (workbook sheet
# B0102); a standalone filer with no group is always this one value.
_STANDALONE_HIERARCHY_VALUE = "Entities other than entities of the group"


@dataclass(frozen=True)
class EntityProfile:
    """The filer's own entity identity (EBA table B_01.01), read from entity_profiles."""

    lei: str
    name: str
    country: str
    entity_type: str
    competent_authority: str
    total_assets: str | None
    total_assets_currency: str | None


@dataclass(frozen=True)
class EntityBranch:
    """One branch of the filer's own entity (EBA table B_01.03)."""

    branch_code: str
    name: str
    country: str


# ---------------------------------------------------------------------------
# DB-touching resolvers
# ---------------------------------------------------------------------------


def fetch_entity_profile(workspace_id: str, client: Client) -> EntityProfile | None:
    """The workspace's entity profile, or None if not configured yet.

    entity_profiles.workspace_id is UNIQUE (migration 0010) -- a workspace
    has at most one row here, matching maybe_single()'s zero-or-one shape.
    """
    resp = (
        client.table("entity_profiles")
        .select(
            "lei, name, country, entity_type, competent_authority,"
            " total_assets, total_assets_currency"
        )
        .eq("workspace_id", workspace_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        return None

    row = resp.data
    return EntityProfile(
        lei=row["lei"],
        name=row["name"],
        country=row["country"],
        entity_type=row["entity_type"],
        competent_authority=row["competent_authority"],
        total_assets=(
            str(row["total_assets"]) if row.get("total_assets") is not None else None
        ),
        total_assets_currency=row.get("total_assets_currency"),
    )


def fetch_entity_branches(workspace_id: str, client: Client) -> list[EntityBranch]:
    """All branches for a workspace, in no particular order (zero or more)."""
    resp = (
        client.table("entity_branches")
        .select("branch_code, name, country")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return [
        EntityBranch(branch_code=r["branch_code"], name=r["name"], country=r["country"])
        for r in (resp.data or [])
    ]


# ---------------------------------------------------------------------------
# CSV builders (pure -- take already-fetched data)
# ---------------------------------------------------------------------------


def _writer_with_header(header: list[str]) -> tuple[io.StringIO, Any]:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(header)
    return out, writer


def build_b0101_csv(profile: EntityProfile | None) -> str:
    """B_01.01 -- the entity maintaining the register. Zero rows if no
    profile is configured yet; exactly one row otherwise."""
    out, writer = _writer_with_header(
        ["lei", "name", "country", "entity_type", "competent_authority"]
    )
    if profile:
        writer.writerow(
            [
                profile.lei,
                profile.name,
                profile.country,
                profile.entity_type,
                profile.competent_authority,
            ]
        )
    return out.getvalue()


def build_b0102_csv(profile: EntityProfile | None) -> str:
    """B_01.02 -- entities within scope of the register. Mirrors B_01.01
    for a standalone filer (the only case supported today); hierarchy is
    always "Entities other than entities of the group" and parent LEI
    stays blank until real multi-entity group support exists."""
    out, writer = _writer_with_header(
        [
            "lei",
            "name",
            "country",
            "entity_type",
            "hierarchy",
            "lei_of_direct_parent",
            "total_assets",
            "total_assets_currency",
        ]
    )
    if profile:
        writer.writerow(
            [
                profile.lei,
                profile.name,
                profile.country,
                profile.entity_type,
                _STANDALONE_HIERARCHY_VALUE,
                "",
                profile.total_assets or "",
                profile.total_assets_currency or "",
            ]
        )
    return out.getvalue()


def build_b0103_csv(profile: EntityProfile | None, branches: list[EntityBranch]) -> str:
    """B_01.03 -- branches. Zero or more rows; requires a profile to exist
    since every branch row carries its head office's LEI."""
    out, writer = _writer_with_header(["branch_code", "lei_of_head_office", "name", "country"])
    if profile:
        for branch in branches:
            writer.writerow([branch.branch_code, profile.lei, branch.name, branch.country])
    return out.getvalue()


def build_b0203_csv() -> str:
    """B_02.03 -- intra-group contractual arrangements. Always empty --
    no intra-group arrangements can exist without real multi-entity group
    support, which is deliberately out of scope for now."""
    out, _writer = _writer_with_header(
        [
            "intra_group_contractual_arrangement_reference_number",
            "linked_third_party_contractual_arrangement_reference_number",
        ]
    )
    return out.getvalue()


def build_b0301_csv(
    profile: EntityProfile | None, docs: list[ExportableDocument]
) -> str:
    """B_03.01 -- entities signing arrangements to receive ICT services.
    One row per exported document: the filer's own entity signs every
    arrangement (there is only one possible signer without multi-entity
    group support)."""
    out, writer = _writer_with_header(
        ["contractual_arrangement_reference_number", "lei_of_signing_entity"]
    )
    if profile:
        for doc in docs:
            effective = compute_effective_values(doc.extracted, doc.reviews)
            writer.writerow([effective.get(_ARRANGEMENT_REF_CODE) or "", profile.lei])
    return out.getvalue()


def build_b0302_csv(docs: list[ExportableDocument]) -> str:
    """B_03.02 -- third-party service providers signing arrangements to
    provide ICT services. One row per exported document, entirely from
    that document's own B_05.01 provider fields -- no entity profile
    needed, so this populates independently of whether one exists."""
    out, writer = _writer_with_header(
        [
            "contractual_arrangement_reference_number",
            "identification_code_of_provider",
            "type_of_code_of_provider",
        ]
    )
    for doc in docs:
        effective = compute_effective_values(doc.extracted, doc.reviews)
        writer.writerow(
            [
                effective.get(_ARRANGEMENT_REF_CODE) or "",
                effective.get(_PROVIDER_ID_CODE) or "",
                effective.get(_PROVIDER_ID_TYPE_CODE) or "",
            ]
        )
    return out.getvalue()


def build_b0303_csv() -> str:
    """B_03.03 -- entities signing intra-group arrangements to provide ICT
    services. Always empty, same reason as B_02.03."""
    out, _writer = _writer_with_header(
        ["contractual_arrangement_reference_number", "lei_of_intra_group_entity"]
    )
    return out.getvalue()


def build_b0401_csv(
    profile: EntityProfile | None, docs: list[ExportableDocument]
) -> str:
    """B_04.01 -- entities making use of the ICT services. One row per
    exported document: the filer's own entity uses every service directly,
    not via a branch, by default."""
    out, writer = _writer_with_header(
        [
            "contractual_arrangement_reference_number",
            "lei_of_financial_entity",
            "is_branch",
            "branch_identification_code",
        ]
    )
    if profile:
        for doc in docs:
            effective = compute_effective_values(doc.extracted, doc.reviews)
            writer.writerow([effective.get(_ARRANGEMENT_REF_CODE) or "", profile.lei, "No", ""])
    return out.getvalue()
