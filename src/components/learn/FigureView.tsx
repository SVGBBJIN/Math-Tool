// Draws a card's figure from its coordinates (SVG, scales with the card). With a `tap`
// interaction, its targets become toggle buttons.
import type { Figure, Pt } from "@/lib/learn/cards/types";

const ARC_R = 18;
function anglePath(at: Pt, p: Pt, q: Pt, r: number): string {
  const a1 = Math.atan2(p[1] - at[1], p[0] - at[0]);
  let d = Math.atan2(q[1] - at[1], q[0] - at[0]) - a1;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  const s = [at[0] + r * Math.cos(a1), at[1] + r * Math.sin(a1)];
  const e = [at[0] + r * Math.cos(a1 + d), at[1] + r * Math.sin(a1 + d)];
  return `M ${s[0]} ${s[1]} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${e[0]} ${e[1]}`;
}
function squarePath(at: Pt, p: Pt, q: Pt, r: number): string {
  const unit = (v: Pt): Pt => { const l = Math.hypot(v[0] - at[0], v[1] - at[1]); return [(v[0] - at[0]) / l, (v[1] - at[1]) / l]; };
  const [u, w] = [unit(p), unit(q)];
  const k = r * 0.55;
  return `M ${at[0] + u[0] * k} ${at[1] + u[1] * k} L ${at[0] + (u[0] + w[0]) * k} ${at[1] + (u[1] + w[1]) * k} L ${at[0] + w[0] * k} ${at[1] + w[1] * k}`;
}
function ticks(a: Pt, b: Pt, n: number): string {
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [ux, uy] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const [nx, ny] = [-uy * 5, ux * 5];
  return Array.from({ length: n }, (_, i) => {
    const off = (i - (n - 1) / 2) * 4;
    const [cx, cy] = [mx + ux * off, my + uy * off];
    return `M ${cx - nx} ${cy - ny} L ${cx + nx} ${cy + ny}`;
  }).join(" ");
}

export function FigureView({ figure, selected, onToggle, reveal }: {
  figure: Figure;
  /** Selected target ids (tap interaction). */
  selected?: string[];
  onToggle?: (id: string) => void;
  /** After answering: target ids that were right. */
  reveal?: string[];
}) {
  const ink = "var(--color-ink)";
  const accent = "var(--color-brand)";
  return (
    <figure className="my-4 flex justify-center">
      <svg viewBox={`0 0 ${figure.w} ${figure.h}`} className="h-auto w-full" style={{ maxWidth: Math.min(420, figure.w * 1.5) }} role="img" aria-label={figure.alt}>
        <title>{figure.alt}</title>
        {figure.items.map((it, k) => {
          switch (it.t) {
            case "line": return <line key={k} x1={it.a[0]} y1={it.a[1]} x2={it.b[0]} y2={it.b[1]} stroke={ink} strokeWidth={1.6} strokeDasharray={it.dash ? "5 4" : undefined} strokeLinecap="round" />;
            case "poly": return <polygon key={k} points={it.pts.map((p) => p.join(",")).join(" ")} fill={it.fill === "tint" ? "rgba(24,101,242,0.08)" : it.fill === "accent" ? "rgba(24,101,242,0.18)" : "none"} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />;
            case "circle": return <circle key={k} cx={it.c[0]} cy={it.c[1]} r={it.r} fill="none" stroke={ink} strokeWidth={1.6} />;
            case "dot": return <circle key={k} cx={it.at[0]} cy={it.at[1]} r={2.6} fill={ink} />;
            case "label": {
              const single = /^[A-Za-zℓ]$/.test(it.text);
              return (
                <text key={k} x={it.at[0]} y={it.at[1]} textAnchor="middle" dominantBaseline="middle" fontSize={single ? 15 : 13}
                  fontStyle={single ? "italic" : undefined} fontFamily={single ? "var(--font-math)" : "var(--font-sans)"} fontWeight={it.tone === "accent" ? 700 : 500}
                  fill={it.tone === "accent" ? accent : it.tone === "muted" ? "var(--color-muted)" : ink}>{it.text}</text>
              );
            }
            case "angle": return <path key={k} d={it.square ? squarePath(it.at, it.p, it.q, it.r ?? ARC_R) : anglePath(it.at, it.p, it.q, it.r ?? ARC_R)} fill="none" stroke={it.tone === "accent" ? accent : ink} strokeWidth={it.tone === "accent" ? 2.2 : 1.3} />;
            case "tick": return <path key={k} d={ticks(it.a, it.b, it.n ?? 1)} stroke={ink} strokeWidth={1.4} />;
            case "target": {
              if (!onToggle && !reveal) return null;
              const on = selected?.includes(it.id);
              const right = reveal?.includes(it.id);
              const fill = reveal ? (right ? "rgba(14,140,110,0.28)" : on ? "rgba(217,41,22,0.22)" : "transparent") : on ? "rgba(24,101,242,0.3)" : "rgba(24,101,242,0.05)";
              const stroke = reveal ? (right ? "var(--color-apply)" : on ? "var(--color-danger)" : "var(--color-line)") : on ? accent : "rgba(24,101,242,0.35)";
              return (
                <g key={k} role={onToggle ? "button" : undefined} tabIndex={onToggle ? 0 : undefined} aria-pressed={onToggle ? !!on : undefined} aria-label={it.name}
                  className={onToggle ? "cursor-pointer outline-none" : undefined}
                  onClick={onToggle ? () => onToggle(it.id) : undefined}
                  onKeyDown={onToggle ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(it.id); } } : undefined}>
                  <circle cx={it.at[0]} cy={it.at[1]} r={it.r ?? 12} fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray={on || reveal ? undefined : "3 3"} />
                </g>
              );
            }
          }
        })}
      </svg>
    </figure>
  );
}
