/**
 * Shared button, codifying the `rounded-[9px] bg-accent ... hover:opacity-90`
 * pattern that was repeated with slightly different padding/radius at
 * every call site before this component existed (2026-07-20 redesign,
 * Phase 1).
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg font-semibold hover:opacity-90",
  secondary: "border border-border bg-surface text-fg font-medium hover:bg-surface-2",
  ghost: "text-fg-2 font-medium hover:bg-surface-2 hover:text-fg",
  danger: "border border-border text-danger font-medium hover:bg-danger-soft",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "rounded-md px-2.5 py-1.5 text-[12.5px]",
  md: "rounded-[9px] px-4 py-2.5 text-sm",
  lg: "rounded-[10px] px-6 py-3.5 text-[15px]",
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  /** Renders as a real `<Link>` instead of a `<button>`. Combined with
   * `disabled`, renders a real disabled `<button>` instead -- a styled
   * link is still keyboard-activatable even with `aria-disabled`, which
   * is exactly the bug this project's own 2026-07-18 audit fix closed
   * on the Review page's export gate. Don't reintroduce it here. */
  href?: string;
  target?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  href,
  target,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} target={target} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  );
}
