# Go-to-market channels — where the customers are, and how we reach them

*Researched: 2026-07-15. Registers and event dates are live/official sources
— re-verify counts before quoting to a customer or investor, they update
regularly. This is the tactical companion to
`Project_Docs/Learnings/00.5_TARGET_MARKET_AND_POSITIONING.md` (who we
serve, why now, why us) and `Project_Docs/COMPETITORS.md` (who we're up
against). Read those first — this doc assumes the ICP defined there and
does not repeat it.*

---

## 1. Where the actual companies are — public regulator registers

Every payment institution (PI), e-money institution (EMI), and credit
institution in the EU is on a public register by law (PSD2 mandates it).
This is the single best source of a real prospect list — not a guess, not
a scraped directory, the actual regulator-maintained truth.

**EU-wide master register (start here):**
- **EBA EUCLID** — the European Banking Authority's central register,
  aggregating every national competent authority's data, updated daily.
  Free, searchable, downloadable in full.
  - Payment Institutions Register (PIR): https://euclid.eba.europa.eu/register/pir/search
  - Credit Institutions Register (CIR): https://euclid.eba.europa.eu/register/cir/search
  - Overview: https://www.eba.europa.eu/risk-and-data-analysis/data/registers-and-other-list-institutions

**National registers for the three Phase B design-partner countries
already named in `00.5`:**
- **Ireland** — Central Bank of Ireland Register of Authorised Firms:
  https://www.centralbank.ie/regulation/how-we-regulate/authorisation/register-of-authorised-firms
  (as of Dec 2025: **30 e-money institutions, 31 payment institutions**
  authorised — small enough to read every single one by hand in an
  afternoon). A third-party tracker also exists at
  https://vendors.ie/fintech/register if the official register's UI is
  slow to work with.
- **Germany** — BaFin ZAG register (payment + e-money institutions):
  https://www.bafin.de/EN/PublikationenDaten/Datenbanken/ZahlungsinstituteRegister/register_zahlungsinstitute_node_en.html
- **Netherlands** — De Nederlandsche Bank public register:
  https://www.dnb.nl/en/public-register/register-of-payment-service-providers/
  and https://www.dnb.nl/en/public-register/register-of-electronic-money-institutions/
  (updated daily at 06:00).

**Why start with Ireland specifically:** smallest register of the three
(61 firms total across both categories), English-language by default, and
matches `00.5`'s existing Phase B target (one Irish payment institution
design partner). This is the most tractable "build a real list this week"
starting point.

---

## 2. Where the buyers already congregate — trade associations

These aren't prospect lists themselves, but they're where the *buyer
persona* (Head of Regulatory Reporting, Chief Compliance Officer) already
pays attention, and most publish member directories:

- **EPIF (European Payment Institutions Federation)** — represents 400+
  payment institutions and payment providers across Europe. Member list:
  https://paymentinstitutions.eu/membership/our-members/
- **EMA (Electronic Money Association)** — the European trade body for
  e-money issuers and payment institutions. Member list:
  https://e-ma.org/our-members
- National-level equivalents exist per country (e.g. AENPA in Spain,
  Afepame in France) — EPIF's own member list links out to these; worth
  checking for the specific countries in the design-partner pipeline.

A firm that's already a paying member of EPIF or EMA has signalled it
takes payments regulation seriously enough to invest in industry
representation — a soft qualifier worth weighting a prospect list by.

---

## 3. Search strategy for outbound (LinkedIn Sales Navigator or equivalent)

Job titles to search, taken directly from `00.5`'s buyer/champion/blocker
map:

- **Buyer:** "Head of Regulatory Reporting", "Chief Compliance Officer",
  "Head of Compliance"
- **Economic buyer:** "COO", "CFO" (smaller firms often collapse this
  into the same person as the buyer)
- **Champion (best first contact):** "Regulatory Reporting Analyst",
  "Compliance Analyst", "DORA Programme Manager" — this is the person who
  did the March 2026 reconciliation by hand and doesn't want to repeat it
  quarterly.
- **Blocker to route around early:** "CISO", "Head of Information
  Security" — loop them in deliberately once data-handling questions come
  up, don't surprise them.

Filter by company size 50–1000 employees and company name against the
register list from Section 1 — this turns "cold LinkedIn outreach" into
"outreach to a named list of companies that are legally required to have
exactly the problem we solve."

---

## 4. Events

- **Money20/20 Europe** — Amsterdam, **2–4 June 2026**. The single
  best-matched event found: 450+ speakers, and one of its four official
  themes for 2026 is explicitly **"Regulatory Technology &
  Cybersecurity."** This is where compliance buyers *and* other RegTech
  vendors (potential partners, not just competitors) will be in one room.
- No single dedicated "DORA-only" conference was found in this pass —
  DORA content tends to show up as tracks/panels inside broader
  fintech/RegTech events (Money20/20, Sibos) rather than as its own
  standalone conference. Also worth checking directly, closer to the
  time: **EBA/ESA-hosted webinars** on RoI data quality (national
  regulators have started issuing supervisory guidance per `00.5` — some
  of that guidance comes with public webinars), and **national fintech
  association events** (Ireland's, Germany's, Netherlands' local fintech
  bodies often run smaller, cheaper, more targeted meetups than the big
  international conferences).

---

## 5. Marketing channels — what's right for *this* stage, honestly

`00.5` is explicit that Phase A (now) is walking-skeleton MVP, Phase B
(Jan–Mar 2027) is three free design partners. **Paid advertising does not
belong in either phase** — there's no validated landing page, no proven
messaging, no pricing tested against a real buyer conversation yet, and
the audience is narrow enough (a few thousand qualifying firms EU-wide)
that broad ad platforms would burn budget on a mostly-irrelevant
audience. Recommending "run some LinkedIn ads" before Phase B would be
generic startup advice, not advice grounded in where this specific
product actually is.

What *does* fit this stage — all low-cost, founder-led, and consistent
with a self-serve product aimed at mid-market:

- **Content built around the one stat that matters:** *"93.5% of firms
  failed the March 2026 RoI quality checks."* This is the whole pitch in
  one number — it's specific, verifiable, and immediately relevant to
  the exact buyer persona above. A short LinkedIn post or article
  breaking down *why* firms failed (spreadsheets don't do cross-field
  validation — see `COMPETITORS.md`'s "why not just extend a
  spreadsheet" Q&A) is more credible outbound material than a generic
  product pitch.
- **Direct outreach to the named list from Sections 1–3**, not spray-and-pray
  cold email. A message that references the firm's *actual* PSD2/EMI
  authorisation (public, from the register) and the actual March 2026 dry
  run reads as researched, not templated.
- **The Big 4 channel** — `00.5` already flags this: a Deloitte/EY/PwC/KPMG
  partner who finds the tool useful for their own DORA advisory
  engagements can pull EvidenceOS into many client conversations at once.
  Worth one or two warm-intro conversations even at this early stage,
  framed as "here's a tool that makes your advisory hours more valuable,"
  not as a competitive threat to their consulting revenue.
- **Regulatory/trade press**, once there's a real case study from a
  Phase B design partner — outlets like Finextra, The Paypers, and
  Fintech Futures all cover DORA compliance content and are more
  reachable pre-funding than mainstream tech press.
- **Design partner case study** (the actual Phase B/C output) is the
  single highest-leverage marketing asset this product can produce — a
  named EU payment institution saying "this got our RoI from failing to
  passing" outweighs any amount of paid reach.

**Revisit paid ads (LinkedIn Ads specifically — it's the only platform
with the B2B job-title/company-size targeting this audience needs) once
Phase C (first paid pilots) has validated messaging and pricing** — not
before.

---

## 6. Building the first real prospect list — concrete next step

1. Open the Central Bank of Ireland register (Section 1) and export/copy
   all 61 PI + EMI entries.
2. Cross-reference against EPIF and EMA member lists — flag any overlap
   (signals a firm already engaged with industry compliance efforts).
3. For each firm, find the Head of Regulatory Reporting / Chief
   Compliance Officer / Compliance Analyst on LinkedIn (Section 3).
4. Filter to the 50–1000 employee band from `00.5`'s ICP.
5. That's a real, qualified first-20-to-50 list — small enough to
   research individually, large enough to run Phase B's "three design
   partners" search against.
6. Repeat the same process against Germany (BaFin) and Netherlands (DNB)
   once the Irish list is exhausted, per `00.5`'s existing three-country
   design-partner target.

---

## What this doc is NOT

- Not a validated marketing plan — the channels above are reasoned from
  the ICP and market timing already documented in `00.5`, not from real
  customer conversations yet. Revisit after Phase B.
- Not an ads strategy — deliberately, for now. See Section 5 for why.
- Not exhaustive — national registers exist for every EU/EEA country;
  only the three already named in `00.5`'s design-partner plan are
  detailed here. Extend this doc as the target list grows past Ireland/
  Germany/Netherlands.
