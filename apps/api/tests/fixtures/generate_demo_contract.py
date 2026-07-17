"""Generates a realistic, enterprise-style ICT Master Services Agreement PDF
covering (as natural contract prose, not a labelled field dump) every one
of the 61 fields in `app.pipeline.field_extractor.DORA_FIELDS`.

Why this exists: Phase_9_Full_RoI_Stage1/CHALLENGES.md C5 found that
extraction fill-rate on a real vendor contract (AWS's standard agreement)
varied 0-14 of 44 fields across runs -- partly genuine LLM variance, partly
because a generic vendor contract was never written with DORA RoI fields in
mind, so several fields (recovery objectives, criticality reasoning,
sub-processor chains) may genuinely not appear in its text at all. This
fixture is the opposite case: a document deliberately written so every
field has a clear, unambiguous, extractable statement -- useful as a
canonical "does the pipeline work end-to-end" check, and as the fixed
document the RAG evaluation plan (see the RAG Stage 1 plan file) will
eventually need for comparable before/after runs.

Uses PyMuPDF's low-level `insert_textbox()` API, not the `fitz.Story`
HTML/CSS engine: Story's text shaper silently substitutes ligature glyphs
("ffi" -> a single U+FB03 character etc.) regardless of font choice, which
corrupts exact-match EBA enum values that happen to contain "ff"/"ffi"
("Difficult", "...difficulties in migrating or reintegrating..."). The
low-level API places glyphs without that shaping pass, so the embedded
text layer matches the source string exactly -- confirmed by round-
tripping the output through `app.pipeline.extractor.extract()` and
diffing key phrases. PyMuPDF is already a pipeline dependency (OCR
extraction), so this adds no new package for what is otherwise a one-off
fixture generator, not an app dependency.

Run: python tests/fixtures/generate_demo_contract.py
Output: tests/fixtures/nimbus_cloud_msa_v3.pdf
"""

from __future__ import annotations

from pathlib import Path

import fitz

OUTPUT_PATH = Path(__file__).parent / "nimbus_cloud_msa_v3.pdf"

PAGE = fitz.paper_rect("a4")
MARGIN_LEFT = 54
MARGIN_RIGHT = 54
MARGIN_TOP = 60
MARGIN_BOTTOM = 56
BODY_FONT = "helv"
BOLD_FONT = "hebo"
INK = (0.10, 0.10, 0.10)
MUTED = (0.45, 0.45, 0.45)
RULE = (0.6, 0.6, 0.6)

# (kind, text) blocks, in document order. kind is one of:
#   "title", "subtitle", "meta", "h2", "p"
BLOCKS: list[tuple[str, str]] = [
    ("title", "MASTER SERVICES AGREEMENT"),
    ("subtitle", "Enterprise Cloud Hosting Agreement"),
    ("meta", "Contractual arrangement reference: CA-2026-004417"),
    ("meta", "Effective date: 1 March 2024"),
    ("meta", "Financial Entity: Meridian Payments DAC (LEI 5493001234ABCDEF5678)"),
    ("meta", "Provider: NimbusGrid Cloud Services B.V. (LEI 7245009876XYZWAB1234)"),
    ("h2", "1. Parties and Nature of Arrangement"),
    (
        "p",
        "This Master Services Agreement (the “Agreement”) is entered into as "
        "of 1 March 2024 (the “Effective Date”) between: (1) Meridian Payments "
        "DAC, a payment institution authorised and regulated in Ireland, with "
        "Legal Entity Identifier (LEI) 5493001234ABCDEF5678 (the “Financial "
        "Entity”); and (2) NimbusGrid Cloud Services B.V., a private limited "
        "company incorporated under the laws of the Netherlands, with Legal "
        "Entity Identifier (LEI) 7245009876XYZWAB1234 and Dutch Chamber of "
        "Commerce (KVK) registration number 74123456 (the “Provider”).",
    ),
    (
        "p",
        "This arrangement is designated internally under contractual "
        "arrangement reference number CA-2026-004417 and constitutes a "
        "standalone arrangement, not forming part of any overarching or "
        "master framework agreement between the parties.",
    ),
    (
        "p",
        "NimbusGrid Cloud Services B.V. is a wholly-owned subsidiary of "
        "NimbusGrid Holdings N.V., its ultimate parent undertaking, "
        "identified by Legal Entity Identifier (LEI) 72450000000PARENT001.",
    ),
    (
        "p",
        "This Agreement, and any dispute arising out of or in connection "
        "with it, is governed by the laws of Ireland, and the courts of "
        "Ireland shall have exclusive jurisdiction.",
    ),
    ("h2", "2. Scope of Services and Function Supported"),
    (
        "p",
        "The Provider shall supply Infrastructure-as-a-Service (IaaS) cloud "
        "hosting and data processing services (the “Services”) supporting "
        "the Financial Entity's core payment processing platform, "
        "internally identified by function identifier FN-CORE-PAYSYS-01 "
        "(“Core Payment Processing Platform”).",
    ),
    (
        "p",
        "The function supported by the Services is the execution of payment "
        "transactions, a licensed payment service activity carried out by "
        "the Financial Entity (LEI 5493001234ABCDEF5678) under its payment "
        "institution authorisation.",
    ),
    ("h2", "3. Term, Renewal and Termination"),
    (
        "p",
        "This Agreement shall commence on 1 March 2024 and, unless "
        "terminated earlier in accordance with this Section, shall "
        "continue until 28 February 2027 (the “Initial Term”).",
    ),
    (
        "p",
        "The Financial Entity may terminate this Agreement for convenience "
        "by providing not less than ninety (90) days' written notice to the "
        "Provider. The Provider may terminate this Agreement for "
        "convenience by providing not less than one hundred and eighty "
        "(180) days' written notice to the Financial Entity.",
    ),
    (
        "p",
        "Absent early termination for cause, this Agreement shall expire at "
        "the end of the Initial Term and shall not automatically renew -- "
        "termination not for cause: the arrangement will have expired and "
        "not been renewed.",
    ),
    ("h2", "4. Fees"),
    (
        "p",
        "In consideration of the Services, the Financial Entity shall pay "
        "the Provider an aggregate annual fee of EUR 480,000 (four hundred "
        "and eighty thousand euro) per annum, payable quarterly in "
        "arrears, in the currency of the European Union (EUR). The "
        "Provider's total annual expense attributable to this arrangement, "
        "reported in the same currency, is likewise EUR 480,000.",
    ),
    ("h2", "5. Data Processing, Storage and Location"),
    (
        "p",
        "The Provider stores personal and transactional data belonging to "
        "the Financial Entity as part of the Services. Data at rest is "
        "stored exclusively within data centres located in Ireland (IE). "
        "Management and processing operations relating to that data, and "
        "the Services generally, are provided from and carried out by the "
        "Provider's operations centre in the Netherlands (NL).",
    ),
    (
        "p",
        "The data processed under this Agreement is classified as of High "
        "sensitivity, given its inclusion of payment transaction records "
        "and customer financial data.",
    ),
    (
        "p",
        "The Financial Entity's core payment processing function has a "
        "Full reliance on the Services provided under this Agreement -- no "
        "alternative in-house or third-party capability currently exists "
        "to perform this function independently.",
    ),
    ("h2", "6. Sub-Processing and ICT Service Supply Chain"),
    (
        "p",
        "The Provider engages HyperScale Data Centres Ireland Ltd (Irish "
        "Companies Registration Office number IE-556677) as a second-rank "
        "sub-processor within the ICT service supply chain, to provide the "
        "underlying Infrastructure-as-a-Service (IaaS) physical "
        "data-centre capacity supporting the Services described in "
        "Section 2 above.",
    ),
    (
        "p",
        "HyperScale Data Centres Ireland Ltd is identified for the "
        "purposes of this arrangement by its Company Registration Number "
        "(CRN) IE-556677. Within the supply chain, the Provider "
        "(NimbusGrid Cloud Services B.V., LEI 7245009876XYZWAB1234) is the "
        "first-ranked, direct counterparty to the Financial Entity, and "
        "HyperScale Data Centres Ireland Ltd is ranked second.",
    ),
    ("h2", "7. Business Continuity, Resilience and Criticality Assessment"),
    (
        "p",
        "The Financial Entity has assessed the function supported by this "
        "Agreement (Core Payment Processing Platform, function identifier "
        "FN-CORE-PAYSYS-01) as critical or important. This assessment was "
        "last performed on 15 January 2026.",
    ),
    (
        "p",
        "The function was assessed as critical because a disruption to the "
        "Services would directly prevent the Financial Entity from "
        "executing customer payment transactions -- a core regulated "
        "activity -- with immediate operational, financial and "
        "reputational consequences.",
    ),
    (
        "p",
        "The agreed Recovery Time Objective (RTO) for the function is "
        "4 hours, and the agreed Recovery Point Objective (RPO) is "
        "1 hour. The impact of discontinuing the Services, whether "
        "through Provider failure or contract termination without an "
        "adequately tested transition, is assessed as High.",
    ),
    ("h2", "8. Audit Rights, Substitutability and Exit Strategy"),
    (
        "p",
        "The Financial Entity, or an appointed third party on its behalf, "
        "may audit the Provider's premises, systems and records relevant "
        "to the Services, subject to reasonable notice. The most recent "
        "such audit of the Provider was completed on 10 November 2025.",
    ),
    (
        "p",
        "The substitutability of the Provider is assessed as Highly "
        "complex substitutability, owing to a lack of directly comparable "
        "alternative providers offering equivalent Infrastructure-as-a-"
        "Service capacity at the scale required, combined with the "
        "material difficulty and lead time involved in migrating or "
        "reintegrating the Core Payment Processing Platform to an "
        "alternative provider or in-house solution. The reason recorded "
        "for this assessment is lack of real alternatives and "
        "difficulties in migrating or reintegrating, per the Financial "
        "Entity's most recent review.",
    ),
    (
        "p",
        "An exit plan for this arrangement exists and has been documented "
        "and tested by the Financial Entity. Reintegration of the "
        "Services, whether to an alternative provider or in-house, is "
        "assessed as Difficult, given the technical complexity of the "
        "platform and the sensitivity of the data involved.",
    ),
    (
        "p",
        "The Financial Entity has identified at least one alternative ICT "
        "third-party service provider capable of supplying a broadly "
        "equivalent service, namely CloudBastion Infrastructure Services "
        "Ltd, should a transition become necessary.",
    ),
    ("h2", "9. Signatures"),
    ("p", "The parties have executed this Agreement as of the Effective Date."),
    ("p", "For and on behalf of Meridian Payments DAC:"),
    ("p", "Aoife Byrne, Chief Operating Officer -- 28 February 2024"),
    ("p", "For and on behalf of NimbusGrid Cloud Services B.V.:"),
    ("p", "Willem de Groot, VP Enterprise Contracts -- 28 February 2024"),
]


class _PageCursor:
    """Tracks the current page and vertical write position, opening a new
    page on demand. Keeps generate() below focused on content, not layout
    bookkeeping."""

    def __init__(self, doc: fitz.Document) -> None:
        self.doc = doc
        self.page: fitz.Page = doc.new_page(width=PAGE.width, height=PAGE.height)
        self.y = MARGIN_TOP
        self._page_number = 1
        self._draw_footer()

    def _draw_footer(self) -> None:
        self.page.insert_text(
            (MARGIN_LEFT, PAGE.height - 30),
            "Nimbus_Cloud_MSA_v3.pdf · Confidential · Synthetic EvidenceOS "
            "test fixture -- not a real commercial agreement.",
            fontname=BODY_FONT,
            fontsize=6.5,
            color=MUTED,
        )
        self.page.insert_text(
            (PAGE.width - MARGIN_RIGHT - 20, PAGE.height - 30),
            f"{self._page_number}",
            fontname=BODY_FONT,
            fontsize=7.5,
            color=MUTED,
        )

    def new_page(self) -> None:
        self.page = self.doc.new_page(width=PAGE.width, height=PAGE.height)
        self._page_number += 1
        self.y = MARGIN_TOP
        self._draw_footer()

    def ensure_space(self, min_height: float) -> None:
        if PAGE.height - MARGIN_BOTTOM - self.y < min_height:
            self.new_page()

    def write_block(self, text: str, *, fontname: str, fontsize: float, color=INK) -> None:
        rect = fitz.Rect(
            MARGIN_LEFT, self.y, PAGE.width - MARGIN_RIGHT, PAGE.height - MARGIN_BOTTOM
        )
        spare = self.page.insert_textbox(
            rect, text, fontname=fontname, fontsize=fontsize, color=color, align=0
        )
        if spare < 0:
            # Didn't fit at all in the remaining space on this page -- retry
            # on a fresh page (a single paragraph at this size always fits
            # within one full page's height in this document).
            self.new_page()
            rect = fitz.Rect(
                MARGIN_LEFT, self.y, PAGE.width - MARGIN_RIGHT, PAGE.height - MARGIN_BOTTOM
            )
            spare = self.page.insert_textbox(
                rect, text, fontname=fontname, fontsize=fontsize, color=color, align=0
            )
        consumed = rect.height - max(spare, 0)
        self.y += consumed


def generate(output_path: Path = OUTPUT_PATH) -> Path:
    doc = fitz.open()
    cursor = _PageCursor(doc)

    for kind, text in BLOCKS:
        if kind == "title":
            cursor.write_block(text, fontname=BOLD_FONT, fontsize=18)
            cursor.y += 4
        elif kind == "subtitle":
            cursor.write_block(text, fontname=BODY_FONT, fontsize=11.5, color=MUTED)
            cursor.y += 10
        elif kind == "meta":
            cursor.write_block(text, fontname=BODY_FONT, fontsize=9, color=MUTED)
            cursor.y += 2
        elif kind == "h2":
            cursor.ensure_space(50)
            cursor.y += 14
            cursor.write_block(text, fontname=BOLD_FONT, fontsize=12.5)
            cursor.y += 2
            cursor.page.draw_line(
                fitz.Point(MARGIN_LEFT, cursor.y),
                fitz.Point(PAGE.width - MARGIN_RIGHT, cursor.y),
                color=RULE,
                width=0.6,
            )
            cursor.y += 10
        elif kind == "p":
            cursor.ensure_space(24)
            cursor.write_block(text, fontname=BODY_FONT, fontsize=10.5)
            cursor.y += 9

    doc.save(str(output_path))
    doc.close()
    return output_path


if __name__ == "__main__":
    path = generate()
    print(f"Wrote {path} ({path.stat().st_size:,} bytes)")
