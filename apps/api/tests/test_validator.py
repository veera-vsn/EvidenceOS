"""Unit tests for the deterministic validation rules in validator.py.

Every rule is pure (no DB, no LLM, no network) so these run as plain
function calls against a field_code -> value dict — no fixtures needed.
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
    "b_01.01.0010": "CONTRACT-REF-001",
    "b_01.01.0020": "Cloud hosting",
    "b_01.01.0030": "2025-01-01",
    "b_01.01.0040": "2026-01-01",
    "b_01.01.0050": "30",
    "b_01.01.0060": "Irish law",
    "b_01.01.0070": "IE",
    "b_02.01.0010": "Acme Cloud Ltd",
    "b_02.01.0020": "5493001KJTIIGC8Y1R12",
    "b_02.01.0030": "IE",
    "b_03.01.0010": "Core banking hosting",
    "b_03.01.0020": "critical",
    "b_03.01.0030": "Customer PII",
}


def test_fully_valid_document_passes_every_rule() -> None:
    """A well-formed extraction should have no fail/warning results."""
    results = validate_fields(_VALID_VALUES)
    bad = [r for r in results if r.status in ("fail", "warning")]
    assert bad == []


def test_required_field_fails_when_missing() -> None:
    values = {**_VALID_VALUES, "b_01.01.0010": None}
    result = _find(validate_fields(values), "b_01.01.0010", "REQUIRED_FIELD")
    assert result.status == "fail"


def test_required_field_skips_optional_end_date() -> None:
    """End date is allowed to be null (indefinite-term contracts)."""
    values = {**_VALID_VALUES, "b_01.01.0040": None}
    results = validate_fields(values)
    required_results = [r for r in results if r.rule_id == "REQUIRED_FIELD"]
    assert all(r.field_code != "b_01.01.0040" for r in required_results)


def test_date_format_fails_on_malformed_date() -> None:
    values = {**_VALID_VALUES, "b_01.01.0030": "01/01/2025"}
    result = _find(validate_fields(values), "b_01.01.0030", "DATE_FORMAT")
    assert result.status == "fail"


def test_date_format_fails_on_impossible_date() -> None:
    values = {**_VALID_VALUES, "b_01.01.0030": "2025-02-30"}
    result = _find(validate_fields(values), "b_01.01.0030", "DATE_FORMAT")
    assert result.status == "fail"


def test_date_format_skipped_when_missing() -> None:
    values = {**_VALID_VALUES, "b_01.01.0040": None}
    result = _find(validate_fields(values), "b_01.01.0040", "DATE_FORMAT")
    assert result.status == "skipped"


def test_date_logic_fails_when_end_before_start() -> None:
    values = {**_VALID_VALUES, "b_01.01.0030": "2026-01-01", "b_01.01.0040": "2025-01-01"}
    result = _find(validate_fields(values), "b_01.01.0040", "DATE_LOGIC")
    assert result.status == "fail"


def test_date_logic_fails_when_end_equals_start() -> None:
    values = {**_VALID_VALUES, "b_01.01.0030": "2025-01-01", "b_01.01.0040": "2025-01-01"}
    result = _find(validate_fields(values), "b_01.01.0040", "DATE_LOGIC")
    assert result.status == "fail"


def test_date_logic_skipped_when_end_date_missing() -> None:
    values = {**_VALID_VALUES, "b_01.01.0040": None}
    result = _find(validate_fields(values), "b_01.01.0040", "DATE_LOGIC")
    assert result.status == "skipped"


def test_date_logic_skipped_when_dates_malformed() -> None:
    values = {**_VALID_VALUES, "b_01.01.0030": "not-a-date"}
    result = _find(validate_fields(values), "b_01.01.0040", "DATE_LOGIC")
    assert result.status == "skipped"


def test_notice_period_fails_on_non_integer() -> None:
    values = {**_VALID_VALUES, "b_01.01.0050": "thirty days"}
    result = _find(validate_fields(values), "b_01.01.0050", "NOTICE_PERIOD")
    assert result.status == "fail"


def test_notice_period_fails_on_zero() -> None:
    values = {**_VALID_VALUES, "b_01.01.0050": "0"}
    result = _find(validate_fields(values), "b_01.01.0050", "NOTICE_PERIOD")
    assert result.status == "fail"


def test_notice_period_fails_on_negative() -> None:
    values = {**_VALID_VALUES, "b_01.01.0050": "-5"}
    result = _find(validate_fields(values), "b_01.01.0050", "NOTICE_PERIOD")
    assert result.status == "fail"


def test_notice_period_passes_on_positive_integer() -> None:
    values = {**_VALID_VALUES, "b_01.01.0050": "90"}
    result = _find(validate_fields(values), "b_01.01.0050", "NOTICE_PERIOD")
    assert result.status == "pass"


def test_country_code_fails_on_invalid_code() -> None:
    values = {**_VALID_VALUES, "b_01.01.0070": "ZZ"}
    result = _find(validate_fields(values), "b_01.01.0070", "COUNTRY_CODE")
    assert result.status == "fail"


def test_country_code_fails_on_full_country_name() -> None:
    values = {**_VALID_VALUES, "b_02.01.0030": "Ireland"}
    result = _find(validate_fields(values), "b_02.01.0030", "COUNTRY_CODE")
    assert result.status == "fail"


def test_country_code_passes_lowercase_valid_code() -> None:
    """Rule should normalise case before comparing."""
    values = {**_VALID_VALUES, "b_01.01.0070": "ie"}
    result = _find(validate_fields(values), "b_01.01.0070", "COUNTRY_CODE")
    assert result.status == "pass"


def test_lei_format_fails_on_wrong_length() -> None:
    values = {**_VALID_VALUES, "b_02.01.0020": "TOOSHORT"}
    result = _find(validate_fields(values), "b_02.01.0020", "LEI_FORMAT")
    assert result.status == "fail"


def test_lei_format_fails_on_non_alphanumeric() -> None:
    values = {**_VALID_VALUES, "b_02.01.0020": "5493001KJTIIGC8Y1R-2"}
    result = _find(validate_fields(values), "b_02.01.0020", "LEI_FORMAT")
    assert result.status == "fail"


def test_lei_format_skipped_when_missing() -> None:
    """LEI is optional — a missing value should not fail the format rule."""
    values = {**_VALID_VALUES, "b_02.01.0020": None}
    result = _find(validate_fields(values), "b_02.01.0020", "LEI_FORMAT")
    assert result.status == "skipped"


def test_criticality_value_warns_on_unrecognised_term() -> None:
    values = {**_VALID_VALUES, "b_03.01.0020": "somewhat important"}
    result = _find(validate_fields(values), "b_03.01.0020", "CRITICALITY_VALUE")
    assert result.status == "warning"


def test_criticality_value_passes_recognised_term_case_insensitive() -> None:
    values = {**_VALID_VALUES, "b_03.01.0020": "Non-Critical"}
    result = _find(validate_fields(values), "b_03.01.0020", "CRITICALITY_VALUE")
    assert result.status == "pass"
