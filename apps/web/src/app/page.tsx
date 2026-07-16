/**
 * Landing page (route: `/`).
 *
 * Server Component, fully static — no client JavaScript beyond React's
 * runtime, no data fetching. This page's job is conversion: a compliance
 * officer arriving from a cold outreach email or LinkedIn should
 * understand the regulatory problem, the human-in-the-loop trust
 * argument, and the evidence-chain differentiator within 15 seconds.
 */

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-8 py-[22px]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-accent">
            <span className="h-2.5 w-2.5 rounded-sm border-2 border-accent-fg" />
          </span>
          <span className="text-base font-semibold tracking-tight">EvidenceOS</span>
        </div>
        <nav className="flex items-center gap-7">
          <a href="#problem" className="text-sm text-fg-2">The problem</a>
          <a href="#how" className="text-sm text-fg-2">How it works</a>
          <a href="#trust" className="text-sm text-fg-2">Evidence</a>
          <Link href="/login" className="text-sm font-medium text-fg">Sign in</Link>
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-8 pt-12 pb-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-[11px] py-1.5 font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            EvidenceOS
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-[1.04] font-medium tracking-tight text-fg sm:text-[56px]">
            The AI copilot for the DORA Register of Information
          </h1>
          <p className="mt-[22px] max-w-xl text-lg leading-[1.55] text-fg-2">
            Upload ICT vendor contracts. AI extracts the regulatory fields,
            deterministic rules validate them, and a human approves every
            value — before you export a filing-ready draft.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-xs tracking-wide text-fg-3">
            <span>Upload</span>
            <span className="text-accent">→</span>
            <span>Extract</span>
            <span className="text-accent">→</span>
            <span>Validate</span>
            <span className="text-accent">→</span>
            <span className="font-semibold text-fg">Human review</span>
            <span className="text-accent">→</span>
            <span>Export</span>
          </div>
          <div className="mt-[34px] flex gap-3">
            <Link
              href="/signup"
              className="rounded-[9px] bg-accent px-[22px] py-3.5 text-[15px] font-medium text-accent-fg"
            >
              Create your account
            </Link>
            <a
              href="#how"
              className="rounded-[9px] border border-border bg-surface px-[22px] py-3.5 text-[15px] font-medium text-fg"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* stat card */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div className="font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
            2024 EU-wide dry run · ESAs (EBA/ESMA/EIOPA)
          </div>
          <div className="mt-3.5 flex items-baseline gap-1.5">
            <span className="font-serif text-[88px] leading-[0.9] font-semibold tracking-tight text-danger">
              93.5
            </span>
            <span className="font-serif text-4xl font-medium text-danger">%</span>
          </div>
          <div className="mt-3.5 text-[15px] leading-normal font-medium text-fg">
            of EU financial firms did not pass every one of the 116 DORA
            Register of Information data quality checks.
          </div>
          <div className="my-5 h-px bg-border-2" />
          <div className="flex h-2 gap-1.5 overflow-hidden rounded-full">
            <div className="bg-danger" style={{ flex: 93.5 }} />
            <div className="bg-success" style={{ flex: 6.5 }} />
          </div>
          <div className="mt-2.5 flex justify-between font-mono text-[11px]">
            <span className="text-danger">93.5% failed</span>
            <span className="text-success">6.5% passed</span>
          </div>
          <div className="mt-3.5 text-[11px] leading-snug text-fg-3">
            Source:{" "}
            <a
              href="https://www.eba.europa.eu/publications-and-media/press-releases/esas-dry-run-exercise-shows-goal-reporting-registers-information-under-digital-operational"
              className="underline"
            >
              EBA — ESAs&apos; DORA RoI dry run exercise
            </a>
            , ~1,000 entities, 2024.
          </div>
        </div>
      </section>

      {/* stats strip */}
      <section className="border-t border-b border-border-2 bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-10 px-8 py-5 text-[13px] text-fg-2">
          <span className="font-mono text-[11px] tracking-[0.12em] text-fg-3 uppercase">
            What EvidenceOS covers today
          </span>
          <span><strong className="font-semibold text-fg">7</strong> deterministic rule types</span>
          <span><strong className="font-semibold text-fg">13</strong> DORA fields per contract</span>
          <span><strong className="font-semibold text-fg">4</strong> regulatory templates</span>
          <span><strong className="font-semibold text-fg">100%</strong> human-approved before export</span>
        </div>
      </section>

      {/* the problem */}
      <section id="problem" className="mx-auto max-w-6xl px-8 py-[72px]">
        <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">The problem</div>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-[1.1] font-medium tracking-tight text-fg">
          A spreadsheet can&apos;t satisfy 116 machine quality checks.
        </h2>
        <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-[26px]">
            <div className="font-mono text-[11px] tracking-[0.1em] text-fg-3 uppercase">Today</div>
            <div className="mt-2 mb-2.5 text-[17px] font-semibold text-fg">
              Manual reconciliation in a spreadsheet
            </div>
            <p className="text-sm leading-[1.6] text-fg-2">
              One analyst hand-copies fields out of hundreds of ICT vendor
              contracts into a template — no source traceability, no
              confidence signal, and no way to know which of the 116 checks
              the file will fail until the regulator runs them.
            </p>
          </div>
          <div className="rounded-2xl border border-accent-line bg-surface p-[26px]">
            <div className="font-mono text-[11px] tracking-[0.1em] text-accent uppercase">With EvidenceOS</div>
            <div className="mt-2 mb-2.5 text-[17px] font-semibold text-fg">
              Extract, validate, and prove every value
            </div>
            <p className="text-sm leading-[1.6] text-fg-2">
              Every field is extracted with a confidence score, checked
              against the deterministic rules before you ever file, and
              traced back to the exact clause in the source contract and the
              reviewer who approved it.
            </p>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-t border-b border-border-2 bg-surface-2">
        <div className="mx-auto max-w-6xl px-8 py-[72px]">
          <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">How it works</div>
          <h2 className="mt-3 mb-10 font-serif text-4xl leading-[1.1] font-medium tracking-tight text-fg">
            Five steps. The human owns the decisive one.
          </h2>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="font-mono text-[11px] text-fg-3">01</div>
              <div className="mt-2.5 mb-1.5 text-[15px] font-semibold text-fg">Upload</div>
              <p className="text-[12.5px] leading-[1.5] text-fg-2">
                Drag in ICT vendor contracts — PDF, DOCX, XLSX or CSV.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="font-mono text-[11px] text-fg-3">02</div>
              <div className="mt-2.5 mb-1.5 text-[15px] font-semibold text-fg">AI extract</div>
              <p className="text-[12.5px] leading-[1.5] text-fg-2">
                Structured DORA fields pulled with a confidence score each.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="font-mono text-[11px] text-fg-3">03</div>
              <div className="mt-2.5 mb-1.5 text-[15px] font-semibold text-fg">Validate</div>
              <p className="text-[12.5px] leading-[1.5] text-fg-2">
                Deterministic rules check every value — not the AI&apos;s opinion.
              </p>
            </div>
            <div className="relative rounded-xl border-2 border-accent bg-accent-soft p-5">
              <div className="absolute -top-[9px] left-5 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-accent-fg uppercase">
                The trust gate
              </div>
              <div className="font-mono text-[11px] text-accent">04</div>
              <div className="mt-2.5 mb-1.5 text-[15px] font-bold text-fg">Human review</div>
              <p className="text-[12.5px] leading-[1.5] text-fg-2">
                A compliance analyst approves, corrects or rejects every field.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="font-mono text-[11px] text-fg-3">05</div>
              <div className="mt-2.5 mb-1.5 text-[15px] font-semibold text-fg">Export</div>
              <p className="text-[12.5px] leading-[1.5] text-fg-2">
                A filing-ready draft with a full evidence trail attached.
              </p>
            </div>
          </div>
          <p className="mt-[26px] max-w-2xl text-sm leading-[1.6] text-fg-2">
            EvidenceOS never auto-submits to a regulator. The AI does the
            reading; the analyst makes the call. That separation is the
            entire point.
          </p>
        </div>
      </section>

      {/* trust / evidence */}
      <section id="trust" className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-8 py-[72px] lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Evidence, not assertions</div>
          <h2 className="mt-3 mb-4 font-serif text-4xl leading-[1.1] font-medium tracking-tight text-fg">
            Every value traces back to where it came from.
          </h2>
          <p className="text-[15px] leading-[1.6] text-fg-2">
            A regulator can ask you to defend any figure. In EvidenceOS every
            approved field carries its source document, the exact extracted
            text, its confidence score, and the reviewer and timestamp that
            signed off on it — a permanent audit record, exported alongside
            the filing.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-[22px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-fg-3">b_01.01.0010</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-[9px] py-1 text-[11px] font-semibold text-success">
              ✓ Approved
            </span>
          </div>
          <div className="mt-2.5 text-[13px] text-fg-2">Contractual arrangement reference number</div>
          <div className="mt-1.5 font-mono text-base font-medium text-fg">CA-2026-004417</div>
          <div className="my-4 h-px bg-border-2" />
          <div className="flex flex-col gap-2 text-[12.5px] text-fg-2">
            <div className="flex justify-between">
              <span>Source</span>
              <span className="font-mono text-fg">Nimbus_Cloud_MSA_v3.pdf · p.2</span>
            </div>
            <div className="flex justify-between">
              <span>Confidence</span>
              <span className="font-mono text-success">98%</span>
            </div>
            <div className="flex justify-between">
              <span>Approved by</span>
              <span className="font-mono text-fg">m.okafor · 14 Jul 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto max-w-6xl px-8 pb-20">
        <div className="rounded-[18px] border border-border bg-surface p-[52px] text-center shadow-card">
          <h2 className="mx-auto max-w-xl font-serif text-[40px] leading-[1.08] font-medium tracking-tight text-fg">
            See EvidenceOS on your own contracts.
          </h2>
          <p className="mx-auto mt-4 mb-7 max-w-lg text-base leading-[1.55] text-fg-2">
            Create a free workspace and run your first vendor contract
            through the pipeline in minutes — no sales call required.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/signup" className="rounded-[9px] bg-accent px-6 py-3.5 text-[15px] font-medium text-accent-fg">
              Create your account
            </Link>
            <Link href="/login" className="rounded-[9px] border border-border px-6 py-3.5 text-[15px] font-medium text-fg">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-border-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-7">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-5 rounded-[5px] bg-accent" />
            <span className="text-[13px] text-fg-2">© 2026 EvidenceOS</span>
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-fg-2">
            <span className="h-[7px] w-[7px] rounded-full bg-success" />
            All data stored and processed in EU regions only — GDPR-aligned,
            no data leaves the EU.
          </div>
        </div>
      </footer>
    </div>
  );
}
