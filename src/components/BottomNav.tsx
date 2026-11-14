"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "☀️" },
  { href: "/trainer", label: "Trainer", icon: "🎯" },
  { href: "/errors", label: "Errors", icon: "📓" },
  { href: "/problems", label: "Bank", icon: "📚" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function BottomNav({ base = "" }: { base?: string }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((t) => {
          const href = t.href === "/" ? base || "/" : `${base}${t.href}`;
          const active = t.href === "/" ? path === href : path.startsWith(href);
          return (
            <li key={t.href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${active ? "text-brand" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
