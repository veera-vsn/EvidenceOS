/**
 * A real empty state -- explains why a view is empty and what to do
 * next, rather than a single bare sentence (the pattern this project's
 * export/review/documents pages used before this component existed).
 * See .claude/skills/frontend-enterprise-design/SKILL.md's "empty,
 * loading, error states" section for the rationale.
 */

import { Button } from "./button";

interface EmptyStateProps {
  /** A single glyph, matching this app's existing icon-in-square
   * convention (see the export page's "§" disclaimer icon). */
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-lg text-fg-3">
          {icon}
        </span>
      )}
      <div>
        <div className="text-sm font-semibold text-fg">{title}</div>
        {description && (
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-fg-2">{description}</p>
        )}
      </div>
      {action && (
        <Button href={action.href} size="sm" className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
