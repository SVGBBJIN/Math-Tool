import { requireContext } from "@/lib/session";
import { label } from "@/lib/tags";
import { AddProblemForms } from "./AddProblemForms";
import { RowActions } from "./RowActions";

const STATUS_STYLE: Record<string, string> = {
  train: "!bg-mastery/10 !text-mastery",
  vault: "!bg-ink !text-white",
  burned: "!bg-familiar/20 !text-ink",
};

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<{ status?: string; tag?: string }> }) {
  const ctx = await requireContext();
  const { status, tag } = await searchParams;
  let q = ctx.supabase
    .from("problems")
    .select("id, source, contest, year, number, url, statement, answer, difficulty, topic_tags, technique_tags, status")
    .eq("household_id", ctx.household.id)
    .order("year", { ascending: false, nullsFirst: false })
    .order("contest")
    .order("number")
    .limit(500);
  if (status) q = q.eq("status", status);
  if (tag) q = q.contains("technique_tags", [tag]);
  const { data: problems } = await q;
  const { data: all } = await ctx.supabase.from("problems").select("status").eq("household_id", ctx.household.id);
  const counts = { train: 0, vault: 0, burned: 0 } as Record<string, number>;
  (all ?? []).forEach((p) => (counts[p.status] = (counts[p.status] ?? 0) + 1));
  const isParent = ctx.profile.role === "parent";

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="h2">Problem bank</h1>
        <p className="text-sm text-muted">AoPS problems are stored as links + metadata only. The vault stays sealed until endurance mode.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/problems" className={`chip ${!status ? "!bg-brand !text-white" : ""}`}>All {all?.length ?? 0}</a>
          {(["train", "vault", "burned"] as const).map((s) => (
            <a key={s} href={`/problems?status=${s}`} className={`chip ${status === s ? "!bg-brand !text-white" : ""}`}>
              {s} {counts[s]}
            </a>
          ))}
          {tag && <a href={status ? `/problems?status=${status}` : "/problems"} className="chip !bg-brand/10 !text-brand">{label(tag)} ✕</a>}
        </div>
      </section>

      <AddProblemForms isParent={isParent} />

      <ul className="space-y-2">
        {(problems ?? []).length === 0 && <li className="card text-muted">No problems yet. Add some above.</li>}
        {(problems ?? []).map((p) => {
          const sealed = p.status === "vault";
          const title = p.source === "aops_wiki" ? `${p.year} ${p.contest} #${p.number}` : (p.statement ?? "").slice(0, 70) + ((p.statement ?? "").length > 70 ? "…" : "");
          return (
            <li key={p.id} className="card !p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{title}</p>
                  <p className="text-xs text-muted">
                    {p.source === "aops_wiki" ? "AoPS wiki" : p.source === "generated" ? "Generated (not official)" : "Pasted"} · position {p.difficulty}
                  </p>
                </div>
                <span className={`chip ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              </div>
              {sealed ? (
                <p className="mt-2 text-xs text-muted">🔒 Sealed for a fresh timed test. Tags and answer hidden.</p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {p.technique_tags.map((t: string) => (
                    <a key={t} href={`/problems?tag=${t}${status ? `&status=${status}` : ""}`} className="chip hover:!bg-brand/10">{label(t)}</a>
                  ))}
                  <details className="ml-auto text-xs">
                    <summary className="cursor-pointer font-semibold text-muted">Answer</summary>
                    <span className="font-bold">{p.answer}</span>
                  </details>
                </div>
              )}
              <RowActions id={p.id} status={p.status} isParent={isParent} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
