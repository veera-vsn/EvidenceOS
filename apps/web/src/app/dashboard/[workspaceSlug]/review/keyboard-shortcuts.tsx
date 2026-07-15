"use client";

/**
 * ReviewKeyboardShortcuts — page-level A/E/R/↓ shortcuts for the review
 * detail page, advertised in its header hint.
 *
 * Deliberately DOM-based rather than lifting FieldReviewCard's state into
 * a shared store: each field card's Approve/Edit/Reject button already
 * carries `data-field-code`/`data-action` attributes, so this component
 * just finds the first still-pending field and simulates a real click on
 * its button — a real click event, so React's own handlers run exactly as
 * if the user had clicked it. This keeps the working per-field logic in
 * `field-review-card.tsx` completely untouched.
 *
 * "Next" (↓) has no separate concept of keyboard focus to move between —
 * it scrolls the next pending field into view, which is the same "first
 * thing that needs your attention" target A/E/R already act on.
 */

import { useEffect } from "react";

interface ReviewKeyboardShortcutsProps {
  /** Field codes in on-page order, so "first pending" matches what a
   * reviewer scanning top-to-bottom would expect. */
  fieldCodes: string[];
}

export function ReviewKeyboardShortcuts({ fieldCodes }: ReviewKeyboardShortcutsProps) {
  useEffect(() => {
    function firstPendingCard(): HTMLElement | null {
      for (const code of fieldCodes) {
        const card = document.getElementById(`field-${code}`);
        if (card?.dataset.decision === "pending") return card;
      }
      return null;
    }

    function onKeyDown(e: KeyboardEvent) {
      // Ignore keystrokes while typing in a form field.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key !== "a" && key !== "e" && key !== "r" && e.key !== "ArrowDown") return;

      const card = firstPendingCard();
      if (!card) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const action = key === "a" ? "approve" : key === "e" ? "edit" : "reject";
      const button = card.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (button && !button.disabled) {
        e.preventDefault();
        button.click();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fieldCodes]);

  return null;
}
