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

  // Close on navigation. Deliberately *not* a useEffect: calling setState
  // unconditionally in an effect body causes an extra render-then-commit
  // cascade the react-hooks/set-state-in-effect rule now flags as an
  // error. This is React's own documented pattern for "adjust state when
  // a prop changes" instead — comparing against the previous render's
  // value and calling setState directly during render, which React
  // handles by re-rendering immediately before committing, no flicker.
  // See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  // Close on Escape — a real useEffect is the right tool here: it
  // subscribes to an external system (the document's keydown stream) and
  // only calls setState from within that callback, not unconditionally
  // in the effect body itself. Also closes the accessibility gap noted
  // in Project_Docs/AUDIT_2026-07-18.md — previously the only way to
  // dismiss the drawer was tapping the overlay or navigating away.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
