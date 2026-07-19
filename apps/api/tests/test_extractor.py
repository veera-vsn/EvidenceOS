"""Accuracy tests for extract_pdf(), covering the 2026-07-19 PyMuPDF ->
pdfplumber swap (AGPL licensing concern -- see extractor.py's docstring
and Project_Docs/AUDIT_2026-07-18.md's Dependency Audit).

Runs the real extractor against the real demo fixture
(tests/fixtures/nimbus_cloud_msa_v3.pdf) rather than a synthetic string --
this is the exact document that fixture's own generator was built to
stress-test for ligature corruption
(tests/fixtures/generate_demo_contract.py), so it is also the right
document to prove the new extractor doesn't reintroduce that class of
bug, or any other content-loss regression, before the swap goes anywhere
near a real customer contract.
"""

from __future__ import annotations

from pathlib import Path

from app.pipeline.extractor import extract_pdf

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "nimbus_cloud_msa_v3.pdf"


def _extract_fixture_text() -> str:
    content = _FIXTURE_PATH.read_bytes()
    return extract_pdf(content).text


def test_extractor_is_pdfplumber() -> None:
    """Regression guard: if this ever silently reverts to 'pymupdf' (e.g.
    a merge conflict resurrecting the commented-out implementation), this
    fails loudly instead of quietly reintroducing the AGPL dependency."""
    result = extract_pdf(_FIXTURE_PATH.read_bytes())
    assert result.extractor == "pdfplumber"


def test_extracts_a_realistic_word_count() -> None:
    result = extract_pdf(_FIXTURE_PATH.read_bytes())
    # PyMuPDF extracted 1060 words from this fixture; pdfplumber should
    # be in the same ballpark, not truncated or empty.
    assert result.word_count > 900


def test_no_ligature_corruption() -> None:
    """The whole reason this fixture's generator avoids PyMuPDF's
    fitz.Story engine: naive text shaping silently substitutes ligature
    glyphs ("ffi" -> U+FB03), corrupting exact-match EBA enum values.
    "Difficult" is one of four literal controlled-vocabulary values for
    b_07.01.0090; this must survive extraction byte-for-byte."""
    text = _extract_fixture_text()
    assert "Difficult" in text
    assert "difficulties in migrating or reintegrating" in text
    # The corrupted forms would replace "ff"/"ffi" with a single ligature
    # character, so the plain ASCII substrings above would silently fail
    # rather than raising -- also assert no ligature codepoints leaked
    # through at all, as a direct check rather than an indirect one.
    for ligature in ("ﬀ", "ﬁ", "ﬂ", "ﬃ"):
        assert ligature not in text


def test_key_dora_field_values_present() -> None:
    """Spot-check a handful of the 61 DORA fields this fixture was
    written to make unambiguously extractable, spanning different
    sections of the document (not just the first page)."""
    text = _extract_fixture_text()
    for expected in (
        "CA-2026-004417",  # b_02.01.0010 — contractual arrangement reference
        "Nimbus",  # provider name, appears throughout
        "180",  # notice-period figure, later in the document
        "4 hours",  # b_05.01 RTO figure
    ):
        assert expected in text
