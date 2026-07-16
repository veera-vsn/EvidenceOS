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
  Full RoI Stage 1 (Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/) replaced
  the earlier hand-approximated rule set with the real EBA DORA validation
  rules, sourced directly from EBA's own validation-rules workbook (filtered
  to the DORA framework: 71 total rules, 58 active, 34 applying to the 4
  tables this module covers). Most of those 34 resolve into one shape —
  "if any column in this set is filled, every column in the set must be" —
  which EBA expresses as N rotated per-column rules but which this module
  implements once per table as a completeness group
  (see _COMPLETENESS_GROUPS). A few are conditional pairs
  (_CONDITIONAL_PAIRS) or simple value/range checks. Enum "allowed value"
  sets come from EBA's own "List of possible values for all data fields
  with drop downs" workbook, not invented.
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

# Fields where a legitimate business reason justifies a null extracted value
# and no real EBA completeness/conditional rule governs them (see
# _COMPLETENESS_GROUPS below for the fields whose requiredness is instead
# conditional on their group). Every other code in DORA_FIELDS not covered
# by a group is unconditionally required — a null value fails REQUIRED_FIELD.
_OPTIONAL_FIELD_CODES: frozenset[str] = frozenset(
    {
        "b_05.01.0010",  # LEI of the provider — not every provider has one issued yet.
        "b_02.02.0020",  # LEI of the financial entity — rarely restated in a vendor contract.
        "b_02.02.0030",  # Provider ID code — redundant with the provider register.
        "b_02.02.0050",  # Function identifier — a cross-reference, not contract text.
        "b_02.02.0130",  # Country of provision — not always disclosed.
        "b_02.02.0150",  # Location of data at rest — not always disclosed.
        "b_02.02.0160",  # Location of data processing — not always disclosed.
        "b_06.01.0040",  # LEI of the financial entity — same reason as above.
        "b_06.01.0010",  # Function identifier — an internal reference, not contract text.
    }
)

_DATE_FIELD_CODES = ("b_02.02.0070", "b_02.02.0080", "b_06.01.0070")
_START_DATE_CODE, _END_DATE_CODE = "b_02.02.0070", "b_02.02.0080"
# Two separate official fields (financial-entity side, provider side) —
# EBA table B_02.02 columns 0100/0110, not one combined field.
_NOTICE_PERIOD_CODES = ("b_02.02.0100", "b_02.02.0110")
_COUNTRY_CODE_FIELDS = (
    "b_02.02.0120",
    "b_02.02.0130",
    "b_02.02.0150",
    "b_02.02.0160",
    "b_05.01.0080",
)
# LEI-shaped identifier fields across all 4 tables.
_LEI_FIELD_CODES = (
    "b_05.01.0010",
    "b_02.02.0020",
    "b_05.01.0110",
    "b_06.01.0040",
)
_CRITICALITY_CODE = "b_06.01.0050"

_LEI_PATTERN = re.compile(r"^[A-Z0-9]{20}$")

# EBA's own dropdown list for B_06.01 column 0050 has exactly these 3
# values ("List of possible values..." workbook, sheet B0601) — an earlier
# version of this check used an invented, broader set (critical/important/
# etc.) that doesn't match the real DPM value set.
_ALLOWED_CRITICALITY_VALUES = {"assessment not performed", "yes", "no"}

# ISO 4217 is not enumerated here (250+ codes, not worth the duplication
# risk of ISO_3166_1_ALPHA_2 below) — format-checked as 3 uppercase
# letters instead. A scoped simplification, not a fabricated full list.
_CURRENCY_FIELD_CODES = ("b_02.01.0040", "b_05.01.0090")
_CURRENCY_PATTERN = re.compile(r"^[A-Z]{3}$")

_NON_NEGATIVE_NUMERIC_CODES = ("b_02.01.0050",)

# Enum "allowed value" sets — literal values from EBA's "List of possible
# values for all data fields with drop downs" workbook (3 March 2025),
# lower-cased for case-insensitive comparison. Warning, not fail, for the
# same reason as CRITICALITY_VALUE below: these are LLM-extracted free
# text and a reviewer may accept a phrasing outside the recognised set.
_ALLOWED_VALUES: dict[str, frozenset[str]] = {
    "b_02.01.0020": frozenset(
        {
            "standalone arrangement",
            "overarching arrangement",
            "subsequent or associated arrangement",
        }
    ),
    "b_02.02.0090": frozenset(
        {
            "termination not for cause: expired and not renewed",
            (
                "termination for cause: provider in breach of applicable "
                "law, regulations or contractual provisions"
            ),
            (
                "termination for cause: identified impediments of the "
                "provider capable of altering the supported function"
            ),
            (
                "termination for cause: provider's weaknesses regarding "
                "the management and security of sensitive data or information"
            ),
            "termination: as requested by the competent authority",
            "other reasons for termination",
        }
    ),
    "b_02.02.0140": frozenset({"yes", "no"}),
    "b_02.02.0170": frozenset({"low", "medium", "high"}),
    "b_02.02.0180": frozenset(
        {"not significant", "low reliance", "material reliance", "full reliance"}
    ),
    "b_05.01.0070": frozenset(
        {
            "legal person, excluding individual acting in a business capacity",
            "individual acting in a business capacity",
        }
    ),
    "b_06.01.0100": frozenset({"low", "medium", "high", "assessment not performed"}),
}

# The 34 real EBA business rules for these 4 tables collapse into two
# shapes. Most are completeness groups: "if any column in this set is
# filled, every column in the set must be" — EBA expresses this as one
# rotated rule per column (e.g. v8850_m..v8855_m for B_05.01); this module
# implements it once per table from the union of columns those rotations
# touch. A field inside a group is excluded from flat REQUIRED_FIELD
# (see _check_required_fields) since its requiredness is conditional, not
# absolute.
_COMPLETENESS_GROUPS: dict[str, tuple[str, ...]] = {
    "B_02.01": ("b_02.01.0020", "b_02.01.0030", "b_02.01.0040", "b_02.01.0050"),
    "B_02.02": (
        "b_02.02.0040",
        "b_02.02.0070",
        "b_02.02.0080",
        "b_02.02.0090",
        "b_02.02.0100",
        "b_02.02.0110",
        "b_02.02.0120",
        "b_02.02.0140",
        "b_02.02.0170",
        "b_02.02.0180",
    ),
    "B_05.01": (
        "b_05.01.0020",
        "b_05.01.0030",
        "b_05.01.0040",
        "b_05.01.0050",
        "b_05.01.0060",
        "b_05.01.0070",
        "b_05.01.0080",
        "b_05.01.0090",
        "b_05.01.0100",
        "b_05.01.0110",
        "b_05.01.0120",
    ),
    "B_06.01": (
        "b_06.01.0020",
        "b_06.01.0030",
        "b_06.01.0050",
        "b_06.01.0060",
        "b_06.01.0070",
        "b_06.01.0080",
        "b_06.01.0090",
        "b_06.01.0100",
    ),
}
_ALL_GROUPED_CODES: frozenset[str] = frozenset(
    code for codes in _COMPLETENESS_GROUPS.values() for code in codes
)

# The one clear conditional-pair rule for these 4 tables (v8805_m/v22912_m):
# if the arrangement type is "subsequent or associated", the overarching
# arrangement reference number becomes required.
_CONDITIONAL_PAIRS: tuple[tuple[str, str, str], ...] = (
    ("b_02.01.0020", "subsequent or associated arrangement", "b_02.01.0030"),
)

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
        if code in _OPTIONAL_FIELD_CODES or code in _ALL_GROUPED_CODES:
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


def _check_lei_format(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """LEI_FORMAT — every LEI-shaped field must be 20 alphanumeric characters.

    Runs once per LEI field across all 4 tables (provider LEI, financial
    entity LEI on two different tables, provider's ultimate parent LEI) —
    same rule, four independent fields.
    """
    results: list[ValidationResult] = []
    for code in _LEI_FIELD_CODES:
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="LEI_FORMAT",
                    rule_label="Must be 20 alphanumeric characters",
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        candidate = value.strip().upper()
        if not _LEI_PATTERN.match(candidate):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="LEI_FORMAT",
                    rule_label="Must be 20 alphanumeric characters",
                    status="fail",
                    message=f"'{value}' is not 20 alphanumeric characters.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="LEI_FORMAT",
                    rule_label="Must be 20 alphanumeric characters",
                    status="pass",
                )
            )
    return results


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


def _check_completeness_groups(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """COMPLETENESS_GROUP — a table's optional-but-jointly-required columns.

    Implements the real EBA "if any of these columns is filled, all of them
    must be" pattern (see _COMPLETENESS_GROUPS): if every field in the group
    is blank, all are 'skipped' (nothing entered for this cluster at all —
    not a compliance problem, e.g. the provider register's optional detail
    columns for a provider with only the core identity known). If at least
    one is filled, every blank field in the group 'fails'.
    """
    results: list[ValidationResult] = []
    for table, codes in _COMPLETENESS_GROUPS.items():
        rule_label = f"{table}: fields must be completed together, or not at all"
        filled = [c for c in codes if not _is_blank(values.get(c))]
        if not filled:
            for code in codes:
                results.append(
                    ValidationResult(
                        field_code=code,
                        rule_id="COMPLETENESS_GROUP",
                        rule_label=rule_label,
                        status="skipped",
                        message="No value to validate.",
                    )
                )
            continue

        for code in codes:
            if _is_blank(values.get(code)):
                results.append(
                    ValidationResult(
                        field_code=code,
                        rule_id="COMPLETENESS_GROUP",
                        rule_label=rule_label,
                        status="fail",
                        message=(
                            f"A related {table} field is filled in, so this "
                            "field is also required."
                        ),
                    )
                )
            else:
                results.append(
                    ValidationResult(
                        field_code=code,
                        rule_id="COMPLETENESS_GROUP",
                        rule_label=rule_label,
                        status="pass",
                    )
                )
    return results


def _check_conditional_pairs(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """CONDITIONAL_REQUIRED — a field required only when another field holds a specific value.

    E.g. EBA rule v8805_m: if the contractual-arrangement type is
    "subsequent or associated arrangement", the overarching arrangement
    reference number becomes mandatory.
    """
    results: list[ValidationResult] = []
    rule_label = "Required because of a related field's value"
    for if_code, if_value, then_code in _CONDITIONAL_PAIRS:
        trigger = values.get(if_code)
        if _is_blank(trigger) or trigger.strip().lower() != if_value:
            results.append(
                ValidationResult(
                    field_code=then_code,
                    rule_id="CONDITIONAL_REQUIRED",
                    rule_label=rule_label,
                    status="skipped",
                    message="Condition not met.",
                )
            )
            continue

        then_val = values.get(then_code)
        if _is_blank(then_val):
            results.append(
                ValidationResult(
                    field_code=then_code,
                    rule_id="CONDITIONAL_REQUIRED",
                    rule_label=rule_label,
                    status="fail",
                    message=f"Required because {if_code} is '{trigger}'.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=then_code,
                    rule_id="CONDITIONAL_REQUIRED",
                    rule_label=rule_label,
                    status="pass",
                )
            )
    return results


def _check_allowed_values(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """ALLOWED_VALUE — enum-shaped fields should use one of EBA's dropdown values.

    Warning, not fail — these are LLM-extracted free text and a reviewer may
    accept a phrasing outside the recognised set (same reasoning as the
    pre-existing CRITICALITY_VALUE check).
    """
    results: list[ValidationResult] = []
    rule_label = "Should use a recognised value"
    for code, allowed in _ALLOWED_VALUES.items():
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="ALLOWED_VALUE",
                    rule_label=rule_label,
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        if value.strip().lower() not in allowed:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="ALLOWED_VALUE",
                    rule_label=rule_label,
                    status="warning",
                    message=f"'{value}' is not one of the recognised values for this field.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="ALLOWED_VALUE",
                    rule_label=rule_label,
                    status="pass",
                )
            )
    return results


def _check_currency_format(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """CURRENCY_FORMAT — currency fields must be a 3-letter ISO 4217-shaped code."""
    results: list[ValidationResult] = []
    for code in _CURRENCY_FIELD_CODES:
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="CURRENCY_FORMAT",
                    rule_label="Must be a 3-letter currency code",
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        candidate = value.strip().upper()
        if not _CURRENCY_PATTERN.match(candidate):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="CURRENCY_FORMAT",
                    rule_label="Must be a 3-letter currency code",
                    status="fail",
                    message=f"'{value}' is not a 3-letter ISO 4217-shaped currency code.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="CURRENCY_FORMAT",
                    rule_label="Must be a 3-letter currency code",
                    status="pass",
                )
            )
    return results


def _check_non_negative_numeric(values: Mapping[str, str | None]) -> list[ValidationResult]:
    """NON_NEGATIVE_NUMERIC — amount fields must be zero or positive (EBA rule v23716_s)."""
    results: list[ValidationResult] = []
    for code in _NON_NEGATIVE_NUMERIC_CODES:
        value = values.get(code)
        if _is_blank(value):
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NON_NEGATIVE_NUMERIC",
                    rule_label="Must be zero or greater",
                    status="skipped",
                    message="No value to validate.",
                )
            )
            continue

        assert value is not None
        try:
            amount = float(value.strip().replace(",", ""))
        except ValueError:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NON_NEGATIVE_NUMERIC",
                    rule_label="Must be zero or greater",
                    status="fail",
                    message=f"'{value}' is not a number.",
                )
            )
            continue

        if amount < 0:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NON_NEGATIVE_NUMERIC",
                    rule_label="Must be zero or greater",
                    status="fail",
                    message=f"Amount must be zero or greater, got {amount}.",
                )
            )
        else:
            results.append(
                ValidationResult(
                    field_code=code,
                    rule_id="NON_NEGATIVE_NUMERIC",
                    rule_label="Must be zero or greater",
                    status="pass",
                )
            )
    return results


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
    results.extend(_check_lei_format(values))
    results.append(_check_criticality_value(values))
    results.extend(_check_completeness_groups(values))
    results.extend(_check_conditional_pairs(values))
    results.extend(_check_allowed_values(values))
    results.extend(_check_currency_format(values))
    results.extend(_check_non_negative_numeric(values))
    return results
