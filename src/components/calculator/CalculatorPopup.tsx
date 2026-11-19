"use client";
// A floating step-by-step calculator, available on every page. It opens as a panel that
// doesn't block the page, so the problem you're working on stays visible beside it (on a
// phone it covers most of the screen and closes with ✕ or Esc). The math is in src/lib/calc.
import { useEffect, useId, useRef, useState } from "react";
import { DOMAINS, TOOLS, runTool, type CalcResult, type Domain, type Tool } from "@/lib/calc";
import { parseRich } from "@/lib/learn/cards/markup";
import { Rich } from "@/components/learn/Rich";

const DOMAIN_COLOR: Record<Domain, string> = {
  Arithmetic: "var(--color-brand)",
  "Number theory": "var(--color-nt)",
  Counting: "var(--color-cp)",
  Algebra: "var(--color-alg)",
};

/** Rich text that falls back to plain text instead of crashing on unexpected markup. */
function SafeRich({ text }: { text: string }) {
  try {
    parseRich(text);
  } catch {
    return <span>{text.replace(/\$/g, "")}</span>;
  }
  return <Rich text={text} />;
}

function CalcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
      <rect x="7.5" y="5.5" width="9" height="4" rx="1" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" strokeWidth={2.6} />
    </svg>
  );
}

export function CalculatorPopup() {
  const [open, setOpen] = useState(false);
  const [toolId, setToolId] = useState(TOOLS[0].id);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [outcome, setOutcome] = useState<{ toolId: string; result?: CalcResult; error?: string } | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelId = useId();

  const tool = TOOLS.find((t) => t.id === toolId)!;
  const domain = tool.domain;
  const vals = values[toolId] ?? {};
  const shown = outcome?.toolId === toolId ? outcome : null;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, [open]);

  useEffect(() => {
    // Scroll only the panel's own body (scrollIntoView would also scroll the fixed panel itself).
    const box = scrollRef.current;
    const res = resultRef.current;
    if (shown && box && res) box.scrollTo({ top: res.offsetTop - 12, behavior: "smooth" });
  }, [shown]);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  const setField = (key: string, v: string) => setValues((all) => ({ ...all, [toolId]: { ...all[toolId], [key]: v } }));
  const pickTool = (t: Tool) => setToolId(t.id);
  const pickDomain = (d: Domain) => pickTool(TOOLS.find((t) => t.domain === d)!);

  const calculate = (input: Record<string, string>) => {
    const filled = Object.fromEntries(tool.fields.map((f) => [f.key, input[f.key] ?? (f.kind === "select" ? f.options![0][0] : "")]));
    const r = runTool(tool, filled);
    setOutcome({ toolId, ...("error" in r ? { error: r.error } : { result: r.result }) });
  };

  const color = DOMAIN_COLOR[domain];

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-20 inline-flex h-12 items-center gap-2 rounded-full px-4 font-semibold text-white shadow-[0_10px_24px_-10px_rgba(76,29,149,0.8)] transition hover:-translate-y-px hover:brightness-110 md:bottom-[calc(6rem+env(safe-area-inset-bottom))] md:right-6"
        style={{ backgroundImage: "linear-gradient(135deg, var(--color-brand), var(--color-violet))" }}
      >
        <CalcIcon className="h-5 w-5" />
        <span className="hidden sm:inline">{open ? "Close" : "Calculator"}</span>
        <span className="sr-only sm:hidden">{open ? "Close calculator" : "Open calculator"}</span>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
        className="fixed inset-x-2 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] top-2 z-30 flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-20px_rgba(76,29,149,0.55)] ring-1 ring-black/10 data-[open=false]:hidden md:inset-x-auto md:bottom-[calc(10rem+env(safe-area-inset-bottom))] md:right-6 md:top-auto md:h-[min(720px,calc(100dvh-12rem))] md:w-[440px]"
        data-open={open}
      >
        <header className="flex items-center justify-between gap-2 px-4 py-3 text-white" style={{ backgroundImage: `linear-gradient(125deg, ${color}, var(--color-violet))` }}>
          <div className="flex items-center gap-2">
            <CalcIcon className="h-5 w-5" />
            <h2 id={titleId} className="font-bold">Step-by-step calculator</h2>
          </div>
          <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-xl leading-none hover:bg-white/20" aria-label="Close calculator">
            ×
          </button>
        </header>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-3">
          {/* Area, then tool */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Area">
            {DOMAINS.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === domain}
                onClick={() => pickDomain(d)}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${d === domain ? "text-white shadow-sm" : "bg-canvas text-muted hover:text-ink"}`}
                style={d === domain ? { background: DOMAIN_COLOR[d] } : undefined}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="label mt-3" htmlFor={`${panelId}-tool`}>Tool</label>
          <select id={`${panelId}-tool`} className="input" value={toolId} onChange={(e) => setToolId(e.target.value)}>
            {TOOLS.filter((t) => t.domain === domain).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-muted">{tool.blurb}</p>

          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              calculate(vals);
            }}
          >
            {tool.fields.map((f) => {
              const id = `${panelId}-${tool.id}-${f.key}`;
              const v = vals[f.key] ?? "";
              return (
                <div key={f.key}>
                  <label className="label" htmlFor={id}>
                    {f.label}
                    {f.optional && <span className="font-normal"> (optional)</span>}
                  </label>
                  {f.kind === "select" ? (
                    <select id={id} className="input" value={v || f.options![0][0]} onChange={(e) => setField(f.key, e.target.value)}>
                      {f.options!.map(([val, lab]) => (
                        <option key={val} value={val}>{lab}</option>
                      ))}
                    </select>
                  ) : f.kind === "lines" ? (
                    <textarea
                      id={id}
                      className="input min-h-28 font-[family-name:var(--font-math)]"
                      value={v}
                      placeholder={f.placeholder}
                      spellCheck={false}
                      onChange={(e) => setField(f.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          calculate(vals);
                        }
                      }}
                    />
                  ) : (
                    <input
                      id={id}
                      className="input font-[family-name:var(--font-math)]"
                      value={v}
                      placeholder={f.placeholder}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}
                  {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className="btn flex-1">Show steps</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setValues((all) => ({ ...all, [toolId]: tool.example }));
                  calculate(tool.example);
                }}
              >
                Example
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setValues((all) => ({ ...all, [toolId]: {} }));
                  setOutcome(null);
                }}
              >
                Clear
              </button>
            </div>
          </form>

          <div ref={resultRef} aria-live="polite">
            {shown?.error && (
              <p className="callout mt-4 border-2 border-danger/30 bg-danger/5 text-sm text-danger" role="alert">
                {shown.error}
              </p>
            )}
            {shown?.result && (
              <div className="mt-5">
                <ol className="space-y-3">
                  {shown.result.steps.map((s, k) => (
                    <li key={k} className="rounded-2xl border border-line bg-paper p-3">
                      <p className="mb-1 flex items-center gap-2 text-sm font-bold">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: color }} aria-hidden>
                          {k + 1}
                        </span>
                        <span>
                          <span className="sr-only">Step {k + 1}: </span>
                          {s.title}
                        </span>
                      </p>
                      <div className="space-y-1.5 overflow-x-auto pl-8 text-[15px] leading-relaxed">
                        {s.lines.map((l, j) => (
                          <p key={j}><SafeRich text={l} /></p>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="callout mt-3 border-2" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 7%, white)` }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>Answer</p>
                  <p className="mt-1 overflow-x-auto text-lg font-semibold"><SafeRich text={shown.result.answer} /></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
