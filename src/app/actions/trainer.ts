"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { applyMiss, applyTwinOutcome, primaryTechnique } from "@/lib/review";
import { refreshTrainerActivity } from "@/lib/data";

const NIL = "00000000-0000-0000-0000-000000000000";

const SubmitSchema = z.object({
  sessionId: z.uuid(),
  problemId: z.uuid(),
  answer: z.enum(["A", "B", "C", "D", "E"]).nullable(), // null = left blank
  confidence: z.number().int().min(1).max(3),
  familiar: z.boolean(),
  seconds: z.number().int().min(0).max(7200),
});

export type SubmitResult =
  | { ok: true; attemptId: string; correct: boolean; correctAnswer: string; solutionUrl: string | null }
  | { ok: false; error: string };

export async function submitAttempt(input: z.input<typeof SubmitSchema>): Promise<SubmitResult> {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission" };
  const { sessionId, problemId, answer, confidence, familiar, seconds } = parsed.data;
  const { supabase: db, profile, household, today } = await requireContext();

  const { data: session } = await db
    .from("trainer_sessions")
    .select("id, problem_ids, review_item_ids, local_date")
    .eq("id", sessionId)
    .eq("student_id", profile.id)
    .single();
  if (!session) return { ok: false, error: "Session not found" };
  const idx = session.problem_ids.indexOf(problemId);
  if (idx < 0) return { ok: false, error: "Problem is not in this session" };

  const { data: problem } = await db
    .from("problems")
    .select("answer, technique_tags, url, solution_url")
    .eq("id", problemId)
    .single();
  if (!problem) return { ok: false, error: "Problem not found" };
  const solutionUrl = problem.solution_url ?? problem.url ?? null;

  // Idempotent: one attempt per problem per session.
  const { data: prior } = await db
    .from("attempts")
    .select("id, correct")
    .eq("session_id", sessionId)
    .eq("problem_id", problemId)
    .maybeSingle();
  if (prior) return { ok: true, attemptId: prior.id, correct: prior.correct, correctAnswer: problem.answer, solutionUrl };

  const correct = answer === problem.answer;
  const reviewItemId = session.review_item_ids[idx] && session.review_item_ids[idx] !== NIL ? session.review_item_ids[idx] : null;

  const { data: attempt, error } = await db
    .from("attempts")
    .insert({
      household_id: household.id,
      student_id: profile.id,
      problem_id: problemId,
      context: "trainer",
      session_id: sessionId,
      review_item_id: reviewItemId,
      local_date: session.local_date,
      seconds,
      answer,
      correct,
      confidence,
      familiar,
    })
    .select("id")
    .single();
  if (error || !attempt) return { ok: false, error: error?.message ?? "Could not save attempt" };

  // Spaced review bookkeeping.
  if (reviewItemId) {
    const { data: item } = await db
      .from("review_items")
      .select("stage, due_date, status")
      .eq("id", reviewItemId)
      .single();
    if (item) {
      const next = applyTwinOutcome(
        { stage: item.stage, dueDate: item.due_date, status: item.status },
        { correct, familiar },
        today,
      );
      await db
        .from("review_items")
        .update({ stage: next.stage, due_date: next.dueDate, status: next.status, last_attempt_id: attempt.id, updated_at: new Date().toISOString() })
        .eq("id", reviewItemId);
    }
  } else if (!correct) {
    const tag = primaryTechnique(problem.technique_tags);
    if (tag) {
      const { data: existing } = await db
        .from("review_items")
        .select("id, stage, due_date, status")
        .eq("student_id", profile.id)
        .eq("technique_tag", tag)
        .eq("status", "pending")
        .maybeSingle();
      const next = applyMiss(existing ? { stage: existing.stage, dueDate: existing.due_date, status: existing.status } : null, today);
      if (existing) {
        await db
          .from("review_items")
          .update({ stage: next.stage, due_date: next.dueDate, origin_problem_id: problemId, last_attempt_id: attempt.id, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await db.from("review_items").insert({
          household_id: household.id,
          student_id: profile.id,
          technique_tag: tag,
          origin_problem_id: problemId,
          stage: next.stage,
          due_date: next.dueDate,
          last_attempt_id: attempt.id,
        });
      }
    }
  }

  await refreshTrainerActivity(db, session, household.id, profile.id, session.local_date);
  return { ok: true, attemptId: attempt.id, correct, correctAnswer: problem.answer, solutionUrl };
}

const FinalizeSchema = z.object({
  attemptId: z.uuid(),
  keyIdea: z.string().trim().min(5, "Write at least a short sentence").max(280, "Keep it to one sentence"),
  errorType: z.enum(["concept_gap", "careless", "misread", "no_approach", "out_of_time"]).nullable(),
});

export async function finalizeAttempt(input: z.input<typeof FinalizeSchema>): Promise<{ ok: boolean; error?: string; dayComplete?: boolean }> {
  const parsed = FinalizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { attemptId, keyIdea, errorType } = parsed.data;
  const { supabase: db, profile, household } = await requireContext();

  const { data: attempt } = await db
    .from("attempts")
    .select("id, correct, session_id")
    .eq("id", attemptId)
    .eq("student_id", profile.id)
    .single();
  if (!attempt) return { ok: false, error: "Attempt not found" };
  if (!attempt.correct && !errorType) return { ok: false, error: "Pick an error type for the miss" };

  const { error } = await db
    .from("attempts")
    .update({ key_idea: keyIdea, error_type: attempt.correct ? null : errorType, finalized: true })
    .eq("id", attemptId);
  if (error) return { ok: false, error: error.message };

  let dayComplete = false;
  if (attempt.session_id) {
    const { data: session } = await db
      .from("trainer_sessions")
      .select("id, problem_ids, local_date")
      .eq("id", attempt.session_id)
      .single();
    if (session) dayComplete = await refreshTrainerActivity(db, session, household.id, profile.id, session.local_date);
  }
  revalidatePath("/");
  return { ok: true, dayComplete };
}
