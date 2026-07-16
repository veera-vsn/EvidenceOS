"""Shared export dataclasses.

Split out of export.py so entity_export.py can depend on ExportableDocument
without a circular import (export.py imports build functions from
entity_export.py; entity_export.py needs ExportableDocument's shape to
build the B_03.01/B_03.02/B_04.01 rows derived from it).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class ExportableDocument:
    """One document whose latest version is validated and fully reviewed."""

    document_id: str
    document_name: str
    document_version_id: str
    extracted: dict[str, str | None]
    reviews: dict[str, Mapping[str, str | None]]
