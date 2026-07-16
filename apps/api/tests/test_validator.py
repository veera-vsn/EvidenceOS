"""Unit tests for the deterministic validation rules in validator.py.

Every rule is pure (no DB, no LLM, no network) so these run as plain
function calls against a field_code -> value dict — no fixtures needed.

Field codes match the real EBA DPM 4.0 table structure (B_02.01, B_02.02,
B_05.01, B_06.01) — see field_extractor.py's DORA_FIELDS and
Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md for why these
codes changed from an earlier, incorrect b_01.01/b_02.01/b_03.01 scheme.
"""

from app.pipeline.validator import ValidationResult, validate_fields


def _find(results: list[ValidationResult], field_code: str, rule_id: str) -> ValidationResult:
    """Locate one result by (field_code, rule_id); fails loudly if absent."""
    for r in results:
        if r.field_code == field_code and r.rule_id == rule_id:
            return r
    raise AssertionError(f"No result for field_code={field_code!r} rule_id={rule_id!r}")


# A fully valid set of values — the baseline every test tweaks from.
_VALID_VALUES: dict[str, str | None] = {
    "b_02.01.0010": "CONTRACT-REF-001",
    "b_02.02.0060": "Cloud hosting",
    "b_02.02.0070": "2025-01-01",
    "b_02.02.0080": "2026-01-01",
    "b_02.02.0100": "30",
    "b_02.02.0110": "60",
    "b_02.02.0120": "IE",
    "b_02.02.0170": "Customer PII",
    "b_05.01.0010": "5493001KJTIIGC8Y1R12",
    "b_05.01.0050": "Acme Cloud Ltd",
    "b_05.01.0080": "IE",
    "b_06.01.0030": "Core banking hosting",
    "b_06.01.0050": "critical",
}


def test_fully_valid_document_passes_every_rule() -> None:
    """A well-formed extraction should have no fail/warning results."""
    results = validate_fields(_VALID_VALUES)
    bad = [r for r in results if r.status in ("fail", "warning")]
    assert bad == []


def test_required_field_fails_when_missing() -> None:
    values = {**_VALID_VALUES, "b_02.01.0010": None}
    result = _find(validate_fields(values), "b_02.01.0010", "REQUIRED_FIELD")
    assert result.status == "fail"


def test_required_field_skips_optional_end_date() -> None:
    """End date is allowed to be null (indefinite-term contracts)."""
    values = {**_VALID_VALUES, "b_02.02.0080": None}
    results = validate_fields(values)
    required_results = [r for r in results if r.rule_id == "REQUIRED_FIELD"]
    assert all(r.field_code != "b_02.02.0080" for r in required_results)


def test_date_format_fails_on_malformed_date() -> None:
    values = {**_VALID_VALUES, "b_02.02.0070": "01/01/2025"}
    result = _find(validate_fields(values), "b_02.02.0070", "DATE_FORMAT")
    assert result.status == "fail"


def test_date_format_fails_on_impossible_date() -> None:
    values = {**_VALID_VALUES, "b_02.02.0070": "2025-02-30"}
    result = _find(validate_fields(values), "b_02.02.0070", "DATE_FORMAT")
    assert result.status == "fail"


def test_date_format_skipped_when_missing() -> None:
    values = {**_VALID_VALUES, "b_02.02.0080": None}
    result = _find(validate_fields(values), "b_02.02.0080", "DATE_FORMAT")
    assert result.status == "skipped"


def test_date_logic_fails_when_end_before_start() -> None:
    values = {**_VALID_VALUES, "b_02.02.0070": "2026-01-01", "b_02.02.0080": "2025-01-01"}
    result = _find(validate_fields(values), "b_02.02.0080", "DATE_LOGIC")
    assert result.status == "fail"


def test_date_logic_fails_when_end_equals_start() -> None:
    values = {**_VALID_VALUES, "b_02.02.0070": "2025-01-01", "b_02.02.0080": "2025-01-01"}
    result = _find(validate_fields(values), "b_02.02.0080", "DATE_LOGIC")
    assert result.status == "fail"


def test_date_logic_skipped_when_end_date_missing() -> None:
    values = {**_VALID_VALUES, "b_02.02.0080": None}
    result = _find(validate_fields(values), "b_02.02.0080", "DATE_LOGIC")
    assert result.status == "skipped"


def test_date_logic_skipped_when_dates_malformed() -> None:
    values = {**_VALID_VALUES, "b_02.02.0070": "not-a-date"}
    result = _find(validate_fields(values), "b_02.02.0080", "DATE_LOGIC")
    assert result.status == "skipped"


# NOTICE_PERIOD runs once per side (financial entity vs. ICT provider) —
# two separate official fields, not one combined value. Parametrise across
# both codes to confirm the rule is applied independently to each.


def test_notice_period_fails_on_non_integer() -> None:
    for code in ("b_02.02.0100", "b_02.02.0110"):
        values = {**_VALID_VALUES, code: "thirty days"}
        result = _find(validate_fields(values), code, "NOTICE_PERIOD")
        assert result.status == "fail"


def test_notice_period_fails_on_zero() -> None:
    for code in ("b_02.02.0100", "b_02.02.0110"):
        values = {**_VALID_VALUES, code: "0"}
        result = _find(validate_fields(values), code, "NOTICE_PERIOD")
        assert result.status == "fail"


def test_notice_period_fails_on_negative() -> None:
    for code in ("b_02.02.0100", "b_02.02.0110"):
        values = {**_VALID_VALUES, code: "-5"}
        result = _find(validate_fields(values), code, "NOTICE_PERIOD")
        assert result.status == "fail"


def test_notice_period_passes_on_positive_integer() -> None:
    for code in ("b_02.02.0100", "b_02.02.0110"):
        values = {**_VALID_VALUES, code: "90"}
        result = _find(validate_fields(values), code, "NOTICE_PERIOD")
        assert result.status == "pass"


def test_notice_period_checked_independently_per_side() -> None:
    """A failure on one side must not affect the other side's result."""
    values = {**_VALID_VALUES, "b_02.02.0100": "-5", "b_02.02.0110": "30"}
    results = validate_fields(values)
    fe = _find(results, "b_02.02.0100", "NOTICE_PERIOD")
    provider = _find(results, "b_02.02.0110", "NOTICE_PERIOD")
    assert fe.status == "fail"
    assert provider.status == "pass"


def test_country_code_fails_on_invalid_code() -> None:
    values = {**_VALID_VALUES, "b_02.02.0120": "ZZ"}
    result = _find(validate_fields(values), "b_02.02.0120", "COUNTRY_CODE")
    assert result.status == "fail"


def test_country_code_fails_on_full_country_name() -> None:
    values = {**_VALID_VALUES, "b_05.01.0080": "Ireland"}
    result = _find(validate_fields(values), "b_05.01.0080", "COUNTRY_CODE")
    assert result.status == "fail"


def test_country_code_passes_lowercase_valid_code() -> None:
    """Rule should normalise case before comparing."""
    values = {**_VALID_VALUES, "b_02.02.0120": "ie"}
    result = _find(validate_fields(values), "b_02.02.0120", "COUNTRY_CODE")
    assert result.status == "pass"


def test_lei_format_fails_on_wrong_length() -> None:
    values = {**_VALID_VALUES, "b_05.01.0010": "TOOSHORT"}
    result = _find(validate_fields(values), "b_05.01.0010", "LEI_FORMAT")
    assert result.status == "fail"


def test_lei_format_fails_on_non_alphanumeric() -> None:
    values = {**_VALID_VALUES, "b_05.01.0010": "5493001KJTIIGC8Y1R-2"}
    result = _find(validate_fields(values), "b_05.01.0010", "LEI_FORMAT")
    assert result.status == "fail"


def test_lei_format_skipped_when_missing() -> None:
    """LEI is optional — a missing value should not fail the format rule."""
    values = {**_VALID_VALUES, "b_05.01.0010": None}
    result = _find(validate_fields(values), "b_05.01.0010", "LEI_FORMAT")
    assert result.status == "skipped"


def test_criticality_value_warns_on_unrecognised_term() -> None:
    values = {**_VALID_VALUES, "b_06.01.0050": "somewhat important"}
    result = _find(validate_fields(values), "b_06.01.0050", "CRITICALITY_VALUE")
    assert result.status == "warning"


def test_criticality_value_passes_recognised_term_case_insensitive() -> None:
    values = {**_VALID_VALUES, "b_06.01.0050": "Non-Critical"}
    result = _find(validate_fields(values), "b_06.01.0050", "CRITICALITY_VALUE")
    assert result.status == "pass"
