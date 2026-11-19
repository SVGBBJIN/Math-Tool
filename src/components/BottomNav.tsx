"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Each tab has its own color; the active one fills with it.
const TABS: { href: string; label: string; color: string; also?: string[] }[] = [
  { href: "/", label: "Today", color: "var(--color-violet)", also: ["/problem"] },
  { href: "/map", label: "Map", color: "var(--color-brand)", also: ["/progress"] },
  { href: "/errors", label: "Errors", color: "#be185d" },
  { href: "/problems", label: "Bank", color: "var(--color-apply)" },
  { href: "/settings", label: "Settings", color: "#b45309" },
];

export function BottomNav({ base = "" }: { base?: string }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-violet/10 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(76,29,149,0.35)] backdrop-blur">
      <ul className="shell-nav gap-1 px-1 py-1.5 md:py-2">
        {TABS.map((t) => {
          const href = t.href === "/" ? base || "/" : `${base}${t.href}`;
          const extra = (t.also ?? []).some((a) => path.startsWith(`${base}${a}`));
          const active = extra || (t.href === "/" ? path === href : path.startsWith(href));
          return (
            <li key={t.href}>
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold transition md:py-2.5 ${active ? "text-white shadow-sm" : "text-muted hover:bg-black/[0.03]"}`}
                style={active ? { background: t.color } : undefined}
                aria-current={active ? "page" : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "white" : t.color }} aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
