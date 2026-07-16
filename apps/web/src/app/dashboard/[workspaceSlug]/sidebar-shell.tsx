"use client";

/**
 * Mobile drawer wrapper for the workspace sidebar. Below `md` (768px) the
 * sidebar is off-canvas by default, opened via a hamburger button in a
 * slim mobile top bar, and closes automatically on navigation (via
 * `usePathname()`, the same hook `SidebarNav` already uses for active-link
 * highlighting) or by tapping the overlay. At `md` and above this renders
 * as a no-op passthrough — the sidebar shows persistently exactly as
 * before, same markup, no drawer behaviour.
 *
 * The only new client-side state in the compact/mobile redesign — every
 * other change in that pass is pure CSS.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="flex h-11 flex-none items-center gap-2.5 border-b border-border-2 bg-surface px-3 md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-fg hover:bg-surface-2"
          aria-label="Open menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-[13.5px] font-semibold text-fg">EvidenceOS</span>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex h-full w-[220px] flex-none flex-col overflow-y-auto border-r border-border-2 bg-surface transition-transform duration-150 md:static md:z-auto md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
