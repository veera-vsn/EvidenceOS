"""Deterministic validation of extracted DORA RoI fields.

Stage C of the pipeline. Runs after field extraction and applies rule-based
checks only — no LLM calls. Per CLAUDE.md's determinism gate, anything that
decides "compliant / non-compliant" must be rule-based and testable; the LLM
in field_extractor.py may find values, but only this module may pass or fail
them.

Each rule takes the map of field_code -> extracted_value produced by Stage B
and returns one ValidationResult per field it examines. A field with no
extracted value is 'skipped' for format/logic rules (there is nothing to
check) but may still 'fail' REQUIRED_FIELD if it is mandatory.

Reference:
  ESMA/EBA/EIOPA Joint ITS on DORA RoI (2024) — quality check rules RR.01
  through RR.20 that this module approximates for the fields we extract.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.pipeline.field_extractor import DORA_FIELDS

ValidationStatus = Literal["pass", "fail", "warning", "skipped"]


@dataclass
class ValidationResult:
    """Outcome of a single deterministic rule check on one field."""

    field_code: str
    rule_id: str
    rule_label: str
    status: ValidationStatus
    message: str | None = None


# ---------------------------------------------------------------------------
# Field-level configuration
# ---------------------------------------------------------------------------

# Fields where a legitimate business reason justifies a null extracted value.
# Every other code in DORA_FIELDS is required — a null value fails
# REQUIRED_FIELD.
_OPTIONAL_FIELD_CODES: frozenset[str] = frozenset(
    {
        "b_02.02.0080",  # End date — indefinite-term contracts have none.
        "b_05.01.0010",  # LEI — not every provider has one issued yet.
    }
)

_DATE_FIELD_CODES = ("b_02.02.0070", "b_02.02.0080")
_START_DATE_CODE, _END_DATE_CODE = _DATE_FIELD_CODES
# Two separate official fields (financial-entity side, provider side) —
# EBA table B_02.02 columns 0100/0110, not one combined field.
_NOTICE_PERIOD_CODES = ("b_02.02.0100", "b_02.02.0110")
_COUNTRY_CODE_FIELDS = ("b_02.02.0120", "b_05.01.0080")
_LEI_CODE = "b_05.01.0010"
_CRITICALITY_CODE = "b_06.01.0050"

_LEI_PATTERN = re.compile(r"^[A-Z0-9]{20}$")

_ALLOWED_CRITICALITY_VALUES = {
    "critical",
    "non-critical",
    "noncritical",
    "important",
    "not important",
    "yes",
    "no",
}

# ISO 3166-1 alpha-2 officially assigned country codes.
# A list literal of 249 codes is harder to scan than this block, hence noqa.
ISO_3166_1_ALPHA_2: frozenset[str] = frozenset(
    """
    AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
    BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
    CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
    DE DJ DK DM DO DZ
    EC EE EG EH ER ES ET
    FI FJ FK FM FO FR
    GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
    HK HM HN HR HT HU
    ID IE IL IM IN IO IQ IR IS IT
    JE JM JO JP
    KE KG KH KI KM KN KP KR KW KY KZ
    LA LB LC LI LK LR LS LT LU LV LY
    MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
    NA NC NE NF NG NI NL NO NP NR NU NZ
    OM
    PA PE PF PG PH PK PL PM PN PR PS PT PW PY
    QA
    RE RO RS RU RW
    SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
    TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
    UA UG UM US UY UZ
    VA VC VE VG VI VN VU
    WF WS
    YE YT
    ZA ZM ZW
    """.split()  # noqa: SIM905
)


def _is_blank(value: str | None) -> bool:
    """True if *value* is None or contains only whitespace."""
    return value is None or not value.strip()


def _check_required_fields(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """REQUIRED_FIELD — every mandatory DORA field must have a value."""
    results: list[ValidationResult] = []
    for field in DORA_FIELDS:
        code = field["code"]
        if code in _OPTIONAL_FIELD_CODES:
            continue
        if _is_blank(values.get(code)):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="REQUIRED_FIELD",
                    rule_label="Required field must be present",
                    status="fail",
                    message=f"{field['label']} is required but was not extracted.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="REQUIRED_FIELD",
                    rule_label="Required field must be present",
                    status="pass",
                )
            )
    return results


def _check_date_format(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """DATE_FORMAT — start/end dates must be valid YYYY-MM-DD (ISO 8601)."""
    results: list[ValidationResult] = []
    for code in _DATE_FIELD_CODES:
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="DATE_FORMAT",
                    rule_label="Date must be YYYY-MM-DD",
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        stripped = value.strip()
        try:
            date.fromisoformat(stripped)
        except ValueError:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="DATE_FORMAT",
                    rule_label="Date must be YYYY-MM-DD",
                    status="fail",
                    message=f"'{value}' is not a valid YYYY-MM-DD date.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="DATE_FORMAT",
                    rule_label="Date must be YYYY-MM-DD",
                    status="pass",
                )
            )
    return results


def _check_date_logic(values: Mapping[str, str | None]) -> ValidationResult:
    """DATE_LOGIC — end date must fall after start date (cross-field).

    Attached to the end-date field code, since that is the value that would
    need correcting. Skipped (not failed) when either date is missing or
    malformed — DATE_FORMAT already reports the format problem.
    """
    start_raw, end_raw = values.get(_START_DATE_CODE), values.get(_END_DATE_CODE)
    if _is_blank(start_raw) or _is_blank(end_raw):
        return ValidationResult(
            field_code=_END_DATE_CODE,
            rule_id="DATE_LOGIC",
            rule_label="End date must be after start date",
            status="skipped",
            message="Start or end date is missing.",
        )

    assert start_raw is not None and end_raw is not None
    try:
        start = date.fromisoformat(start_raw.strip())
        end = date.fromisoformat(end_raw.strip())
    except ValueError:
        return ValidationResult(
            field_code=_END_DATE_CODE,
            rule_id="DATE_LOGIC",
            rule_label="End date must be after start date",
            status="skipped",
            message="Start or end date is not a valid date.",
        )

    if end <= start:
        return ValidationResult(
            field_code=_END_DATE_CODE,
            rule_id="DATE_LOGIC",
            rule_label="End date must be after start date",
            status="fail",
            message=f"End date {end.isoformat()} is not after start date {start.isoformat()}.",
        )
    return ValidationResult(
        field_code=_END_DATE_CODE,
        rule_id="DATE_LOGIC",
        rule_label="End date must be after start date",
        status="pass",
    )


def _check_notice_period(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """NOTICE_PERIOD — termination notice period must be a positive integer.

    Runs once per side (financial entity, ICT provider) — these are two
    separate official fields (EBA table B_02.02 columns 0100/0110), not one
    combined value.
    """
    results: list[ValidationResult] = []
    for code in _NOTICE_PERIOD_CODES:
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NOTICE_PERIOD",
                    rule_label="Notice period must be a positive integer",
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        try:
            days = int(value.strip())
        except ValueError:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NOTICE_PERIOD",
                    rule_label="Notice period must be a positive integer",
                    status="fail",
                    message=f"'{value}' is not an integer.",
                )
            )
            continue

        if days <= 0:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NOTICE_PERIOD",
                    rule_label="Notice period must be a positive integer",
                    status="fail",
                    message=f"Notice period must be positive, got {days}.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NOTICE_PERIOD",
                    rule_label="Notice period must be a positive integer",
                    status="pass",
                )
            )
    return results


def _check_country_codes(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """COUNTRY_CODE — governing-law and provider countries must be ISO 3166-1 alpha-2."""
    results: list[ValidationResult] = []
    for code in _COUNTRY_CODE_FIELDS:
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="COUNTRY_CODE",
                    rule_label="Must be ISO 3166-1 alpha-2",
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        candidate = value.strip().upper()
        if candidate not in ISO_3166_1_ALPHA_2:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="COUNTRY_CODE",
                    rule_label="Must be ISO 3166-1 alpha-2",
                    status="fail",
                    message=f"'{value}' is not a valid ISO 3166-1 alpha-2 code.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="COUNTRY_CODE",
                    rule_label="Must be ISO 3166-1 alpha-2",
                    status="pass",
                )
            )
    return results


def _check_lei_format(values: Mapping[str, str | None]) -> ValidationResult:
    """LEI_FORMAT — Legal Entity Identifier must be 20 alphanumeric characters."""
    value = values.get(_LEI_CODE)
    if _is_blank(value):
        return ValidationResult(
            field_code=_LEI_CODE,
            rule_id="LEI_FORMAT",
            rule_label="Must be 20 alphanumeric characters",
            status="skipped",
            message="No value to validate.",
        )

    assert value is not None
    candidate = value.strip().upper()
    if not _LEI_PATTERN.match(candidate):
        return ValidationResult(
            field_code=_LEI_CODE,
            rule_id="LEI_FORMAT",
            rule_label="Must be 20 alphanumeric characters",
            status="fail",
            message=f"'{value}' is not 20 alphanumeric characters.",
        )
    return ValidationResult(
        field_code=_LEI_CODE,
        rule_id="LEI_FORMAT",
        rule_label="Must be 20 alphanumeric characters",
        status="pass",
    )


def _check_criticality_value(values: Mapping[str, str | None]) -> ValidationResult:
    """CRITICALITY_VALUE — criticality assessment must use a recognised term.

    A 'warning' rather than 'fail' — this is LLM-extracted free text and a
    reviewer may accept a phrasing outside the recognised set, so it should
    not silently block the field the way a malformed date or LEI would.
    """
    value = values.get(_CRITICALITY_CODE)
    if _is_blank(value):
        return ValidationResult(
            field_code=_CRITICALITY_CODE,
            rule_id="CRITICALITY_VALUE",
            rule_label="Should use a recognised criticality term",
            status="skipped",
            message="No value to validate.",
        )

    assert value is not None
    candidate = value.strip().lower()
    if candidate not in _ALLOWED_CRITICALITY_VALUES:
        return ValidationResult(
            field_code=_CRITICALITY_CODE,
            rule_id="CRITICALITY_VALUE",
            rule_label="Should use a recognised criticality term",
            status="warning",
            message=f"'{value}' is not one of the recognised criticality values.",
        )
    return ValidationResult(
        field_code=_CRITICALITY_CODE,
        rule_id="CRITICALITY_VALUE",
        rule_label="Should use a recognised criticality term",
        status="pass",
    )


def validate_fields(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """Run every deterministic rule over one document's extracted fields.

    Args:
        values: Map of field_code -> extracted_value, as read back from the
            extraction_results table for a single document_version.

    Returns:
        One ValidationResult per (field_code, rule_id) pair examined. Fields
        untouched by any rule (e.g. free-text fields with no format check)
        produce no rows.
    """
    results: list[ValidationResult] = []
    results.extend(_check_required_fields(values))
    results.extend(_check_date_format(values))
    results.append(_check_date_logic(values))
    results.extend(_check_notice_period(values))
    results.extend(_check_country_codes(values))
    results.append(_check_lei_format(values))
    results.append(_check_criticality_value(values))
    return results
