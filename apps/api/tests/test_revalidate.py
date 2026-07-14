"""Unit tests for compute_effective_values() in revalidate.py.

Pure function (no DB, no LLM) -- same no-fixtures style as test_validator.py.
"""

from app.pipeline.revalidate import compute_effective_values


def test_approved_field_keeps_extracted_value() -> None:
    extracted = {"b_01.01.0010": "REF-1"}
    reviews = {"b_01.01.0010": {"decision": "approved", "edited_value": None}}
    assert compute_effective_values(extracted, reviews) == {"b_01.01.0010": "REF-1"}


def test_edited_field_uses_edited_value() -> None:
    extracted = {"b_01.01.0010": "REF-1"}
    reviews = {"b_01.01.0010": {"decision": "edited", "edited_value": "REF-CORRECTED"}}
    assert compute_effective_values(extracted, reviews) == {"b_01.01.0010": "REF-CORRECTED"}


def test_rejected_field_becomes_blank() -> None:
    extracted = {"b_01.01.0010": "REF-1"}
    reviews = {"b_01.01.0010": {"decision": "rejected", "edited_value": None}}
    assert compute_effective_values(extracted, reviews) == {"b_01.01.0010": None}


def test_field_with_no_review_falls_back_to_extraction() -> None:
    extracted = {"b_01.01.0010": "REF-1", "b_01.01.0020": None}
    assert compute_effective_values(extracted, {}) == extracted


def test_mixed_fields_each_use_their_own_decision() -> None:
    extracted = {
        "b_01.01.0010": "REF-1",
        "b_01.01.0020": "cloud",
        "b_01.01.0030": "2025-01-01",
    }
    reviews = {
        "b_01.01.0010": {"decision": "approved", "edited_value": None},
        "b_01.01.0020": {"decision": "rejected", "edited_value": None},
        # b_01.01.0030 has no review row -- falls back to extraction.
    }
    assert compute_effective_values(extracted, reviews) == {
        "b_01.01.0010": "REF-1",
        "b_01.01.0020": None,
        "b_01.01.0030": "2025-01-01",
    }
