"""Text extraction from uploaded documents.

Supports four file types that match the DORA RoI evidence corpus:

    pdf   — pdfplumber (pdfminer.six): no external binary, handles
             text-layer PDFs. Scanned (image-only) PDFs return empty text;
             a future phase will add Tesseract / Azure Document
             Intelligence for those.
    docx  — python-docx: extracts paragraph text in reading order.
    xlsx  — openpyxl: reads all sheets, all rows, all cells (as strings).
    csv   — stdlib csv: reads all rows.

Each handler returns an :class:`ExtractionResult` with the raw text and
a word count. The caller (OCR worker) is responsible for persisting this
to the ``document_text`` table.

PDF library note (2026-07-19): this used to be PyMuPDF (`fitz`), swapped
out for pdfplumber per the 2026-07-19 production audit's dependency
finding (Project_Docs/AUDIT_2026-07-18.md, Dependency Audit) --
PyMuPDF/`fitz` is AGPL v3/commercial dual-licensed by Artifex Software,
and using AGPL code in a closed-source commercial SaaS backend without
either open-sourcing the connected codebase or buying a commercial
license is a real compliance problem. pdfplumber (built on pdfminer.six)
and its dependencies are all MIT/BSD/Apache-2.0 -- no such issue.

Verified before swapping, not assumed: ran both extractors side-by-side
against tests/fixtures/nimbus_cloud_msa_v3.pdf (the demo contract built
specifically to exercise this exact code path -- see that fixture's own
generator docstring for the ligature-corruption bug it was built to
catch). Output was functionally identical -- same word count, every
DORA field value present in both (including the exact
ligature-sensitive strings, "Difficult" / "difficulties in migrating or
reintegrating", that were the whole reason that fixture's generator
does not use PyMuPDF's `fitz.Story` HTML/CSS engine). The only
difference was cosmetic: a repeated page-footer disclaimer line ordered
top-of-page by PyMuPDF vs. bottom-of-page (its actual visual position)
by pdfplumber -- no contract content affected either way. See
tests/test_extractor.py for the regression test that locks this in.

The old PyMuPDF implementation is kept immediately below `extract_pdf`,
commented out rather than deleted -- in case a future page/table-heavy
PDF surfaces an accuracy gap pdfplumber doesn't handle as well, this is
the fastest path back.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass


@dataclass
class ExtractionResult:
    """Output of a single document extraction."""

    text: str
    word_count: int
    extractor: str  # which handler produced this ('pdfplumber', 'python-docx', …)


# Superseded 2026-07-19 -- PyMuPDF is AGPL/commercial dual-licensed, not
# safe to use unmodified in a closed-source commercial backend. Kept
# here, not deleted, as the fastest path back if pdfplumber ever proves
# less accurate on some future document. See this module's docstring
# and Project_Docs/AUDIT_2026-07-18.md's Dependency Audit for the full
# reasoning, and tests/test_extractor.py for the accuracy comparison
# that justified the swap.
#
# def extract_pdf(content: bytes) -> ExtractionResult:
#     """Extract text from a PDF binary using PyMuPDF.
#
#     PyMuPDF reads the text layer embedded in the PDF (not pixel OCR).
#     Multi-page documents are concatenated with double newlines between pages.
#     """
#     import fitz  # PyMuPDF — imported lazily to keep startup fast
#
#     doc = fitz.open(stream=content, filetype="pdf")
#     pages: list[str] = []
#     for page in doc:
#         pages.append(page.get_text())
#     doc.close()
#
#     text = "\n\n".join(pages).strip()
#     return ExtractionResult(
#         text=text,
#         word_count=len(text.split()),
#         extractor="pymupdf",
#     )


def extract_pdf(content: bytes) -> ExtractionResult:
    """Extract text from a PDF binary using pdfplumber.

    pdfplumber (built on pdfminer.six) reads the text layer embedded in
    the PDF (not pixel OCR) -- same fundamental approach as the PyMuPDF
    implementation it replaces, just a different, permissively-licensed
    parser. Multi-page documents are concatenated with double newlines
    between pages, matching the previous implementation's convention.
    """
    import pdfplumber  # imported lazily to keep startup fast

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]

    text = "\n\n".join(pages).strip()
    return ExtractionResult(
        text=text,
        word_count=len(text.split()),
        extractor="pdfplumber",
    )


def extract_docx(content: bytes) -> ExtractionResult:
    """Extract text from a DOCX binary using python-docx.

    Reads every paragraph in document order. Tables are not yet traversed
    (Phase 3 field extraction will handle structured DOCX tables).
    """
    from docx import Document  # python-docx

    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = "\n".join(paragraphs).strip()
    return ExtractionResult(
        text=text,
        word_count=len(text.split()),
        extractor="python-docx",
    )


def extract_xlsx(content: bytes) -> ExtractionResult:
    """Extract text from an XLSX binary using openpyxl.

    Iterates all sheets → all rows → all cells. Cell values are cast to
    strings and joined with tabs (columns) and newlines (rows). Sheet
    boundaries are marked with a header comment so the extraction result
    is human-readable and debuggable.
    """
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sections: list[str] = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows: list[str] = []
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) if c is not None else "" for c in row]
            if any(c.strip() for c in cells):
                rows.append("\t".join(cells))
        if rows:
            sections.append(f"[Sheet: {sheet_name}]\n" + "\n".join(rows))
    wb.close()

    text = "\n\n".join(sections).strip()
    return ExtractionResult(
        text=text,
        word_count=len(text.split()),
        extractor="openpyxl",
    )


def extract_csv(content: bytes) -> ExtractionResult:
    """Extract text from a CSV binary using the stdlib csv module.

    Tries UTF-8 first, falls back to latin-1. Rows are joined with newlines;
    columns with tabs — same convention as the XLSX extractor.
    """
    for encoding in ("utf-8", "latin-1"):
        try:
            text_io = io.StringIO(content.decode(encoding))
            reader = csv.reader(text_io)
            rows = ["\t".join(row) for row in reader if any(c.strip() for c in row)]
            text = "\n".join(rows).strip()
            return ExtractionResult(
                text=text,
                word_count=len(text.split()),
                extractor="csv",
            )
        except UnicodeDecodeError:
            continue

    raise ValueError("CSV file could not be decoded as UTF-8 or latin-1.")


# Dispatch table: file_type enum value → handler function.
_HANDLERS = {
    "pdf": extract_pdf,
    "docx": extract_docx,
    "xlsx": extract_xlsx,
    "csv": extract_csv,
}


def extract(file_type: str, content: bytes) -> ExtractionResult:
    """Dispatch to the correct handler for *file_type*.

    Args:
        file_type: One of 'pdf', 'docx', 'xlsx', 'csv'.
        content:   Raw file bytes downloaded from Supabase Storage.

    Returns:
        ExtractionResult with text, word_count, and extractor name.

    Raises:
        ValueError: If file_type is not supported.
    """
    handler = _HANDLERS.get(file_type)
    if handler is None:
        raise ValueError(f"Unsupported file type: {file_type!r}")
    return handler(content)
