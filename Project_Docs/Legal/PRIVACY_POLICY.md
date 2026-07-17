# Privacy Policy

> **Internal note (delete before publishing):** this is a self-drafted
> policy, adapted from public GDPR-baseline templates and grounded in
> what EvidenceOS's code actually does as of 2026-07-17 (verified against
> `requirements.in`, `field_extractor.py`, `.env.example`, and
> `Phase_7_Deployment/01_aws_setup_log.md` — not copied from the
> aspirational founder narrative in the positioning doc, which currently
> overstates the LLM stack). It has **not** been reviewed by a lawyer.
> Fine for Phase B free pilots; get a real review — even a free one via
> your Local Enterprise Office or a university legal clinic — before
> Phase C paid pilots. No registered business address is included below
> since no entity exists yet — worth adding one (even a registered-agent
> or virtual mailbox address) once you have it; email-only is workable
> for now but not ideal long-term for a data controller notice.

**Effective date:** 17 July 2026
**Last updated:** 17 July 2026

EvidenceOS ("**we**", "**us**", "**our**") provides a DORA Register of
Information compliance platform at evidenceos.eu (the "**Service**").
This policy explains what personal data we collect, why, and what
rights you have over it.

**Data controller:** Veera Venkata Satyanarayana Nargana, trading as
EvidenceOS, Ireland. Contact: hello@evidenceos.eu.

---

## 1. What data we collect

**Account and workspace data.** Name, work email, and role, collected
when you or your organisation sign up. Workspace membership and role
(owner/admin/member) for access control.

**Entity profile data.** Information you enter about your organisation
for the DORA Register of Information — legal entity identifiers, entity
type, group structure, branch locations. You control what you enter
here.

**Uploaded documents and their content.** Contracts, ICT third-party
agreements, and other evidence documents you upload. **Treat everything
you upload as containing confidential and potentially special-category
data** — we do too. This is the most sensitive data category the Service
handles.

**Extracted and derived data.** Text extracted from your documents, the
structured DORA RoI fields our pipeline identifies from that text, and
the validation results computed from those fields.

**Usage and log data.** Structured application logs (who did what, when,
on which document ID) for audit and debugging. **We do not log the raw
content of your documents** — see `CLAUDE.md`'s data-handling rule,
which this policy reflects, not just describes.

---

## 2. Why we process it (legal basis)

- **Performance of a contract** (GDPR Art. 6(1)(b)) — processing your
  documents and entity data is literally the Service: extracting DORA
  RoI fields, validating them, producing your export.
- **Legitimate interests** (Art. 6(1)(f)) — application logs, security
  monitoring, improving extraction accuracy using aggregated (not
  document-content) metrics.
- **Consent** (Art. 6(1)(a)) — anything beyond the above, e.g. using a
  pilot as a named case study, which we will always ask for separately.

---

## 3. Who else processes your data (subprocessors)

We use the following subprocessors. This list is accurate to the current
build, not aspirational — we will update it if it changes, and notify
active customers of material changes.

| Subprocessor | Purpose | Location | Notes |
|---|---|---|---|
| **Supabase** | Database, file storage, authentication | EU region | All persistent data lives here. |
| **AWS** | Backend API hosting (FastAPI) | EU (`eu-central-1`, Frankfurt) | Chosen specifically to match Supabase's region. |
| **OpenAI** | Field extraction (GPT-4o-mini) and text embeddings from your document content | **Not a guaranteed EU-only endpoint** | See "International transfers" below — this is a known limitation we're disclosing rather than obscuring. |
| **Langfuse** | LLM observability — logs prompts/completions (including excerpts of your document text) for cost, latency, and quality monitoring | EU Cloud (`eu.cloud.langfuse.com`) | Engineering tool, not a public-facing product; access restricted to us. |
| **Vercel** | Frontend hosting and server-side rendering | Region not currently pinned to EU | Serves the web UI; some server actions pass data through it en route to Supabase. We're evaluating pinning this to an EU region. |

We do not sell your data. We do not use your document content to train
third-party models — OpenAI's API terms for business customers exclude
API data from model training by default, and we have not opted in to
any programme that would change that.

---

## 4. International transfers

Supabase and our own backend keep your data in the EU. **OpenAI's
standard API is a US-headquartered service and is not currently
guaranteed to process data within the EU only.** Where this applies,
transfers rely on OpenAI's Standard Contractual Clauses (SCCs) with EU
customers, which is the same mechanism most EU SaaS products use for
US-based LLM providers. We are tracking EU-only inference options (e.g.
Azure OpenAI's EU deployments) as a future improvement — this is an
open, documented gap, not a hidden one.

---

## 5. Data retention

We retain your data for as long as your workspace is active. If you are
a design-partner pilot participant, retention terms are set out
separately in the Data Handling & Confidentiality Agreement you sign
before your pilot starts. On account or workspace closure, we delete
your data within **30 days**, except where we are required to retain it
longer by law.

---

## 6. Security

Data is encrypted in transit (TLS) and at rest (Supabase-managed
encryption). On top of that infrastructure-level encryption, your
uploaded document text and the field values our pipeline extracts from
it are separately encrypted at the application layer (AES-256-GCM)
before being written to our database — so even someone with raw
database read access, without also holding our application's encryption
key, sees ciphertext, not your contract text. This is a single shared
application key today, not a hardware-security-module-backed key
management service; we plan to migrate to that stronger model as the
Service grows, and are noting the current design plainly rather than
overstating it. Access to your workspace is controlled by Postgres
Row-Level Security — other workspaces cannot query your data through the
application, by construction, not just by policy. Internal access to
production data is limited to what's needed to operate the Service.

---

## 7. Your rights

Under GDPR you have the right to: access the personal data we hold about
you; correct it; request erasure; restrict or object to processing;
receive it in a portable format; and lodge a complaint with your
national data protection authority — for EU-based customers, this is
typically your own country's authority; for matters concerning us as
controller, the [Irish Data Protection
Commission](https://www.dataprotection.ie). To exercise any of these,
contact hello@evidenceos.eu.

---

## 8. Cookies

The Service currently uses only strictly necessary session/authentication
cookies. We do not run third-party analytics or advertising cookies as
of this draft. If that changes, this section — and a cookie banner — will
change with it.

---

## 9. Changes to this policy

We'll update the "last updated" date above and, for material changes,
notify active workspace owners directly rather than relying on you to
re-read this page.

---

## 10. Contact

hello@evidenceos.eu — Veera Venkata Satyanarayana Nargana, founder,
EvidenceOS.
