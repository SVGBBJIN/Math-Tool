import Link from "next/link";
import { requireContext } from "@/lib/session";
import { getOrCreateTrainerSession } from "@/lib/data";
import { TrainerClient, type TrainerProblem } from "./TrainerClient";

export default async function TrainerPage() {
  const ctx = await requireContext();
  if (ctx.profile.role !== "student") {
    return <div className="card text-muted">The trainer is for the student&apos;s login. Parents can follow progress on the Today and Errors tabs.</div>;
  }
  const db = ctx.supabase;
  const session = await getOrCreateTrainerSession(db, ctx.household.id, ctx.profile.id, ctx.today);
  if (!session) {
    return (
      <div className="card">
        <h1 className="h2">No fresh problems left</h1>
        <p className="mt-1 text-muted">Every training problem in the bank has been attempted. Add more to keep training.</p>
        <Link href="/problems" className="btn mt-4">Add problems</Link>
      </div>
    );
  }

  const [{ data: problems }, { data: attempts }] = await Promise.all([
    db
      .from("problems")
      .select("id, source, contest, year, number, url, statement, choices, difficulty, technique_tags, answer, solution_url")
      .in("id", session.problem_ids),
    db
      .from("attempts")
      .select("id, problem_id, answer, correct, confidence, familiar, seconds, key_idea, error_type, finalized")
      .eq("session_id", session.id),
  ]);
  const byId = new Map((problems ?? []).map((p) => [p.id, p]));
  const attemptBy = new Map((attempts ?? []).map((a) => [a.problem_id, a]));

  const items: TrainerProblem[] = session.problem_ids.flatMap((id: string, i: number) => {
    const p = byId.get(id);
    if (!p) return [];
    const a = attemptBy.get(id);
    return [
      {
        id: p.id,
        reason: session.slot_reasons[i],
        source: p.source,
        title:
          p.source === "aops_wiki"
            ? `${p.year} ${p.contest} #${p.number}`
            : p.source === "generated"
              ? "Generated problem"
              : (p.contest ?? "Pasted problem"),
        url: p.url,
        statement: p.statement,
        choices: p.choices,
        difficulty: p.difficulty,
        techniqueTags: p.technique_tags,
        // The answer and solution link are only sent once an attempt exists.
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

  return <TrainerClient sessionId={session.id} problems={items} />;
}
