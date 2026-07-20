/**
 * Shared form field primitives, codifying the `rounded-[9px] border-border
 * bg-surface focus:border-accent` pattern previously duplicated as a
 * local `const INPUT = "..."` string in every form file (login, signup,
 * entity-profile-form) (2026-07-20 redesign, Phase 1).
 */

import type {
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const FIELD_BASE =
  "w-full rounded-[9px] border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent disabled:opacity-60";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input className={`${FIELD_BASE} ${className}`} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea className={`${FIELD_BASE} ${className}`} {...rest} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <select className={`${FIELD_BASE} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** Label text -- pair with a real `<label>` wrapper at the call site
 * (`<label className="flex flex-col gap-1.5"><FieldLabel>...</FieldLabel><Input .../></label>`),
 * never a bare placeholder (see the skill's anti-patterns reference). */
export function FieldLabel({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { className?: string }) {
  return (
    <span className={`text-[13px] font-medium text-fg ${className}`} {...rest}>
      {children}
    </span>
  );
}
