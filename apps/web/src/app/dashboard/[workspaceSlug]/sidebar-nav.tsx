"use client";

/**
 * The only interactive piece of the workspace sidebar: nav links with
 * active-route highlighting. Split into its own Client Component
 * (needs `usePathname()`) so the rest of the sidebar shell — logo,
 * workspace card, user footer — stays a Server Component.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarNavProps {
  workspaceSlug: string;
  reviewQueueCount: number;
}

const ACTIVE = "flex items-center gap-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-[13px] font-semibold text-accent";
const INACTIVE = "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-fg-2 hover:bg-surface-2 hover:text-fg";

export function SidebarNav({ workspaceSlug, reviewQueueCount }: SidebarNavProps) {
  const pathname = usePathname();

  const items = [
    { href: `/dashboard/${workspaceSlug}/documents`, label: "Documents", icon: "▤" },
    { href: `/dashboard/${workspaceSlug}/pipeline`, label: "Pipeline", icon: "▷" },
    { href: `/dashboard/${workspaceSlug}/review`, label: "Review", icon: "✓", badge: reviewQueueCount },
    { href: `/dashboard/${workspaceSlug}/export`, label: "Export", icon: "↧" },
    { href: `/dashboard/${workspaceSlug}/settings`, label: "Settings", icon: "⚙" },
  ];

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? ACTIVE : INACTIVE}>
            <span className="w-[15px] text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-px font-mono text-[10.5px] font-semibold ${
                  active ? "bg-accent text-accent-fg" : "bg-warning-soft text-warning"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
