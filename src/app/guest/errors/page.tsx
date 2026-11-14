"use client";
import { useMemo, useState } from "react";
import { useGuest } from "@/lib/guest/GuestProvider";
import { markNothingToReview, reviewError } from "@/lib/guest/engine";
import { ERROR_TYPES, label } from "@/lib/tags";
import { ERROR_REVIEW_TARGET } from "@/lib/plan";
import { weekday } from "@/lib/dates";
import { ReviewClient, type MissRow, type ReviewActions } from "../../(app)/errors/ReviewClient";

export default function GuestErrors() {
  const { state, today, update } = useGuest();
  const [type, setType] = useState<string | null>(null);

  const actions = useMemo<ReviewActions>(
    () => ({
      reviewError: async (input) => update((d) => reviewError(d, input, today)),
      markNothingToReview: async () => update((d) => markNothingToReview(d, today)),
    }),
    [update, today],
  );

  if (!state) return <p className="card text-muted">Loading…</p>;

  const reviewBy = new Map(state.errorReviews.map((r) => [r.attempt_id, r]));
  const rows: MissRow[] = state.attempts
    .filter((a) => !a.correct && a.finalized)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((a) => {
      const p = state.problems.find((x) => x.id === a.problem_id);
      return {
        id: a.id,
        date: a.local_date,
        yourAnswer: a.answer,
        correctAnswer: p?.answer ?? "?",
        errorType: a.error_type ?? "",
        keyIdea: a.key_idea ?? "",
        familiar: a.familiar,
        title: p?.source === "aops_wiki" ? `${p.year} ${p.contest} #${p.number}` : (p?.statement ?? "").slice(0, 60) + "…",
        link: p?.solution_url ?? p?.url ?? null,
        tags: p?.technique_tags ?? [],
        takeaway: reviewBy.get(a.id)?.takeaway ?? null,
      };
    });

  const freshAttempts = state.attempts.filter((a) => a.finalized && !a.familiar).length;
  const unfamiliarMisses = rows.filter((r) => !r.familiar);
  const counts = Object.fromEntries(ERROR_TYPES.map((e) => [e.value, unfamiliarMisses.filter((r) => r.errorType === e.value).length]));
  const carelessShare = unfamiliarMisses.length ? Math.round(((counts.careless ?? 0) + (counts.misread ?? 0)) / unfamiliarMisses.length * 100) : 0;
  const reviewedToday = state.errorReviews.filter((r) => r.local_date === today).length;
  const pending = rows.filter((r) => !r.takeaway);
  const shown = type ? rows.filter((r) => r.errorType === type) : rows;

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="h2">Error log</h1>
        <p className="text-sm text-muted">
          {unfamiliarMisses.length} misses on {freshAttempts} fresh attempts · careless + misread = {carelessShare}% of misses
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`chip ${!type ? "!bg-brand !text-white" : ""}`} onClick={() => setType(null)}>All {rows.length}</button>
          {ERROR_TYPES.map((e) => (
            <button key={e.value} className={`chip ${type === e.value ? "!bg-brand !text-white" : ""}`} onClick={() => setType(type === e.value ? null : e.value)}>
              {e.label} {counts[e.value]}
            </button>
          ))}
        </div>
      </section>

      <ReviewClient
        pending={pending}
        reviewedToday={reviewedToday}
        target={Math.min(ERROR_REVIEW_TARGET, pending.length + reviewedToday)}
        isWednesday={weekday(today) === 3}
        actions={actions}
      />

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
