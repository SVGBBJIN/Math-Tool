"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useGuest } from "@/lib/guest/GuestProvider";
import { finalizeAttempt, getOrCreateSession, submitAttempt } from "@/lib/guest/engine";
import { TrainerClient, type TrainerActions, type TrainerProblem } from "../../(app)/trainer/TrainerClient";

export default function GuestTrainer() {
  const { state, today, update } = useGuest();
  const ready = !!state;
  // undefined = not looked up yet, null = no fresh problems left.
  const [sessionId, setSessionId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    setSessionId(update((draft) => getOrCreateSession(draft, today))?.id ?? null);
    // Only on first load: later saves must not re-run session selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const actions = useMemo<TrainerActions>(
    () => ({
      submitAttempt: async (input) => update((d) => submitAttempt(d, input, today)),
      finalizeAttempt: async (input) => update((d) => finalizeAttempt(d, input)),
    }),
    [update, today],
  );

  if (!state || sessionId === undefined) return <p className="card text-muted">Loading…</p>;
  const session = sessionId ? state.sessions.find((s) => s.id === sessionId) : null;
  if (!session) {
    return (
      <div className="card">
        <h1 className="h2">No fresh problems left</h1>
        <p className="mt-1 text-muted">Every training problem in the bank has been attempted. Add more to keep training.</p>
        <Link href="/guest/problems" className="btn mt-4">Add problems</Link>
      </div>
    );
  }

  const items: TrainerProblem[] = session.problem_ids.flatMap((id, i) => {
    const p = state.problems.find((x) => x.id === id);
    if (!p) return [];
    const a = state.attempts.find((x) => x.session_id === session.id && x.problem_id === id);
    return [
      {
        id: p.id,
        reason: session.slot_reasons[i],
        source: p.source,
        title: p.source === "aops_wiki" ? `${p.year} ${p.contest} #${p.number}` : (p.contest ?? "Pasted problem"),
        url: p.url,
        statement: p.statement,
        choices: p.choices,
        difficulty: p.difficulty,
        techniqueTags: p.technique_tags,
        // The answer and solution link are only handed over once an attempt exists.
        attempt: a
          ? {
              id: a.id,
              answer: a.answer,
              correct: a.correct,
              seconds: a.seconds,
              finalized: a.finalized,
              keyIdea: a.key_idea,
              errorType: a.error_type,
              correctAnswer: p.answer,
              solutionUrl: p.solution_url ?? p.url,
            }
          : null,
      },
    ];
  });

  return <TrainerClient key={session.id} sessionId={session.id} problems={items} actions={actions} basePath="/guest" />;
}
