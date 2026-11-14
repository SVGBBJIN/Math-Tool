import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import { evaluateDay, khanRequiredOn, requiredItems, type ActivityRow, type DayStatus, type PlanItem } from "./plan";
import { comfortLevel, pickTrainerProblems, type TagStat } from "./trainer";

type DB = SupabaseClient;

/** Cap on how many minutes one problem can contribute to the day (guards against a timer left running). */
const MAX_MINUTES_PER_PROBLEM = 20;

export async function getDayStatus(db: DB, studentId: string, date: string): Promise<DayStatus> {
  const { data } = await db
    .from("day_activity")
    .select("item, minutes, completed")
    .eq("student_id", studentId)
    .eq("local_date", date);
  const rows: ActivityRow[] = (data ?? []).map((r) => ({
    item: r.item as PlanItem,
    minutes: Number(r.minutes),
    completed: r.completed,
  }));
  return evaluateDay(requiredItems(date, { khanRequired: khanRequiredOn(date) }), rows);
}

/** date -> minimum met, for the last `days` days (inclusive of today). */
export async function getKeptMap(db: DB, studentId: string, today: string, days = 365) {
  const from = addDays(today, -days);
  const { data } = await db
    .from("day_activity")
    .select("local_date, item, minutes, completed")
    .eq("student_id", studentId)
    .gte("local_date", from)
    .lte("local_date", today);
  const byDate = new Map<string, ActivityRow[]>();
  for (const r of data ?? []) {
    const list = byDate.get(r.local_date) ?? [];
    list.push({ item: r.item as PlanItem, minutes: Number(r.minutes), completed: r.completed });
    byDate.set(r.local_date, list);
  }
  const kept = new Map<string, boolean>();
  for (const [date, rows] of byDate) {
    kept.set(date, evaluateDay(requiredItems(date, { khanRequired: khanRequiredOn(date) }), rows).minimumMet);
  }
  return kept;
}

export async function upsertActivity(
  db: DB,
  row: { household_id: string; student_id: string; local_date: string; item: PlanItem; minutes: number; completed: boolean },
) {
  const { error } = await db
    .from("day_activity")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "student_id,local_date,item" });
  if (error) throw new Error(error.message);
}

/** Unfamiliar-attempt stats per technique tag, plus the comfort level. */
export async function getStudentStats(db: DB, studentId: string) {
  const { data } = await db
    .from("attempts")
    .select("correct, familiar, problems(difficulty, technique_tags)")
    .eq("student_id", studentId)
    .in("context", ["trainer", "review", "endurance"])
    .order("created_at", { ascending: false })
    .limit(500);
  type Row = { correct: boolean; familiar: boolean; problems: { difficulty: number; technique_tags: string[] } | null };
  const rows = (data ?? []) as unknown as Row[];
  const tagStats = new Map<string, TagStat>();
  for (const r of rows) {
    if (r.familiar || !r.problems) continue;
    for (const t of r.problems.technique_tags) {
      const s = tagStats.get(t) ?? { attempts: 0, correct: 0 };
      s.attempts++;
      if (r.correct) s.correct++;
      tagStats.set(t, s);
    }
  }
  const comfort = comfortLevel(
    rows
      .filter((r) => r.problems)
      .slice(0, 60)
      .map((r) => ({ difficulty: r.problems!.difficulty, correct: r.correct, familiar: r.familiar })),
  );
  return { tagStats, comfort };
}

/** Today's trainer session for the student, created on first visit. */
export async function getOrCreateTrainerSession(db: DB, householdId: string, studentId: string, today: string) {
  const existing = await db
    .from("trainer_sessions")
    .select("id, problem_ids, slot_reasons, review_item_ids, completed_at")
    .eq("student_id", studentId)
    .eq("local_date", today)
    .maybeSingle();
  if (existing.data) return existing.data;

  const [{ data: problems }, { data: attempted }, { data: due }] = await Promise.all([
    db.from("problems").select("id, difficulty, technique_tags").eq("household_id", householdId).eq("status", "train"),
    db.from("attempts").select("problem_id").eq("student_id", studentId),
    db
      .from("review_items")
      .select("id, technique_tag, due_date, origin_problem_id, problems(difficulty)")
      .eq("student_id", studentId)
      .eq("status", "pending")
      .lte("due_date", today),
  ]);
  const seen = new Set((attempted ?? []).map((a) => a.problem_id));
  const candidates = (problems ?? [])
    .filter((p) => !seen.has(p.id))
    .map((p) => ({ id: p.id, difficulty: p.difficulty, techniqueTags: p.technique_tags }));
  type DueRow = { id: string; technique_tag: string; due_date: string; origin_problem_id: string | null; problems: { difficulty: number } | null };
  const dueItems = ((due ?? []) as unknown as DueRow[]).map((d) => ({
    id: d.id,
    techniqueTag: d.technique_tag,
    dueDate: d.due_date,
    originProblemId: d.origin_problem_id,
    originDifficulty: d.problems?.difficulty ?? null,
  }));
  const { tagStats, comfort } = await getStudentStats(db, studentId);
  const picks = pickTrainerProblems({ candidates, dueItems, tagStats, comfort });
  if (picks.length === 0) return null;

  const NIL = "00000000-0000-0000-0000-000000000000";
  const { data, error } = await db
    .from("trainer_sessions")
    .insert({
      household_id: householdId,
      student_id: studentId,
      local_date: today,
      problem_ids: picks.map((p) => p.problemId),
      slot_reasons: picks.map((p) => p.reason),
      review_item_ids: picks.map((p) => p.reviewItemId ?? NIL),
    })
    .select("id, problem_ids, slot_reasons, review_item_ids, completed_at")
    .single();
  if (error) {
    // Concurrent first visit: fall back to the row the other request created.
    const again = await db
      .from("trainer_sessions")
      .select("id, problem_ids, slot_reasons, review_item_ids, completed_at")
      .eq("student_id", studentId)
      .eq("local_date", today)
      .maybeSingle();
    if (again.data) return again.data;
    throw new Error(error.message);
  }
  return data;
}

/** Recompute today's trainer activity row from finalized attempts in the session. */
export async function refreshTrainerActivity(
  db: DB,
  session: { id: string; problem_ids: string[] },
  householdId: string,
  studentId: string,
  today: string,
) {
  const { data } = await db
    .from("attempts")
    .select("problem_id, seconds, finalized")
    .eq("session_id", session.id);
  const rows = data ?? [];
  const minutes = rows.reduce((s, r) => s + Math.min(r.seconds / 60, MAX_MINUTES_PER_PROBLEM), 0);
  const finalizedIds = new Set(rows.filter((r) => r.finalized).map((r) => r.problem_id));
  const completed = session.problem_ids.every((id) => finalizedIds.has(id));
  await upsertActivity(db, {
    household_id: householdId,
    student_id: studentId,
    local_date: today,
    item: "trainer",
    minutes: Math.round(minutes * 10) / 10,
    completed,
  });
  if (completed) {
    await db.from("trainer_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id).is("completed_at", null);
  }
  return completed;
}
