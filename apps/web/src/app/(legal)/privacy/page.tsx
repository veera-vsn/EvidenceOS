/**
 * `/privacy` — Privacy Policy.
 *
 * Content mirrors Project_Docs/Legal/PRIVACY_POLICY.md, which is the
 * source of truth (kept there so it's reviewable/diffable alongside the
 * rest of the project's documentation). Update both together.
 */

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — EvidenceOS" };

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-lg font-semibold tracking-tight text-fg first:mt-0">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[14.5px] leading-[1.65] text-fg-2">{children}</p>;
}

export default function PrivacyPolicyPage() {
  return (
    <article>
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-fg">Privacy Policy</h1>
      <p className="mb-1 text-sm text-fg-3">Effective date: 17 July 2026</p>
      <p className="mb-8 text-sm text-fg-3">Last updated: 17 July 2026</p>

      <P>
        EvidenceOS (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a DORA Register of
        Information compliance platform at evidenceos.eu (the &quot;Service&quot;). This policy
        explains what personal data we collect, why, and what rights you have over it.
      </P>
      <P>
        <strong className="text-fg">Data controller:</strong> Veera Venkata Satyanarayana
        Nargana, trading as EvidenceOS, Ireland. Contact:{" "}
        <a href="mailto:hello@evidenceos.eu" className="underline">hello@evidenceos.eu</a>.
      </P>

      <H2>1. What data we collect</H2>
      <P>
        <strong className="text-fg">Account and workspace data.</strong> Name, work email, and
        role, collected when you or your organisation sign up. Workspace membership and role
        (owner/admin/member) for access control.
      </P>
      <P>
        <strong className="text-fg">Entity profile data.</strong> Information you enter about
        your organisation for the DORA Register of Information — legal entity identifiers,
        entity type, group structure, branch locations. You control what you enter here.
      </P>
      <P>
        <strong className="text-fg">Uploaded documents and their content.</strong> Contracts,
        ICT third-party agreements, and other evidence documents you upload. Treat everything
        you upload as containing confidential and potentially special-category data — we do
        too. This is the most sensitive data category the Service handles.
      </P>
      <P>
        <strong className="text-fg">Extracted and derived data.</strong> Text extracted from
        your documents, the structured DORA RoI fields our pipeline identifies from that text,
        and the validation results computed from those fields.
      </P>
      <P>
        <strong className="text-fg">Usage and log data.</strong> Structured application logs
        (who did what, when, on which document ID) for audit and debugging. We do not log the
        raw content of your documents.
      </P>

      <H2>2. Why we process it (legal basis)</H2>
      <P>
        <strong className="text-fg">Performance of a contract</strong> (GDPR Art. 6(1)(b)) —
        processing your documents and entity data is literally the Service: extracting DORA
        RoI fields, validating them, producing your export.
      </P>
      <P>
        <strong className="text-fg">Legitimate interests</strong> (Art. 6(1)(f)) — application
        logs, security monitoring, improving extraction accuracy using aggregated (not
        document-content) metrics.
      </P>
      <P>
        <strong className="text-fg">Consent</strong> (Art. 6(1)(a)) — anything beyond the
        above, e.g. using a pilot as a named case study, which we will always ask for
        separately.
      </P>

      <H2>3. Who else processes your data (subprocessors)</H2>
      <P>
        We use the following subprocessors. This list is accurate to the current build, not
        aspirational — we will update it if it changes, and notify active customers of
        material changes.
      </P>
      <div className="mb-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-fg-3">
              <th className="px-3 py-2 font-medium">Subprocessor</th>
              <th className="px-3 py-2 font-medium">Purpose</th>
              <th className="px-3 py-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody className="text-fg-2">
            <tr className="border-b border-border-2">
              <td className="px-3 py-2.5 font-medium text-fg">Supabase</td>
              <td className="px-3 py-2.5">Database, file storage, authentication</td>
              <td className="px-3 py-2.5">EU region</td>
            </tr>
            <tr className="border-b border-border-2">
              <td className="px-3 py-2.5 font-medium text-fg">AWS</td>
              <td className="px-3 py-2.5">Backend API hosting (FastAPI)</td>
              <td className="px-3 py-2.5">EU (eu-central-1, Frankfurt)</td>
            </tr>
            <tr className="border-b border-border-2">
              <td className="px-3 py-2.5 font-medium text-fg">OpenAI</td>
              <td className="px-3 py-2.5">Field extraction (GPT-4o-mini) and text embeddings</td>
              <td className="px-3 py-2.5 text-warning">Not a guaranteed EU-only endpoint</td>
            </tr>
            <tr className="border-b border-border-2">
              <td className="px-3 py-2.5 font-medium text-fg">Langfuse</td>
              <td className="px-3 py-2.5">LLM observability (prompt/completion excerpts)</td>
              <td className="px-3 py-2.5">EU Cloud</td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 font-medium text-fg">Vercel</td>
              <td className="px-3 py-2.5">Frontend hosting and server-side rendering</td>
              <td className="px-3 py-2.5 text-warning">Not currently pinned to EU</td>
            </tr>
          </tbody>
        </table>
      </div>
      <P>
        We do not sell your data. We do not use your document content to train third-party
        models — OpenAI&apos;s API terms for business customers exclude API data from model
        training by default, and we have not opted in to any programme that would change that.
      </P>

      <H2>4. International transfers</H2>
      <P>
        Supabase and our own backend keep your data in the EU. OpenAI&apos;s standard API is a
        US-headquartered service and is not currently guaranteed to process data within the EU
        only. Where this applies, transfers rely on OpenAI&apos;s Standard Contractual Clauses
        (SCCs) with EU customers, the same mechanism most EU SaaS products use for US-based LLM
        providers. We are tracking EU-only inference options (e.g. Azure OpenAI&apos;s EU
        deployments) as a future improvement — this is an open, documented gap, not a hidden
        one.
      </P>

      <H2>5. Data retention</H2>
      <P>
        We retain your data for as long as your workspace is active. If you are a
        design-partner pilot participant, retention terms are set out separately in the Data
        Handling &amp; Confidentiality Agreement you sign before your pilot starts. On account
        or workspace closure, we delete your data within 30 days, except where we are required
        to retain it longer by law.
      </P>

      <H2>6. Security</H2>
      <P>
        Data is encrypted in transit (TLS) and at rest (Supabase-managed encryption). On top of
        that infrastructure-level encryption, your uploaded document text and the field values
        our pipeline extracts from it are separately encrypted at the application layer
        (AES-256-GCM) before being written to our database — so even someone with raw database
        read access, without also holding our application&apos;s encryption key, sees
        ciphertext, not your contract text. This is a single shared application key today, not
        a hardware-security-module-backed key management service; we plan to migrate to that
        stronger model as the Service grows, and are noting the current design plainly rather
        than overstating it.
      </P>
      <P>
        Access to your workspace is controlled by Postgres Row-Level Security — other
        workspaces cannot query your data through the application, by construction, not just by
        policy. Internal access to production data is limited to what&apos;s needed to operate
        the Service.
      </P>

      <H2>7. Your rights</H2>
      <P>
        Under GDPR you have the right to: access the personal data we hold about you; correct
        it; request erasure; restrict or object to processing; receive it in a portable format;
        and lodge a complaint with your national data protection authority — for EU-based
        customers, this is typically your own country&apos;s authority; for matters concerning
        us as controller, the{" "}
        <a href="https://www.dataprotection.ie" className="underline">
          Irish Data Protection Commission
        </a>
        . To exercise any of these, contact{" "}
        <a href="mailto:hello@evidenceos.eu" className="underline">hello@evidenceos.eu</a>.
      </P>

      <H2>8. Cookies</H2>
      <P>
        The Service currently uses only strictly necessary session/authentication cookies. We
        do not run third-party analytics or advertising cookies as of this version. If that
        changes, this section — and a cookie banner — will change with it.
      </P>

      <H2>9. Changes to this policy</H2>
      <P>
        We&apos;ll update the &quot;last updated&quot; date above and, for material changes,
        notify active workspace owners directly rather than relying on you to re-read this
        page.
      </P>

      <H2>10. Contact</H2>
      <P>
        <a href="mailto:hello@evidenceos.eu" className="underline">hello@evidenceos.eu</a> —
        Veera Venkata Satyanarayana Nargana, founder, EvidenceOS.
      </P>
    </article>
  );
}
