import { householdStudent, requireContext } from "@/lib/session";
import { ERROR_TYPES, label } from "@/lib/tags";
import { ERROR_REVIEW_TARGET } from "@/lib/plan";
import { weekday } from "@/lib/dates";
import { ReviewClient, type MissRow } from "./ReviewClient";

export default async function ErrorsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireContext();
  const student = await householdStudent(ctx);
  if (!student) return <div className="card text-muted">No student yet.</div>;
  const { type } = await searchParams;

  const [{ data: misses }, { data: reviews }, { count: total }] = await Promise.all([
    ctx.supabase
      .from("attempts")
      .select("id, local_date, answer, error_type, key_idea, seconds, familiar, problems(id, source, contest, year, number, url, solution_url, statement, answer, technique_tags)")
      .eq("student_id", student.id)
      .eq("correct", false)
      .eq("finalized", true)
      .order("created_at", { ascending: true }),
    ctx.supabase.from("error_reviews").select("attempt_id, takeaway, local_date").eq("student_id", student.id),
    ctx.supabase.from("attempts").select("id", { count: "exact", head: true }).eq("student_id", student.id).eq("finalized", true).eq("familiar", false),
  ]);

  type Raw = {
    id: string; local_date: string; answer: string | null; error_type: string; key_idea: string; seconds: number; familiar: boolean;
    problems: { id: string; source: string; contest: string | null; year: number | null; number: number | null; url: string | null; solution_url: string | null; statement: string | null; answer: string; technique_tags: string[] } | null;
  };
  const reviewBy = new Map((reviews ?? []).map((r) => [r.attempt_id, r]));
  const rows: MissRow[] = ((misses ?? []) as unknown as Raw[]).map((m) => ({
    id: m.id,
    date: m.local_date,
    yourAnswer: m.answer,
    correctAnswer: m.problems?.answer ?? "?",
    errorType: m.error_type,
    keyIdea: m.key_idea,
    familiar: m.familiar,
    title: m.problems?.source === "aops_wiki" ? `${m.problems.year} ${m.problems.contest} #${m.problems.number}` : (m.problems?.statement ?? "").slice(0, 60) + "…",
    link: m.problems?.solution_url ?? m.problems?.url ?? null,
    tags: m.problems?.technique_tags ?? [],
    takeaway: reviewBy.get(m.id)?.takeaway ?? null,
  }));

  const unfamiliarMisses = rows.filter((r) => !r.familiar);
  const counts = Object.fromEntries(ERROR_TYPES.map((e) => [e.value, unfamiliarMisses.filter((r) => r.errorType === e.value).length]));
  const carelessShare = unfamiliarMisses.length ? Math.round(((counts.careless ?? 0) + (counts.misread ?? 0)) / unfamiliarMisses.length * 100) : 0;
  const reviewedToday = (reviews ?? []).filter((r) => r.local_date === ctx.today).length;
  const pending = rows.filter((r) => !r.takeaway);
  const shown = type ? rows.filter((r) => r.errorType === type) : rows;
  const isWednesday = weekday(ctx.today) === 3;

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="h2">Error log</h1>
        <p className="text-sm text-muted">
          {unfamiliarMisses.length} misses on {total ?? 0} fresh attempts · careless + misread = {carelessShare}% of misses
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/errors" className={`chip ${!type ? "!bg-brand !text-white" : ""}`}>All {rows.length}</a>
          {ERROR_TYPES.map((e) => (
            <a key={e.value} href={`/errors?type=${e.value}`} className={`chip ${type === e.value ? "!bg-brand !text-white" : ""}`}>
              {e.label} {counts[e.value]}
            </a>
          ))}
        </div>
      </section>

      {ctx.profile.role === "student" && (
        <ReviewClient
          pending={pending}
          reviewedToday={reviewedToday}
          target={Math.min(ERROR_REVIEW_TARGET, pending.length + reviewedToday)}
          isWednesday={isWednesday}
        />
      )}

      <section className="space-y-2">
        {shown.length === 0 && <p className="card text-muted">No misses here yet.</p>}
        {[...shown].reverse().map((r) => (
          <article key={r.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-xs text-muted">{r.date} · you: {r.yourAnswer ?? "blank"} · answer: {r.correctAnswer}{r.familiar ? " · seen before" : ""}</p>
              </div>
              <span className="chip !bg-danger/10 !text-danger">{ERROR_TYPES.find((e) => e.value === r.errorType)?.label}</span>
            </div>
            <p className="mt-2 text-sm"><span className="font-semibold">Key idea:</span> {r.keyIdea}</p>
            {r.takeaway && <p className="mt-1 text-sm text-mastery"><span className="font-semibold">Takeaway:</span> {r.takeaway}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {r.tags.map((t) => <span key={t} className="chip">{label(t)}</span>)}
              {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm font-semibold text-brand">Solutions ↗</a>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
