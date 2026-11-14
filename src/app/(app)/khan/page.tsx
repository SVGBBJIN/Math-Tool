import { requireContext } from "@/lib/session";
import { KHAN_TARGET_MINUTES, accuracyLabel, summarizeKhanDay } from "@/lib/khan";
import { KhanForm } from "./KhanForm";

export default async function KhanPage() {
  const ctx = await requireContext();
  const { data } = await ctx.supabase
    .from("khan_sessions")
    .select("id, local_date, unit, skill, minutes, questions_correct, questions_total, proof_note, proof_url")
    .eq("student_id", ctx.profile.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const entries = data ?? [];
  const today = summarizeKhanDay(entries.filter((e) => e.local_date === ctx.today));
  const pct = Math.min(100, Math.round((today.minutes / KHAN_TARGET_MINUTES) * 100));

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-baseline justify-between">
          <h1 className="h2">Khan Academy</h1>
          <span className="text-sm text-muted">{today.minutes} / {KHAN_TARGET_MINUTES} min today</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuemin={0} aria-valuemax={KHAN_TARGET_MINUTES} aria-valuenow={Math.min(today.minutes, KHAN_TARGET_MINUTES)} aria-label="Khan minutes today">
          <div className="h-full rounded-full bg-mastery transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {today.completed
            ? "Khan is done for today ✓ You can still log more."
            : `Log ${today.remainingMinutes} more minute${today.remainingMinutes === 1 ? "" : "s"} of precalculus with proof to finish today's Khan.`}
        </p>
      </section>

      <KhanForm />

      <section className="space-y-2">
        <h2 className="h2">Recent proof</h2>
        {entries.length === 0 && <p className="card text-muted">Nothing logged yet.</p>}
        {entries.map((e) => (
          <article key={e.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{e.skill}</p>
                <p className="text-xs text-muted">{e.unit} · {e.local_date}</p>
              </div>
              <span className="chip shrink-0">{e.minutes} min</span>
            </div>
            {accuracyLabel(e.questions_correct, e.questions_total) && (
              <p className="mt-1 text-sm"><span className="font-semibold">Score:</span> {accuracyLabel(e.questions_correct, e.questions_total)}</p>
            )}
            <p className="mt-1 whitespace-pre-line text-sm">{e.proof_note}</p>
            {e.proof_url && (
              <a href={e.proof_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand">
                Open on Khan ↗
              </a>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
