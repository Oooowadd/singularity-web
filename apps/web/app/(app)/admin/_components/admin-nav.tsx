"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "准入", href: "/admin/access" },
  { label: "用户", href: "/admin/users" },
  { label: "用量·成本", href: "/admin/usage" },
  { label: "运维", href: "/admin/ops" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
            pathname.startsWith(tab.href)
              ? "border-foreground font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
