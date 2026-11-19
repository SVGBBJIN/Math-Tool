// The colored header every feature page opens with: a gradient, a big title and an icon,
// so each feature feels like its own place rather than a section of one long page.
import Link from "next/link";
import { IconBack } from "./icons";

export function PageHero({ eyebrow, title, subtitle, from, to, icon, back, children }: {
  eyebrow: string; title: string; subtitle?: string; from: string; to: string;
  icon: React.ReactNode; back?: { href: string; label: string }; children?: React.ReactNode;
}) {
  return (
    <header className="hero card-in" style={{ ["--h1" as string]: from, ["--h2" as string]: to }}>
      <span className="hero-orb hero-orb-a" aria-hidden />
      <span className="hero-orb hero-orb-b" aria-hidden />
      <div className="relative">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 rounded-full bg-white/15 py-1 pl-2 pr-3 text-sm font-semibold text-white/90 transition hover:bg-white/25">
            <IconBack className="h-4 w-4" />{back.label}
          </Link>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">{eyebrow}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1 max-w-prose text-[15px] text-white/85">{subtitle}</p>}
          </div>
          <span className="hero-icon" aria-hidden>{icon}</span>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </header>
  );
}
