/**
 * Shared prose primitives for the legal pages (Privacy Policy, Terms of
 * Service) -- identical H2/P/Li helpers were previously duplicated in
 * both page files (2026-07-20 redesign, Phase 3). Deliberately separate
 * from the blog's MDX prose components (blog/_components/mdx-components.tsx)
 * rather than one shared "prose" component -- legal documents want a
 * denser, more compact style (mb-* margins, smaller text) than long-form
 * articles do, and forcing both into one visual spec would serve
 * neither well.
 */

export function LegalH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-lg font-semibold tracking-tight text-fg first:mt-0">
      {children}
    </h2>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[14.5px] leading-[1.65] text-fg-2">{children}</p>;
}

export function LegalLi({ children }: { children: React.ReactNode }) {
  return <li className="mb-2 text-[14.5px] leading-[1.65] text-fg-2">{children}</li>;
}
