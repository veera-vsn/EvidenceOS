/**
 * Landing page (route: `/`).
 *
 * This is a Server Component (default in the App Router) — it renders on
 * the server and streams HTML to the browser. No JavaScript is shipped
 * for this page beyond React's runtime.
 *
 * We also fetch the backend health endpoint here to prove the API is
 * reachable. The fetch runs server-side, so a failing backend does not
 * block the page — it just renders a "down" pill.
 */
import { fetchBackendHealth } from "@/lib/api";

export default async function Home() {
  const health = await fetchBackendHealth();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-24">
      <header className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-widest text-foreground/60">
          EvidenceOS
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          AI-powered DORA Register of Information copilot.
        </h1>
        <p className="max-w-xl text-lg text-foreground/70">
          Turn contracts, spreadsheets, and vendor inventories into a
          submission-ready RoI draft — with evidence, validation, and
          explainable recommendations that always stay under human control.
        </p>
      </header>

      <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6">
        <h2 className="text-sm font-semibold text-foreground/80">
          System status
        </h2>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <StatusPill ok={health.ok} />
          <span className="font-mono text-foreground/70">
            {health.ok
              ? `API reachable (${health.env ?? "unknown"})`
              : "API unreachable — start the backend on port 8000"}
          </span>
        </div>
      </section>

      <footer className="text-xs text-foreground/50">
        Walking skeleton · Phase 0 · See{" "}
        <code className="font-mono">Project_Docs/Learnings/</code> for the
        build log.
      </footer>
    </main>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  const colour = ok ? "bg-success" : "bg-danger";
  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full ${colour}`}
      aria-label={ok ? "Healthy" : "Unhealthy"}
    />
  );
}
