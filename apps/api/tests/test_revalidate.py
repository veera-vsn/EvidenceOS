"""Unit tests for compute_effective_values() in revalidate.py.

Pure function (no DB, no LLM) -- same no-fixtures style as test_validator.py.

Field codes are arbitrary strings as far as this function is concerned,
but kept in sync with the real DORA_FIELDS codes for readability -- see
Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md for why they
changed from an earlier, incorrect scheme.
"""

from app.pipeline.revalidate import compute_effective_values


def test_approved_field_keeps_extracted_value() -> None:
    extracted = {"b_02.01.0010": "REF-1"}
    reviews = {"b_02.01.0010": {"decision": "approved", "edited_value": None}}
    assert compute_effective_values(extracted, reviews) == {"b_02.01.0010": "REF-1"}


def test_edited_field_uses_edited_value() -> None:
    extracted = {"b_02.01.0010": "REF-1"}
    reviews = {"b_02.01.0010": {"decision": "edited", "edited_value": "REF-CORRECTED"}}
    assert compute_effective_values(extracted, reviews) == {"b_02.01.0010": "REF-CORRECTED"}


def test_rejected_field_becomes_blank() -> None:
    extracted = {"b_02.01.0010": "REF-1"}
    reviews = {"b_02.01.0010": {"decision": "rejected", "edited_value": None}}
    assert compute_effective_values(extracted, reviews) == {"b_02.01.0010": None}


def test_field_with_no_review_falls_back_to_extraction() -> None:
    extracted = {"b_02.01.0010": "REF-1", "b_02.02.0060": None}
    assert compute_effective_values(extracted, {}) == extracted


def test_mixed_fields_each_use_their_own_decision() -> None:
    extracted = {
        "b_02.01.0010": "REF-1",
        "b_02.02.0060": "cloud",
        "b_02.02.0070": "2025-01-01",
    }
    reviews = {
        "b_02.01.0010": {"decision": "approved", "edited_value": None},
        "b_02.02.0060": {"decision": "rejected", "edited_value": None},
        # b_02.02.0070 has no review row -- falls back to extraction.
    }
    assert compute_effective_values(extracted, reviews) == {
        "b_02.01.0010": "REF-1",
        "b_02.02.0060": None,
        "b_02.02.0070": "2025-01-01",
    }
