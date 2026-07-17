/**
 * `/terms` — Terms of Service.
 *
 * Content mirrors Project_Docs/Legal/TERMS_OF_SERVICE.md, which is the
 * source of truth (kept there so it's reviewable/diffable alongside the
 * rest of the project's documentation). Update both together.
 */

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — EvidenceOS" };

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

function Li({ children }: { children: React.ReactNode }) {
  return <li className="mb-2 text-[14.5px] leading-[1.65] text-fg-2">{children}</li>;
}

export default function TermsOfServicePage() {
  return (
    <article>
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-fg">
        Terms of Service
      </h1>
      <p className="mb-8 text-sm text-fg-3">Effective date: 17 July 2026</p>

      <P>
        These Terms of Service (&quot;Terms&quot;) govern access to and use of EvidenceOS (the
        &quot;Service&quot;), operated by Veera Venkata Satyanarayana Nargana, trading as
        EvidenceOS (&quot;we&quot;, &quot;us&quot;). By creating a workspace or using the
        Service, you (&quot;you&quot;, &quot;Customer&quot;) agree to these Terms. If you
        don&apos;t agree, don&apos;t use the Service.
      </P>

      <H2>1. What the Service is — and isn&apos;t</H2>
      <P>
        EvidenceOS helps you extract, validate, and prepare a DORA Register of Information
        (RoI) submission from your contracts and evidence documents. The Service does not
        itself submit anything to a national competent authority, and it does not, by itself,
        guarantee regulatory compliance. Every field the pipeline extracts and every validation
        result it produces is a draft for human review — nothing is finalised, exported, or
        submitted without a person on your team approving it. You remain responsible for the
        accuracy and completeness of what you ultimately submit to your regulator.
      </P>

      <H2>2. Free pilot / evaluation use</H2>
      <P>
        If you&apos;re using the Service as an unpaid design partner, the following applies
        unless we agree otherwise in writing:
      </P>
      <ul className="mb-4 list-disc pl-5">
        <Li>
          Your pilot runs for 60 days from your workspace&apos;s creation date, after which
          we&apos;ll discuss either a paid subscription or winding the pilot down.
        </Li>
        <Li>
          The Service is provided for evaluation purposes, without any service-level agreement
          (SLA), warranty of uptime, or guarantee of extraction accuracy. It is real, working
          software, but it is early — treat outputs as a starting point for your own review,
          not a final answer.
        </Li>
        <Li>
          In exchange, we ask for structured feedback (at minimum, one scheduled call before the
          pilot ends) and, if you&apos;re willing, permission to reference your use of the
          Service as a case study — we will always ask separately and specifically before
          naming or quoting you publicly.
        </Li>
      </ul>

      <H2>3. Paid use</H2>
      <P>
        Once you&apos;re on a paid subscription, pricing, billing terms, and any service
        commitments will be set out in a separate order form or invoice that these Terms
        incorporate by reference. Nothing in this document sets a price.
      </P>

      <H2>4. Your account and workspace</H2>
      <P>
        You&apos;re responsible for maintaining the confidentiality of your account credentials
        and for all activity under your workspace. You must have authority to bind your
        organisation before uploading its documents or entering its data.
      </P>

      <H2>5. Acceptable use</H2>
      <P>
        You agree not to: upload documents you don&apos;t have the right to share with us;
        attempt to access another workspace&apos;s data; probe, scan, or attempt to bypass the
        Service&apos;s access controls; use the Service to build a competing product; or use it
        for anything unlawful.
      </P>

      <H2>6. Your data</H2>
      <P>
        You own your data. Uploaded documents, entity profile data, and anything you enter
        remain yours. We process it solely to provide the Service to you, as described in our{" "}
        <a href="/privacy" className="underline">Privacy Policy</a>. You can request export or
        deletion of your data at any time by contacting{" "}
        <a href="mailto:hello@evidenceos.eu" className="underline">hello@evidenceos.eu</a>.
      </P>

      <H2>7. Intellectual property</H2>
      <P>
        We own the Service itself — the software, the extraction pipeline, the validation rule
        engine, the UI. Nothing in these Terms transfers that ownership to you. You grant us
        the right to process your data solely to provide the Service; we do not acquire any
        ownership rights in your data.
      </P>

      <H2>8. Disclaimers</H2>
      <P>
        THE SERVICE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
        NON-INFRINGEMENT. We do not warrant that the Service&apos;s extraction or validation
        output is complete, accurate, or sufficient to satisfy your regulatory obligations.
        Deterministic validation checks reflect our best reading of the published EBA
        validation rules; they are not a substitute for your own legal and compliance
        judgement, and every output requires your human review before you rely on it.
      </P>

      <H2>9. Limitation of liability</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, EVIDENCEOS&apos;S TOTAL LIABILITY ARISING OUT OF
        OR RELATED TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN
        THE 12 MONTHS BEFORE THE CLAIM AROSE, OR (B) €100 FOR FREE-TIER/PILOT USE. WE ARE NOT
        LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING REGULATORY FINES OR
        PENALTIES ARISING FROM YOUR USE OF THE SERVICE&apos;S OUTPUT.
      </P>

      <H2>10. Confidentiality</H2>
      <P>
        Each party will keep the other&apos;s confidential information confidential and use it
        only to perform under these Terms. This survives termination for 2 years. (Pilot
        participants: see the separate Data Handling &amp; Confidentiality Agreement, which
        governs your document content specifically and takes precedence over this clause where
        the two overlap.)
      </P>

      <H2>11. Termination</H2>
      <P>
        Either party may terminate a free pilot at any time, for any reason, on written notice
        (an email is fine). Paid subscriptions terminate per the terms in the relevant order
        form. On termination, we&apos;ll delete your data per the retention terms in our
        Privacy Policy, unless you request export first.
      </P>

      <H2>12. Changes to these Terms</H2>
      <P>
        We may update these Terms; we&apos;ll notify active workspace owners of material
        changes and, where required by law, seek renewed consent.
      </P>

      <H2>13. Governing law</H2>
      <P>
        These Terms are governed by the laws of Ireland, without regard to conflict-of-law
        principles.
      </P>

      <H2>14. Contact</H2>
      <P>
        <a href="mailto:hello@evidenceos.eu" className="underline">hello@evidenceos.eu</a> —
        Veera Venkata Satyanarayana Nargana, founder, EvidenceOS.
      </P>
    </article>
  );
}
