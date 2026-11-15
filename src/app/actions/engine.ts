"use server";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/session";
import { saveEngineProgressRow, upsertActivity } from "@/lib/data";
import { dailyStatus, isEngineProgress, minutesOn } from "@/lib/engine/progress";

const MAX_BYTES = 2_000_000;

/**
 * Store the student's engine progress (one JSON document per student) and mirror today's
 * engine work into day_activity, so it counts toward the daily minimum like other plan work.
 * Moves are verified in the browser; this action only persists the result.
 */
export async function saveEngineProgress(state: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!isEngineProgress(state)) return { ok: false, error: "Invalid progress" };
  if (JSON.stringify(state).length > MAX_BYTES) return { ok: false, error: "Progress is too large to save" };
  const { supabase: db, profile, household, today } = await requireStudent();
  try {
    await saveEngineProgressRow(db, household.id, profile.id, state);
    const minutes = minutesOn(state, today);
    const set = dailyStatus(state, today);
    if (minutes > 0 || set.done > 0) {
      await upsertActivity(db, { household_id: household.id, student_id: profile.id, local_date: today, item: "moves", minutes, completed: set.complete });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save" };
  }
  revalidatePath("/");
  revalidatePath("/errors");
  return { ok: true };
}
