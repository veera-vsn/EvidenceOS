/**
 * Shared inline banner, codifying the icon+title+body pattern repeated
 * (with minor drift) across login, signup, settings, and
 * field-review-card before this component existed (2026-07-20 redesign,
 * Phase 1).
 */

export type AlertVariant = "success" | "error" | "info";

const ALERT_STYLES: Record<AlertVariant, { border: string; bg: string; text: string; icon: string }> = {
  success: { border: "border-success", bg: "bg-success-soft", text: "text-success", icon: "✓" },
  error: { border: "border-danger", bg: "bg-danger-soft", text: "text-danger", icon: "!" },
  info: { border: "border-border-2", bg: "bg-surface-2", text: "text-accent", icon: "✉" },
};

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant, title, children, className = "" }: AlertProps) {
  const s = ALERT_STYLES[variant];
  // Errors interrupt and must be announced immediately; success/info are
  // ambient confirmations -- matches the role split already established
  // in login/signup.
  const role = variant === "error" ? "alert" : "status";

  return (
    <div role={role} className={`flex gap-2.5 rounded-[10px] border ${s.border} ${s.bg} px-3.5 py-3 ${className}`}>
      <span className={`text-[15px] leading-tight ${s.text}`}>{s.icon}</span>
      <div>
        {title && <div className={`text-[13.5px] font-semibold ${s.text}`}>{title}</div>}
        <div className={`${title ? "mt-0.5" : ""} text-[12.5px] leading-relaxed text-fg-2`}>{children}</div>
      </div>
    </div>
  );
}
