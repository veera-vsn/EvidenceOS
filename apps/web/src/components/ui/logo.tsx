/**
 * The EvidenceOS mark (accent square + notch) and wordmark.
 *
 * Was hand-copy-pasted with slightly different pixel values in at least
 * 4 places (login, signup, legal layout, dashboard sidebar/page) before
 * this component existed -- see 2026-07-20 redesign, Phase 1.
 */

import Link from "next/link";

type LogoSize = "sm" | "md";

const SIZES: Record<LogoSize, { mark: string; notch: string; gap: string; text: string }> = {
  sm: { mark: "h-5 w-5", notch: "h-2 w-2", gap: "gap-2", text: "text-[14px]" },
  md: { mark: "h-[26px] w-[26px]", notch: "h-2.5 w-2.5", gap: "gap-2.5", text: "text-base" },
};

interface LogoProps {
  /** Set to `null` to render a non-interactive mark (e.g. inside an
   * already-clickable parent). Defaults to linking home. */
  href?: string | null;
  wordmark?: boolean;
  size?: LogoSize;
  className?: string;
}

export function Logo({ href = "/", wordmark = true, size = "md", className = "" }: LogoProps) {
  const s = SIZES[size];
  const content = (
    <>
      <span className={`flex ${s.mark} flex-none items-center justify-center rounded-md bg-accent`}>
        <span className={`${s.notch} rounded-sm border-2 border-accent-fg`} />
      </span>
      {wordmark && <span className={`${s.text} font-semibold tracking-tight`}>EvidenceOS</span>}
    </>
  );

  const classes = `flex items-center ${s.gap} ${className}`;

  if (!href) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={`${classes} text-fg`}>
      {content}
    </Link>
  );
}
