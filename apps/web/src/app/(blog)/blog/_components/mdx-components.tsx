/**
 * Element -> styled-JSX map for rendering article MDX bodies. Same
 * prose visual language the (legal) pages' local H2/P/Li helpers use --
 * worth eventually consolidating into one shared prose component (see
 * Phase 3 of the 2026-07-20 redesign), but built here first since the
 * blog is what actually needs table/blockquote support that the legal
 * pages don't.
 */

import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

export const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-9 mb-3 text-xl font-semibold tracking-tight text-fg" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-7 mb-2.5 text-[17px] font-semibold tracking-tight text-fg" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 text-[15px] leading-[1.7] text-fg-2" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mt-4 flex flex-col gap-2 pl-5 text-[15px] leading-[1.7] text-fg-2" {...props} />
  ),
  ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-[1.7] text-fg-2"
      {...props}
    />
  ),
  li: (props: React.LiHTMLAttributes<HTMLLIElement>) => <li className="list-disc" {...props} />,
  a: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    href?.startsWith("/") ? (
      <Link href={href} className="font-medium text-accent underline" {...props} />
    ) : (
      <a href={href} className="font-medium text-accent underline" target="_blank" rel="noreferrer" {...props} />
    ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-fg" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="mt-4 rounded-r-lg border-l-[3px] border-accent-line bg-surface-2 py-2.5 pl-4 text-[14.5px] leading-relaxed text-fg-2 italic"
      {...props}
    />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-[13.5px]" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-surface-2 text-left font-mono text-[11px] tracking-wide text-fg-3 uppercase" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b border-border px-3.5 py-2.5 font-medium" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-border-2 px-3.5 py-2.5 text-fg-2 last:border-b-0" {...props} />
  ),
};
