/**
 * Shared status pill, generalizing the tone->style lookup tables
 * (`VersionBadge`, `RUN_STATUS_STYLES`, `ValidationBadges`'s per-status
 * map) that were each reimplemented per page before this component
 * existed (2026-07-20 redesign, Phase 1).
 *
 * Scoped to pill-shaped status indicators specifically -- the export
 * page's rectangular file-type tags and the pipeline page's icon-square
 * stage pips are a different visual role (see
 * .claude/skills/frontend-enterprise-design/SKILL.md: "apply tokens by
 * role"), not a badge, so they stay as their own small local pieces
 * rather than being forced into this shape.
 */

export type BadgeTone = "success" | "warning" | "danger" | "accent" | "neutral";

const TONE_STYLES: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-fg-2",
};

interface BadgeProps {
  tone: BadgeTone;
  children: React.ReactNode;
  /** Small leading dot, matching the existing VersionBadge/run-status pattern. */
  dot?: boolean;
  className?: string;
}

export function Badge({ tone, children, dot = false, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold capitalize ${TONE_STYLES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
