"use client";
import { useMemo, useState } from "react";
import { useGuest } from "@/lib/guest/GuestProvider";
import { addProblems, deleteProblem, setProblemStatus } from "@/lib/guest/engine";
import { parseAopsForm, parseCsv, parsePastedForm, type ProblemInput } from "@/lib/problem-input";
import { label } from "@/lib/tags";
import { AddProblemForms, type AddProblemActions } from "../../(app)/problems/AddProblemForms";
import { RowActions, type RowActionHandlers } from "../../(app)/problems/RowActions";

const STATUS_STYLE: Record<string, string> = {
  train: "!bg-mastery/10 !text-mastery",
  vault: "!bg-ink !text-white",
  burned: "!bg-familiar/20 !text-ink",
};

export default function GuestProblems() {
  const { state, update } = useGuest();
  const [status, setStatus] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const addOne = (parsed: ReturnType<typeof parseAopsForm>) => {
    if (!parsed.ok) return { error: parsed.error };
    const r = update((d) => addProblems(d, [parsed.value]));
    return r.added ? { message: "Added." } : { error: "That problem is already in the bank" };
  };
  const addActions = useMemo<AddProblemActions>(
    () => ({
      addAopsProblem: async (_, form) => addOne(parseAopsForm(form)),
      addPastedProblem: async (_, form) => addOne(parsePastedForm(form)),
      importCsv: async (_, form) => {
        const text = String(form.get("csv") ?? "").trim();
        if (!text) return { error: "Paste CSV rows" };
        const { rows, errors } = parseCsv(text);
        const { added, skipped } = update((d) => addProblems(d, rows as ProblemInput[]));
        return {
          message: `Imported ${added}${skipped ? `, ${skipped} already in bank` : ""}.`,
          error: errors.length ? errors.slice(0, 10).join("\n") : undefined,
        };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update],
  );
  const rowActions = useMemo<RowActionHandlers>(
    () => ({
      setProblemStatus: async (id, s) => update((d) => setProblemStatus(d, id, s)),
      deleteProblem: async (id) => update((d) => deleteProblem(d, id)),
    }),
    [update],
  );

  if (!state) return <p className="card text-muted">Loading…</p>;

  const counts: Record<string, number> = { train: 0, vault: 0, burned: 0 };
  state.problems.forEach((p) => (counts[p.status] = (counts[p.status] ?? 0) + 1));
  const problems = state.problems
    .filter((p) => (!status || p.status === status) && (!tag || p.technique_tags.includes(tag)))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.contest ?? "").localeCompare(b.contest ?? "") || (a.number ?? a.difficulty) - (b.number ?? b.difficulty))
    .slice(0, 500);

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="h2">Problem bank</h1>
        <p className="text-sm text-muted">AoPS problems are stored as links + metadata only. The vault stays sealed until endurance mode.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`chip ${!status ? "!bg-brand !text-white" : ""}`} onClick={() => setStatus(null)}>All {state.problems.length}</button>
          {(["train", "vault", "burned"] as const).map((s) => (
            <button key={s} className={`chip ${status === s ? "!bg-brand !text-white" : ""}`} onClick={() => setStatus(status === s ? null : s)}>
              {s} {counts[s]}
            </button>
          ))}
          {tag && <button className="chip !bg-brand/10 !text-brand" onClick={() => setTag(null)}>{label(tag)} ✕</button>}
        </div>
      </section>

      <AddProblemForms isParent actions={addActions} />

      <ul className="space-y-2">
        {problems.length === 0 && <li className="card text-muted">No problems yet. Add some above.</li>}
        {problems.map((p) => {
          const sealed = p.status === "vault";
          const title = p.source === "aops_wiki" ? `${p.year} ${p.contest} #${p.number}` : (p.statement ?? "").slice(0, 70) + ((p.statement ?? "").length > 70 ? "…" : "");
          return (
            <li key={p.id} className="card !p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{title}</p>
                  <p className="text-xs text-muted">
                    {p.source === "aops_wiki" ? "AoPS wiki" : "Pasted"} · position {p.difficulty}
                  </p>
                </div>
                <span className={`chip ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              </div>
              {sealed ? (
                <p className="mt-2 text-xs text-muted">🔒 Sealed for a fresh timed test. Tags and answer hidden.</p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {p.technique_tags.map((t) => (
                    <button key={t} className="chip hover:!bg-brand/10" onClick={() => setTag(t)}>{label(t)}</button>
                  ))}
                  <details className="ml-auto text-xs">
                    <summary className="cursor-pointer font-semibold text-muted">Answer</summary>
                    <span className="font-bold">{p.answer}</span>
                  </details>
                </div>
              )}
              <RowActions id={p.id} status={p.status} isParent actions={rowActions} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
