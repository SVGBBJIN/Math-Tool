"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNothingToReview, reviewError } from "../../actions/errors";
import { ERROR_TYPES } from "@/lib/tags";

export interface MissRow {
  id: string;
  date: string;
  yourAnswer: string | null;
  correctAnswer: string;
  errorType: string;
  keyIdea: string;
  familiar: boolean;
  title: string;
  link: string | null;
  tags: string[];
  takeaway: string | null;
}

export function ReviewClient({
  pending,
  reviewedToday,
  target,
  isWednesday,
}: {
  pending: MissRow[];
  reviewedToday: number;
  target: number;
  isWednesday: boolean;
}) {
  const [open, setOpen] = useState(isWednesday);
  const [takeaway, setTakeaway] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const since = useRef(Date.now());
  useEffect(() => {
    since.current = Date.now();
  }, [pending.length]);

  const current = pending[0];
  const done = target > 0 && reviewedToday >= target;

  if (!open) {
    return (
      <button className="btn-ghost w-full" onClick={() => setOpen(true)}>
        Review misses ({pending.length} waiting)
      </button>
    );
  }

  return (
    <section className="card border-brand/40">
      <div className="flex items-baseline justify-between">
        <h2 className="h2">{isWednesday ? "Wednesday review" : "Review misses"}</h2>
        <span className="text-sm text-muted">{reviewedToday} / {Math.max(target, 1)} today</span>
      </div>
      {done && <p className="mt-2 font-semibold text-mastery">Review complete for today ✓ You can keep going.</p>}
      {!current ? (
        <div className="mt-2">
          <p className="text-muted">Nothing left to review.</p>
          {reviewedToday === 0 && (
            <button
              className="btn mt-3"
              disabled={busy}
              onClick={() => start(async () => {
                const r = await markNothingToReview();
                if (r.error) setError(r.error);
              })}
            >
              Mark review done
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-canvas p-3">
            <p className="font-semibold">{current.title}</p>
            <p className="text-xs text-muted">
              {current.date} · {ERROR_TYPES.find((e) => e.value === current.errorType)?.label} · you: {current.yourAnswer ?? "blank"} · answer: {current.correctAnswer}
            </p>
            <p className="mt-2 text-sm"><span className="font-semibold">Your key idea:</span> {current.keyIdea}</p>
            {current.link && (
              <a href={current.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-brand">
                Re-read the solution ↗
              </a>
            )}
          </div>
          <div>
            <label className="label" htmlFor="takeaway">Next time I will…</label>
            <textarea id="takeaway" className="input min-h-20" maxLength={500} value={takeaway} onChange={(e) => setTakeaway(e.target.value)} />
          </div>
          <button
            className="btn w-full"
            disabled={busy || takeaway.trim().length < 5}
            onClick={() =>
              start(async () => {
                setError(null);
                const minutes = Math.min(15, (Date.now() - since.current) / 60000);
                const r = await reviewError({ attemptId: current.id, takeaway, minutes });
                if (r.error) return setError(r.error);
                setTakeaway("");
              })
            }
          >
            {busy ? "Saving…" : "Save takeaway"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </section>
  );
}
