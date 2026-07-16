"""Unit tests for the pure builders in entity_export.py (Full RoI Stage 2B).

fetch_entity_profile()/fetch_entity_branches() need a Supabase client and
are not unit-tested here -- same reasoning as export.py's DB-touching
resolvers (see test_export.py's module docstring). Every builder is
tested both with a populated EntityProfile and with profile=None, since
"no entity profile configured yet" is a real, expected state this module
must degrade gracefully for -- not an edge case.
"""

from app.pipeline.entity_export import (
    EntityBranch,
    EntityProfile,
    build_b0101_csv,
    build_b0102_csv,
    build_b0103_csv,
    build_b0203_csv,
    build_b0301_csv,
    build_b0302_csv,
    build_b0303_csv,
    build_b0401_csv,
)
from app.pipeline.export_types import ExportableDocument

_PROFILE = EntityProfile(
    lei="5493001KJTIIGC8Y1R12",
    name="Acme Payments Ltd",
    country="IE",
    entity_type="Payment institution",
    competent_authority="Central Bank of Ireland",
    total_assets="1000000",
    total_assets_currency="EUR",
)

_BRANCH = EntityBranch(branch_code="BR-001", name="Acme UK Branch", country="GB")

_DOC = ExportableDocument(
    document_id="doc-1",
    document_name="AWS Customer Agreement.pdf",
    document_version_id="ver-1",
    extracted={
        "b_02.01.0010": "CA-1",
        "b_05.01.0010": "PROVIDERLEI000000001",
        "b_05.01.0020": "Legal Entity Identfier (LEI)",
    },
    reviews={},
)


def _rows(csv_text: str) -> list[str]:
    return csv_text.strip().splitlines()


def test_b0101_one_row_when_profile_configured() -> None:
    rows = _rows(build_b0101_csv(_PROFILE))
    assert len(rows) == 2
    assert "5493001KJTIIGC8Y1R12" in rows[1]
    assert "Central Bank of Ireland" in rows[1]


def test_b0101_header_only_when_no_profile() -> None:
    rows = _rows(build_b0101_csv(None))
    assert len(rows) == 1


def test_b0102_mirrors_b0101_and_adds_total_assets() -> None:
    rows = _rows(build_b0102_csv(_PROFILE))
    assert len(rows) == 2
    assert "5493001KJTIIGC8Y1R12" in rows[1]
    assert "1000000" in rows[1]
    assert "EUR" in rows[1]
    assert "Entities other than entities of the group" in rows[1]


def test_b0102_header_only_when_no_profile() -> None:
    rows = _rows(build_b0102_csv(None))
    assert len(rows) == 1


def test_b0103_includes_head_office_lei_per_branch() -> None:
    rows = _rows(build_b0103_csv(_PROFILE, [_BRANCH]))
    assert len(rows) == 2
    assert "BR-001" in rows[1]
    assert "5493001KJTIIGC8Y1R12" in rows[1]  # head office LEI, not the branch's own


def test_b0103_empty_when_no_profile_even_with_branches() -> None:
    """A branch row without a head-office LEI to attach to is meaningless."""
    rows = _rows(build_b0103_csv(None, [_BRANCH]))
    assert len(rows) == 1


def test_b0203_always_header_only() -> None:
    """No intra-group support yet -- this table can never have rows."""
    rows = _rows(build_b0203_csv())
    assert len(rows) == 1


def test_b0303_always_header_only() -> None:
    rows = _rows(build_b0303_csv())
    assert len(rows) == 1


def test_b0301_one_row_per_document_using_profile_lei() -> None:
    rows = _rows(build_b0301_csv(_PROFILE, [_DOC]))
    assert len(rows) == 2
    assert "CA-1" in rows[1]
    assert "5493001KJTIIGC8Y1R12" in rows[1]


def test_b0301_header_only_when_no_profile() -> None:
    rows = _rows(build_b0301_csv(None, [_DOC]))
    assert len(rows) == 1


def test_b0302_populates_independently_of_entity_profile() -> None:
    """B_03.02 needs no entity profile -- it's entirely the document's own
    B_05.01 provider fields."""
    rows = _rows(build_b0302_csv([_DOC]))
    assert len(rows) == 2
    assert "PROVIDERLEI000000001" in rows[1]
    assert "Legal Entity Identfier (LEI)" in rows[1]


def test_b0302_header_only_with_no_documents() -> None:
    rows = _rows(build_b0302_csv([]))
    assert len(rows) == 1


def test_b0401_one_row_per_document_not_a_branch_by_default() -> None:
    rows = _rows(build_b0401_csv(_PROFILE, [_DOC]))
    assert len(rows) == 2
    assert "CA-1" in rows[1]
    assert "5493001KJTIIGC8Y1R12" in rows[1]
    assert "No" in rows[1]


def test_b0401_header_only_when_no_profile() -> None:
    rows = _rows(build_b0401_csv(None, [_DOC]))
    assert len(rows) == 1
