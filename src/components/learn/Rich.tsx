// Renders card text: plain words, **bold**, and $math$ (see src/lib/learn/cards/markup.ts).
import { Fragment } from "react";
import { parseRich, unaryAt, type MathNode } from "@/lib/learn/cards/markup";

function MathNodes({ nodes }: { nodes: MathNode[] }) {
  return (
    <>
      {nodes.map((n, k) => {
        switch (n.t) {
          case "var": return <i key={k}>{n.s}</i>;
          case "sym": return <span key={k}>{n.s}</span>;
          case "text": return <span key={k} style={{ fontFamily: "var(--font-sans)", fontSize: "0.92em" }}>{n.s}</span>;
          case "op": return n.s === "−" && unaryAt(nodes, k) ? <span key={k}>−</span> : <span key={k} className="op">{n.s}</span>;
          case "sup": return <sup key={k}><MathNodes nodes={n.body} /></sup>;
          case "sub": return <sub key={k}><MathNodes nodes={n.body} /></sub>;
          case "frac": return <span key={k} className="frac"><span><MathNodes nodes={n.num} /></span><span><MathNodes nodes={n.den} /></span></span>;
          case "binom": return <span key={k}>(<span className="binom"><span><MathNodes nodes={n.top} /></span><span><MathNodes nodes={n.bottom} /></span></span>)</span>;
          case "sqrt": return <span key={k}>√<span className="radicand"><MathNodes nodes={n.body} /></span></span>;
        }
      })}
    </>
  );
}

export function Rich({ text, className }: { text: string; className?: string }) {
  const segments = parseRich(text);
  return (
    <span className={className}>
      {segments.map((s, k) =>
        s.t === "text" ? <Fragment key={k}>{s.s}</Fragment> : s.t === "bold" ? <strong key={k}>{s.s}</strong> : <span key={k} className="math"><MathNodes nodes={s.nodes} /></span>,
      )}
    </span>
  );
}
