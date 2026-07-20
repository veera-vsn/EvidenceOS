/**
 * Shared bordered surface container -- the `rounded-2xl border
 * border-border bg-surface` pattern already used consistently
 * throughout the app, formalized into one place (2026-07-20 redesign,
 * Phase 1). Padding is deliberately left to the call site (it varies
 * by context: p-5, p-6, p-[26px], p-8) rather than baked in here.
 */

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** The accent-line border variant used to mark something as
   * ready/highlighted (e.g. the export page's "ready to export" card,
   * the landing page's "with EvidenceOS" comparison card). */
  accent?: boolean;
}

export function Card({ children, className = "", accent = false }: CardProps) {
  return (
    <div className={`rounded-2xl border ${accent ? "border-accent-line" : "border-border"} bg-surface ${className}`}>
      {children}
    </div>
  );
}
