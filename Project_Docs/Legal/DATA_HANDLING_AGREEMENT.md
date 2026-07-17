# Data Handling & Confidentiality Agreement (Pilot)

> **Internal note (delete before sending):** this is the scaled-down
> substitute for a full GDPR Article 28 DPA, sized for a free,
> time-boxed design-partner pilot — not a paid, ongoing processing
> relationship. It is self-drafted from public Article 28 templates, not
> lawyer-reviewed. That's an acceptable trade-off for a free pilot with
> a named, cooperative counterparty; it is **not** acceptable once money
> changes hands — replace this with a proper lawyer-reviewed DPA before
> Phase C. This document is meant to be **signed** (e.g. via a free
> e-signature tool, or even just both parties countersigning a PDF by
> email) — it's a contract, not a webpage.
>
> **This is a reusable template**, unlike the Privacy Policy and Terms
> of Service (which get published once as website pages). Your side
> (Provider) is filled in below and stays constant across every pilot.
> Fill in `[Design partner's legal entity name]` and `[Effective Date]`
> fresh each time you onboard a new design partner.

This Data Handling & Confidentiality Agreement ("**Agreement**") is
between:

**Veera Venkata Satyanarayana Nargana**, trading as EvidenceOS, Ireland
("**Provider**")

and

**[Design partner's legal entity name]** ("**Participant**")

together, the "**Parties**", entered into as of **[Effective Date — set
per signing]** ("**Effective Date**") for the purpose of Participant's
evaluation of the EvidenceOS platform (the "**Pilot**").

---

## 1. Purpose

Participant will upload documents and enter organisational data into
EvidenceOS for the sole purpose of evaluating whether it can help
Participant prepare its DORA Register of Information. This is a
**pilot**, not a production dependency — Participant should not rely on
EvidenceOS's output as a final, submission-ready RoI during the Pilot
term without its own independent review.

## 2. What data is involved

- Documents Participant uploads (contracts, ICT third-party agreements,
  and similar evidence).
- Entity and organisational data Participant enters directly.
- Data extracted or derived from the above by the Service.

Some of this may constitute personal data under GDPR (e.g. names of
signatories or contacts within uploaded contracts) and, separately, is
commercially confidential regardless of whether it is personal data.
Both are covered by this Agreement.

## 3. Roles

For any personal data within the above, **Participant is the data
controller** and **Provider is the data processor**, processing data
only on Participant's documented instructions (i.e., to run the
extraction/validation pipeline Participant chose to use) and not for any
other purpose.

## 4. Where the data goes (subprocessors)

Provider uses the subprocessors listed in its current [Privacy
Policy](./PRIVACY_POLICY.md), summarised here for convenience:

| Subprocessor | Role | Location |
|---|---|---|
| Supabase | Database & storage | EU |
| AWS | Backend hosting | EU (`eu-central-1`) |
| OpenAI | Field extraction & embeddings | Not EU-guaranteed — see note below |
| Langfuse | LLM observability (sees prompt/completion excerpts) | EU |
| Vercel | Frontend hosting | Not currently pinned to EU |

**Disclosed limitation:** OpenAI's standard API is not a guaranteed
EU-only processing location. If Participant needs a stronger EU-only
inference guarantee than this before uploading its most sensitive
documents, tell Provider before the Pilot starts — redacting the most
sensitive material, or delaying that document's upload until an
EU-only-inference option is in place, are both reasonable adjustments
Provider will make on request.

Provider will not add a new subprocessor that materially changes this
picture during the Pilot without notifying Participant first.

## 5. Security measures

- Encryption in transit (TLS) and at rest (Supabase-managed).
- Application-layer encryption (AES-256-GCM) on top of that: uploaded
  document text and extracted field values are encrypted before being
  written to the database, using a key held only by Provider's
  application environment — not a KMS-backed key management service at
  this stage, a limitation stated here rather than left implicit.
- Workspace isolation enforced by Postgres Row-Level Security — other
  EvidenceOS workspaces cannot access Participant's data through the
  application.
- Access to Participant's data within Provider's own organisation is
  limited to what's needed to operate and support the Pilot.
- No raw document content is written to application logs.

## 6. Confidentiality

Each Party will keep the other's information confidential, use it only
for the Pilot, and not disclose it to any third party except the
subprocessors listed above and as required by law. This obligation
survives the end of the Pilot for **2 years**.

## 7. Retention and deletion

Provider will retain Participant's data for the duration of the Pilot
(**60 days**) and for **30 days** afterward (to allow for export or
transition discussions), after which it will be permanently deleted
unless Participant requests earlier deletion or an extension in
writing. Participant may request a full export of its data at any time
during the Pilot.

## 8. No warranty, no fee

The Pilot is provided free of charge, "as is", without warranty of
accuracy, availability, or fitness for a particular purpose — see
Provider's Terms of Service for the full disclaimer. Nothing in this
Agreement obligates Participant to purchase a paid subscription; nothing
obligates Provider to continue the Pilot for any minimum term.

## 9. Term and termination

This Agreement runs for the duration of the Pilot (**60 days** from
the Effective Date, or as otherwise agreed) and may be terminated by
either Party at any time, for any reason, on written notice (email is
sufficient). Sections 6 (Confidentiality) and 7 (Retention and deletion)
survive termination.

## 10. Governing law

This Agreement is governed by the laws of **Ireland**.

---

## Signatures

**For Provider:**

Name: Veera Venkata Satyanarayana Nargana
Title: Founder, EvidenceOS
Date: _______________________

**For Participant:**

Name: _______________________
Title: _______________________
Date: _______________________
