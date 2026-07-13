# Competitor landscape — DORA RoI compliance

*Last researched: 2026-07-12. Snapshot in time; verify pricing/features
before quoting to a customer or investor.*

The DORA RoI market splits into four buckets. We compete most directly
with **Bucket A**; we borrow features from Bucket B; we quote against
Buckets C and D to explain why we exist.

---

## Bucket A — DORA-native SaaS (our direct competitors)

### Vendorica
- **Positioning.** DORA-specific ICT third-party register with contract
  ingestion. Marketed to mid-market EU banks and payment institutions.
- **Pricing.** ~€1,500/month entry, scaling with contract volume.
- **Time-to-value.** 4-6 weeks implementation with consulting hours
  bundled.
- **Where we win.** Their extraction is manual + template-based; ours
  is LLM-assisted with confidence bands. Their audit trail is thin.
- **Where they win.** Live customers, references, a sales motion.

### 3rdRisk (acquired by Diligent, January 2026)
- **Positioning.** Was a specialist DORA + third-party risk platform;
  now folded into Diligent's GRC suite.
- **Pricing.** Enterprise. Bundled with Diligent Board or Diligent
  Boards. Rumoured €30-80k/year floor after acquisition.
- **Where we win.** Post-acquisition roadmap uncertainty; Diligent's
  sales cycle is 3-6 months and priced for enterprise. Mid-market
  buyers are up for grabs.
- **Where they win.** Gartner MQ presence, existing enterprise
  contracts, board-level relationships.

### DORA GRC
- **Positioning.** All five DORA pillars (ICT risk mgmt, incident
  reporting, digital resilience testing, third-party risk, information
  sharing) in one platform.
- **Pricing.** Custom, mid-market focus.
- **Where we win.** Breadth is their pitch and their weakness — they
  are shallow on RoI evidence chains. We are RoI-deep and expand
  outward.
- **Where they win.** Buyers who want "one throat to choke" across
  DORA.

### Copla
- **Positioning.** Compliance automation platform; raised €6M Series A
  early 2026, ~100+ customers across EU financial services.
- **Pricing.** Typically €18-30k/year mid-market.
- **Where we win.** Copla is compliance-generalist (DORA, MiCA, NIS2,
  AMLD). RoI is one workflow among many; ours is the whole product.
- **Where they win.** Multi-framework story lets a CISO buy once for
  three overlapping mandates.

### Venvera
- **Positioning.** Compliance-as-a-service covering 16+ frameworks
  including DORA.
- **Pricing.** ~€10-25k/year.
- **Where we win.** Same story as Copla — thin on DORA specifics.
- **Where they win.** Cross-mandate posture management appeals to
  buyers who see compliance holistically.

---

## Bucket B — Compliance certification platforms (adjacent, not direct)

### Vanta
- **Focus.** SOC 2, ISO 27001, HIPAA, GDPR. 400+ integrations. Public
  DORA readiness content but not a first-class RoI product.
- **Pricing.** $10-80k/year.
- **Overlap.** Continuous monitoring and evidence collection UX — we
  should feel this good to use. Not a DORA RoI competitor.

### Drata
- **Focus.** Same lane as Vanta. 300+ integrations. Published DORA
  guidance in 2025 but no RoI-specific workflow.
- **Pricing.** $7,500+/year.
- **Overlap.** Automated evidence + control mapping. Same lesson: our
  UX has to match this bar.

### Sprinto, Secureframe, ScrutinyAI
- Similar cert-first automation. Same conclusion — adjacent, not direct.

**Lesson from Bucket B.** The reason Vanta and Drata are so effective
is the *evidence engine*: pull data from source-of-truth systems,
attach it to controls, keep it fresh. We copy that pattern for RoI
fields (contract data → RoI cell → evidence link) but we own the
regulatory validation layer they do not have.

---

## Bucket C — Enterprise GRC platforms

### OneTrust, ServiceNow GRC, LogicGate, ProcessUnity
- **Pricing.** OneTrust starts around €3.6k/month and enterprise
  quickly. ServiceNow GRC begins around €25k/year and scales into
  six figures.
- **Sales motion.** 3-9 month cycle, procurement, professional services.
- **Where we win.** Speed and price. A €5-10k/year self-serve product
  for a 200-person payment institution is unreachable for these
  incumbents without a partner.
- **Where they win.** Tier-1 banks, insurers with existing GRC
  investment, buyers who need one platform for every regulation.

---

## Bucket D — Big 4 consultancies

### Deloitte, PwC, EY, KPMG
- **Offering.** DORA readiness assessments, RoI implementation
  projects, ongoing managed services. £150-350k typical engagement.
- **Where we win.** Software beats hours. A €10k/year product with a
  4-week ROI beats a €200k consulting engagement for firms that just
  need to get the RoI right.
- **Where they lose to us.** The economics do not work for the mid
  market: a payment institution with €50m revenue cannot pay Deloitte
  £200k every year to keep the RoI fresh.
- **Where they beat us.** Tier-1 banks that want a partner, not a
  vendor. Also, they are potentially our *channel*: an EY partner who
  finds EvidenceOS useful can pull us into 20 engagements.

---

## Market timing (why now)

- **The March 2026 RoI submission deadline has passed** (4 months
  before this snapshot).
- **Only 6.5% of firms passed all 116 quality checks** in the 2024
  ESMA/EIOPA/EBA dry-run. Post-mortem across the industry says the
  same thing: contract data was scattered, evidence was thin,
  spreadsheets did not scale.
- **The next mandatory submission is Q1 2027**, and quarterly updates
  are already required. Firms who failed or scraped through March 2026
  are actively looking for a better tool for their next cycle.
- **National regulators (Central Bank of Ireland, BaFin, ACPR, DNB)
  have started issuing supervisory guidance** on data quality. The
  compliance cost of a bad RoI is going up, not down.

That is the demand window. It opened in April 2026 and stays open
through 2027.

---

## Our positioning against the field

We are:

- **DORA-native and RoI-deep** — not a general GRC or cert platform.
- **Mid-market priced** — €5-10k/year target, self-serve onboarding.
- **Evidence-first** — every RoI cell traces back to a source document,
  and every source document has an audit chain.
- **Deterministic where it matters** — the 116 quality checks are
  code, not prompts.
- **Human-approved** — nothing hits the exported RoI without a review
  event.

That combination does not exist in any current competitor. Vendorica
comes closest but lacks LLM-assisted extraction; Copla and Venvera are
broader but shallower; Vanta and Drata are stronger on UX but not in
this regulation.

---

## Interview / investor Q&A

**Q: What stops Vanta from launching a DORA product tomorrow?**
A: Nothing legal — but Vanta's playbook is "hundreds of controls,
generic evidence." DORA RoI is 116 specific quality checks against a
specific xBRL taxonomy. The gap is domain depth, not tech. If Vanta
ships a DORA product, it will look like Vendorica does today: a
checklist with document upload. We win on the AI extraction and the
determinism guarantee.

**Q: Why not just be a Vanta partner?**
A: We could. But the customer conversation right now is "help us pass
the next RoI submission," not "help us get SOC 2 compliant." The
buyers are different (Head of Regulatory vs. VP Security) and the
budgets are different. Being a Vanta feature buries the story.

**Q: How big is the market?**
A: EU has ~22,000 financial entities in DORA scope. Even at 5% capture
of the mid-market slice (10,000 firms) at €8k ARR, that is €4m ARR —
enough to be a real business without needing to eat enterprise. The
ceiling is much higher if we grow up into Tier-2 banks.

**Q: Who buys?**
A: Chief Compliance Officer or Head of Regulatory Reporting. Sponsor
is usually the CIO or Head of ICT Risk. Champion is the analyst who
had to manually reconcile 400 contracts for March 2026 and does not
want to do it again.

**Q: Why not just extend a spreadsheet?**
A: The 116 quality checks include cross-field validation, referential
integrity across sheets, and taxonomy conformance. Excel cannot do
that. The market has tried; it is why 93.5% of firms failed the dry
run.
