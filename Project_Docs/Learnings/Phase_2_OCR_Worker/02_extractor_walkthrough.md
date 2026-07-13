# Phase 2 — Extractor Walkthrough

File: `apps/api/app/pipeline/extractor.py`

---

## Design philosophy

The extractor is a pure dispatch module — no I/O, no DB calls, no state.
It takes `(file_type, bytes)` and returns an `ExtractionResult`. This makes
it trivially testable: pass bytes in, assert text out.

The OCR worker is responsible for downloading the file and persisting the
result. The extractor knows nothing about Supabase.

---

## `ExtractionResult`

```python
@dataclass
class ExtractionResult:
    text: str
    word_count: int
    extractor: str  # 'pymupdf' | 'python-docx' | 'openpyxl' | 'csv'
```

A dataclass (not Pydantic) because it is an internal value object — never
serialised to JSON, never sent over the network. Pydantic is for API
boundaries.

---

## PDF — PyMuPDF

```python
import fitz
doc = fitz.open(stream=content, filetype="pdf")
pages = [page.get_text() for page in doc]
text = "\n\n".join(pages).strip()
```

`fitz.open(stream=...)` avoids writing to disk — the bytes stay in memory.
`get_text()` reads the embedded text layer. Multi-page PDFs are concatenated
with double newlines so paragraph boundaries are preserved.

**Limitation**: PDFs that are purely scanned images have no text layer —
`get_text()` returns an empty string. Phase 2 accepts this; Phase 2.5 (future)
would add Tesseract or Azure Document Intelligence for scanned docs.

**Why PyMuPDF over pdfminer / pypdf?**
PyMuPDF is consistently the fastest and most accurate open-source PDF reader.
It handles complex layouts (multi-column, footnotes, headers) better than the
alternatives. No external binary dependency — the Rust + C core is bundled
in the wheel.

---

## DOCX — python-docx

```python
from docx import Document
doc = Document(io.BytesIO(content))
paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
text = "\n".join(paragraphs)
```

`doc.paragraphs` gives text in reading order. Empty paragraphs (used in Word
as spacers) are filtered out. Table cells are not yet traversed — DORA
contract data often lives in tables, and Phase 3 field extraction will
specifically handle them.

---

## XLSX — openpyxl

```python
wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    for row in ws.iter_rows(values_only=True):
        cells = [str(c) if c is not None else "" for c in row]
        if any(c.strip() for c in cells):
            rows.append("\t".join(cells))
```

- `read_only=True` — streams rows without loading the full workbook into RAM.
  Essential for large spreadsheets.
- `data_only=True` — returns computed cell values, not formula strings.
- Cells joined with tabs, rows with newlines — mirrors CSV format so
  downstream extraction logic can treat them uniformly.
- Each sheet is prefixed with `[Sheet: name]` so humans and LLMs can orient
  themselves when reading the extracted text.

---

## CSV — stdlib

```python
for encoding in ("utf-8", "latin-1"):
    try:
        text_io = io.StringIO(content.decode(encoding))
        reader = csv.reader(text_io)
        rows = ["\t".join(row) for row in reader if any(c.strip() for c in row)]
        ...
```

Two-encoding fallback covers the vast majority of CSV files produced by
European banking systems (which commonly use latin-1). No third-party library
needed — stdlib `csv` handles quoting, escaping, and newlines inside fields.

---

## Dispatch table

```python
_HANDLERS = {
    "pdf": extract_pdf,
    "docx": extract_docx,
    "xlsx": extract_xlsx,
    "csv": extract_csv,
}

def extract(file_type: str, content: bytes) -> ExtractionResult:
    handler = _HANDLERS.get(file_type)
    if handler is None:
        raise ValueError(f"Unsupported file type: {file_type!r}")
    return handler(content)
```

The dispatch table pattern keeps `extract()` open for extension (add a new
file type → add one entry) without modifying the function body. The worker
calls `extract(file_type, bytes)` and does not need to know which handler ran.

---

## Interview Q&A

**Q: Why lazy-import `fitz`, `docx`, and `openpyxl` inside the handler
functions instead of at module level?**

A: Keeps startup fast. Only the handler that is actually needed gets imported.
In the future, if we run extractors as separate Lambda functions or processes,
only the relevant dependency is loaded. Also makes the module importable in
environments where not all packages are installed (e.g. a CSV-only worker).

**Q: How would you test the extractor?**

A: Create a small valid file of each type in `tests/fixtures/`, read them as
bytes, and assert that `extract(file_type, bytes).text` contains expected
strings. The extractor has no I/O — no mocking needed, no network calls,
no Supabase dependency. Pure input → output.
