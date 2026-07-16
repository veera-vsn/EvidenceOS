"""Unit tests for the deterministic validation rules in validator.py.

Every rule is pure (no DB, no LLM, no network) so these run as plain
function calls against a field_code -> value dict — no fixtures needed.

Field codes match the real EBA DPM 4.0 table structure (B_02.01, B_02.02,
B_05.01, B_06.01) — see field_extractor.py's DORA_FIELDS and
Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md for why these
codes changed from an earlier, incorrect b_01.01/b_02.01/b_03.01 scheme.

Full RoI Stage 1 (Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/) expanded
the catalogue from 13 to all 44 real columns of these same 4 tables and
replaced the 7 hand-approximated rule types with the real EBA business
rules (completeness groups, conditional pairs, allowed-value sets) sourced
directly from EBA's own validation-rules and dropdown-values workbooks.
"""

from app.pipeline.validator import ValidationResult, validate_fields


def _find(results: list[ValidationResult], field_code: str, rule_id: str) -> ValidationResult:
    """Locate one result by (field_code, rule_id); fails loudly if absent."""
    for r in results:
        if r.field_code == field_code and r.rule_id == rule_id:
            return r
    raise AssertionError(f"No result for field_code={field_code!r} rule_id={rule_id!r}")


# A fully valid set of values — the baseline every test tweaks from. Every
# field in a completeness group (see validator.py's _COMPLETENESS_GROUPS)
# is filled, since a partially-filled group would itself produce fails.
_VALID_VALUES: dict[str, str | None] = {
    "b_02.01.0010": "CONTRACT-REF-001",
    "b_02.01.0020": "Standalone arrangement",
    "b_02.01.0030": "MASTER-REF-001",
    "b_02.01.0040": "EUR",
    "b_02.01.0050": "50000",
    "b_02.02.0040": "Legal Entity Identfier (LEI)",
    "b_02.02.0060": "Cloud hosting",
    "b_02.02.0070": "2025-01-01",
    "b_02.02.0080": "2026-01-01",
    "b_02.02.0090": "Termination not for cause: expired and not renewed",
    "b_02.02.0100": "30",
    "b_02.02.0110": "60",
    "b_02.02.0120": "IE",
    "b_02.02.0140": "Yes",
    "b_02.02.0170": "High",
    "b_02.02.0180": "Full reliance",
    "b_05.01.0010": "5493001KJTIIGC8Y1R12",
    "b_05.01.0020": "Legal Entity Identfier (LEI)",
    "b_05.01.0030": "ALT-CODE-001",
    "b_05.01.0040": "National code",
    "b_05.01.0050": "Acme Cloud Ltd",
    "b_05.01.0060": "Acme Cloud Ltd",
    "b_05.01.0070": "Legal person, excluding individual acting in a business capacity",
    "b_05.01.0080": "IE",
    "b_05.01.0090": "EUR",
    "b_05.01.0100": "100000",
    "b_05.01.0110": "549300ABCDEFGHIJ1234",
    "b_05.01.0120": "Legal Entity Identfier (LEI)",
    "b_06.01.0020": "Portfolio management on crypto-assets",
    "b_06.01.0030": "Core banking hosting",
    "b_06.01.0050": "Yes",
    "b_06.01.0060": "Supports critical payment processing",
    "b_06.01.0070": "2025-06-01",
    "b_06.01.0080": "4",
    "b_06.01.0090": "1",
    "b_06.01.0100": "High",
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
    """EBA's own dropdown list for B_06.01.0050 has exactly 3 values:
    Assessment not performed / Yes / No — not the broader invented set an
    earlier version of this check used."""
    values = {**_VALID_VALUES, "b_06.01.0050": "ASSESSMENT NOT PERFORMED"}
    result = _find(validate_fields(values), "b_06.01.0050", "CRITICALITY_VALUE")
    assert result.status == "pass"


# --- COMPLETENESS_GROUP -----------------------------------------------------
# "if any column in the group is filled, every column in the group must be" —
# implements the real EBA rotated per-column rules (e.g. v8850_m..v8855_m
# for B_05.01) as one check per table.


def test_completeness_group_skipped_when_entire_group_empty() -> None:
    """A provider with only its two flat-required identity fields known —
    none of B_05.01's other 10 columns filled — is not a compliance
    problem, just nothing entered for that cluster."""
    values = {
        "b_02.01.0010": "CONTRACT-REF-001",
        "b_02.02.0060": "Cloud hosting",
    }
    results = validate_fields(values)
    group_results = [r for r in results if r.rule_id == "COMPLETENESS_GROUP"]
    assert all(r.status == "skipped" for r in group_results)


def test_completeness_group_fails_remaining_fields_when_one_filled() -> None:
    """Filling only the provider's name (one B_05.01 group member) must
    fail every other member of that same group."""
    values = {**_VALID_VALUES, "b_05.01.0020": None, "b_05.01.0030": None}
    results = validate_fields(values)
    assert _find(results, "b_05.01.0020", "COMPLETENESS_GROUP").status == "fail"
    assert _find(results, "b_05.01.0030", "COMPLETENESS_GROUP").status == "fail"
    # A sibling table's group is unaffected by B_05.01 being incomplete.
    assert _find(results, "b_06.01.0060", "COMPLETENESS_GROUP").status == "pass"


def test_completeness_group_passes_when_fully_filled() -> None:
    results = validate_fields(_VALID_VALUES)
    group_results = [r for r in results if r.rule_id == "COMPLETENESS_GROUP"]
    assert all(r.status == "pass" for r in group_results)


def test_completeness_group_excludes_members_from_required_field() -> None:
    """A field inside a completeness group must not also appear as a flat
    REQUIRED_FIELD result — its requiredness is conditional, not absolute."""
    results = validate_fields({})
    required_codes = {r.field_code for r in results if r.rule_id == "REQUIRED_FIELD"}
    assert "b_05.01.0050" not in required_codes  # part of the B_05.01 group


# --- CONDITIONAL_REQUIRED ---------------------------------------------------


def test_conditional_required_fails_when_trigger_met_but_target_blank() -> None:
    values = {
        **_VALID_VALUES,
        "b_02.01.0020": "Subsequent or associated arrangement",
        "b_02.01.0030": None,
    }
    result = _find(validate_fields(values), "b_02.01.0030", "CONDITIONAL_REQUIRED")
    assert result.status == "fail"


def test_conditional_required_skipped_when_trigger_not_met() -> None:
    values = {**_VALID_VALUES, "b_02.01.0020": "Standalone arrangement"}
    result = _find(validate_fields(values), "b_02.01.0030", "CONDITIONAL_REQUIRED")
    assert result.status == "skipped"


def test_conditional_required_passes_when_trigger_met_and_target_filled() -> None:
    values = {
        **_VALID_VALUES,
        "b_02.01.0020": "Subsequent or associated arrangement",
        "b_02.01.0030": "MASTER-REF-001",
    }
    result = _find(validate_fields(values), "b_02.01.0030", "CONDITIONAL_REQUIRED")
    assert result.status == "pass"


# --- ALLOWED_VALUE -----------------------------------------------------------


def test_allowed_value_warns_on_unrecognised_term() -> None:
    values = {**_VALID_VALUES, "b_02.02.0170": "extremely sensitive"}
    result = _find(validate_fields(values), "b_02.02.0170", "ALLOWED_VALUE")
    assert result.status == "warning"


def test_allowed_value_passes_recognised_term_case_insensitive() -> None:
    values = {**_VALID_VALUES, "b_02.02.0180": "full reliance"}
    result = _find(validate_fields(values), "b_02.02.0180", "ALLOWED_VALUE")
    assert result.status == "pass"


# --- CURRENCY_FORMAT ---------------------------------------------------------


def test_currency_format_fails_on_non_iso_shape() -> None:
    values = {**_VALID_VALUES, "b_02.01.0040": "Euros"}
    result = _find(validate_fields(values), "b_02.01.0040", "CURRENCY_FORMAT")
    assert result.status == "fail"


def test_currency_format_passes_three_letter_code() -> None:
    values = {**_VALID_VALUES, "b_05.01.0090": "usd"}
    result = _find(validate_fields(values), "b_05.01.0090", "CURRENCY_FORMAT")
    assert result.status == "pass"


# --- NON_NEGATIVE_NUMERIC ----------------------------------------------------


def test_non_negative_numeric_fails_on_negative() -> None:
    values = {**_VALID_VALUES, "b_02.01.0050": "-100"}
    result = _find(validate_fields(values), "b_02.01.0050", "NON_NEGATIVE_NUMERIC")
    assert result.status == "fail"


def test_non_negative_numeric_fails_on_non_numeric() -> None:
    values = {**_VALID_VALUES, "b_02.01.0050": "a lot"}
    result = _find(validate_fields(values), "b_02.01.0050", "NON_NEGATIVE_NUMERIC")
    assert result.status == "fail"


def test_non_negative_numeric_passes_zero() -> None:
    values = {**_VALID_VALUES, "b_02.01.0050": "0"}
    result = _find(validate_fields(values), "b_02.01.0050", "NON_NEGATIVE_NUMERIC")
    assert result.status == "pass"
