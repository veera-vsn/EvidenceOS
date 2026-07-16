"""Unit tests for the pure parts of export.py.

determine_export_eligibility() and build_export_zip() need a Supabase
client and are not unit-tested here -- no DB-mocking harness exists
elsewhere in this codebase; they're verified via a manual end-to-end pass
instead (see Phase 6's Learnings doc).

Field codes match the real EBA DPM 4.0 table structure (B_02.01, B_02.02,
B_05.01, B_06.01) -- see Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md
for why these changed from an earlier, incorrect scheme.
"""

from app.pipeline.export import (
    ExcludedDocument,
    ExportableDocument,
    ExportEligibility,
    _build_manifest,
    _build_sources_csv,
    _build_template_csv,
    _template_csv_name,
    build_template_groups,
    fields_for_group,
    is_fully_reviewed,
)


def test_build_template_groups_matches_six_esma_templates() -> None:
    groups = build_template_groups()
    codes = [g.code for g in groups]
    assert codes == ["RT.02.01", "RT.02.02", "RT.05.01", "RT.06.01", "RT.05.02", "RT.07.01"]


def test_fields_for_group_counts_match_dora_fields_catalogue() -> None:
    """Full RoI Stage 1 expanded the first 4 tables to their complete real
    column counts; Stage 2A added B_05.02/B_07.01 (5/17/12/10/6/11 = 61
    fields total)."""
    groups = build_template_groups()
    counts = {g.code: len(fields_for_group(g)) for g in groups}
    assert counts == {
        "RT.02.01": 5,
        "RT.02.02": 17,
        "RT.05.01": 12,
        "RT.06.01": 10,
        "RT.05.02": 6,
        "RT.07.01": 11,
    }


def test_fields_for_group_only_contains_matching_prefix() -> None:
    groups = {g.code: g for g in build_template_groups()}
    codes = [f["code"] for f in fields_for_group(groups["RT.05.01"])]
    assert all(code.startswith("b_05.01") for code in codes)


def test_template_csv_name_format() -> None:
    group = build_template_groups()[0]
    assert _template_csv_name(group) == "RT_02_01_contractual_arrangements_general_info.csv"


def test_is_fully_reviewed_true_when_every_field_has_any_decision() -> None:
    field_codes = ["b_02.01.0010", "b_02.02.0060"]
    reviews = {
        "b_02.01.0010": {"decision": "approved"},
        "b_02.02.0060": {"decision": "rejected"},
    }
    assert is_fully_reviewed(field_codes, reviews) is True


def test_is_fully_reviewed_false_when_a_field_is_missing() -> None:
    field_codes = ["b_02.01.0010", "b_02.02.0060"]
    reviews = {"b_02.01.0010": {"decision": "approved"}}
    assert is_fully_reviewed(field_codes, reviews) is False


def test_is_fully_reviewed_true_for_empty_field_codes() -> None:
    assert is_fully_reviewed([], {}) is True


def test_build_template_csv_uses_effective_values() -> None:
    group = build_template_groups()[1]  # RT.02.02
    doc = ExportableDocument(
        document_id="doc-1",
        document_name="AWS Customer Agreement.pdf",
        document_version_id="ver-1",
        extracted={
            "b_02.02.0060": "cloud",
            "b_02.02.0070": "2025-01-01",
            "b_02.02.0100": "30",
        },
        reviews={
            "b_02.02.0060": {"decision": "edited", "edited_value": "cloud (corrected)"},
            "b_02.02.0070": {"decision": "approved"},
            "b_02.02.0100": {"decision": "rejected"},
        },
    )
    csv_text = _build_template_csv(group, [doc])
    rows = csv_text.strip().splitlines()
    assert "cloud (corrected)" in rows[1]  # edited value wins
    assert "2025-01-01" in rows[1]  # approved value kept
    # Rejected field renders as an empty cell -- the row still has the
    # right number of columns, just no value for that field.
    header = rows[0].split(",")
    data = rows[1].split(",")
    notice_period_idx = header.index("Notice period for termination — financial entity (days)")
    assert data[notice_period_idx] == ""


def test_build_sources_csv_includes_every_catalogue_field_per_document() -> None:
    from app.pipeline.field_extractor import DORA_FIELDS

    doc = ExportableDocument(
        document_id="doc-1",
        document_name="AWS Customer Agreement.pdf",
        document_version_id="ver-1",
        extracted={"b_02.01.0010": "REF-1"},
        reviews={"b_02.01.0010": {"decision": "approved", "reviewed_by": "user-1"}},
    )
    csv_text = _build_sources_csv([doc], reviewer_names={"user-1": "Jane Reviewer"})
    rows = csv_text.strip().splitlines()
    assert len(rows) == len(DORA_FIELDS) + 1  # header + one row per catalogue field
    assert "Jane Reviewer" in rows[1]


def test_build_sources_csv_falls_back_to_raw_id_without_a_profile() -> None:
    doc = ExportableDocument(
        document_id="doc-1",
        document_name="AWS Customer Agreement.pdf",
        document_version_id="ver-1",
        extracted={"b_02.01.0010": "REF-1"},
        reviews={"b_02.01.0010": {"decision": "approved", "reviewed_by": "user-1"}},
    )
    csv_text = _build_sources_csv([doc], reviewer_names={})
    rows = csv_text.strip().splitlines()
    assert "user-1" in rows[1]


def test_build_manifest_includes_disclaimer_and_counts() -> None:
    eligibility = ExportEligibility(
        included=[
            ExportableDocument("doc-1", "Doc A", "ver-1", {}, {}),
        ],
        excluded=[
            ExcludedDocument("doc-2", "Doc B", "incomplete_review"),
        ],
    )
    manifest = _build_manifest("Acme Bank", eligibility, entity_profile_configured=True)
    assert "Documents included: 1" in manifest
    assert "Documents excluded: 1" in manifest
    assert "Doc B (incomplete_review)" in manifest
    assert "NOT a taxonomy-validated xBRL-CSV filing" in manifest
    assert "Entity profile not configured" not in manifest


def test_build_manifest_notes_missing_entity_profile() -> None:
    eligibility = ExportEligibility(included=[], excluded=[])
    manifest = _build_manifest("Acme Bank", eligibility, entity_profile_configured=False)
    assert "Entity profile not configured" in manifest
