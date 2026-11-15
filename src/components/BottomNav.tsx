"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/trainer", label: "Trainer" },
  { href: "/moves", label: "Moves" },
  { href: "/errors", label: "Errors" },
  { href: "/problems", label: "Bank" },
  { href: "/settings", label: "Settings" },
];

export function BottomNav({ base = "" }: { base?: string }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="shell-nav">
        {TABS.map((t) => {
          const href = t.href === "/" ? base || "/" : `${base}${t.href}`;
          const active = t.href === "/" ? path === href : path.startsWith(href);
          return (
            <li key={t.href}>
              <Link
                href={href}
                className={`flex items-center justify-center py-3 text-sm font-semibold transition hover:text-ink md:py-4 ${active ? "text-brand" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
