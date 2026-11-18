import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import { evaluateDay, khanRequiredOn, requiredItems, type ActivityRow, type DayStatus, type PlanItem } from "./plan";
import { parseDocument, toEnvelope } from "./learn/persistence";
import { emptyLearnState, type LearnState } from "./learn/state";

type DB = SupabaseClient;

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

export interface LoadedLearnState { state: LearnState; notice: string | null }

/**
 * The student's learning record. It lives in the engine_progress row (one JSON document per
 * student). A version-1 document left by the move-based engine is migrated on read and
 * written back on the next save; an unreadable one is reported rather than overwritten.
 */
export async function loadLearnState(db: DB, studentId: string): Promise<LoadedLearnState> {
  const { data } = await db.from("engine_progress").select("state").eq("student_id", studentId).maybeSingle();
  if (!data) return { state: emptyLearnState(), notice: null };
  const r = parseDocument(data.state);
  if (!r.ok) return { state: emptyLearnState(), notice: `Saved progress could not be read (${r.reason}). Nothing will be saved over it until it is fixed.` };
  const notice = r.migratedFrom !== null
    ? `Your progress was updated to the new learning system.${r.dropped ? ` ${r.dropped} old ${r.dropped === 1 ? "entry" : "entries"} could not be carried over.` : ""}`
    : r.dropped ? `${r.dropped} damaged ${r.dropped === 1 ? "entry was" : "entries were"} left out of your saved progress.` : null;
  return { state: r.state, notice };
}

/** True when the stored row exists but cannot be read, so saving would destroy it. */
export async function storedRecordUnreadable(db: DB, studentId: string): Promise<boolean> {
  const { data } = await db.from("engine_progress").select("state").eq("student_id", studentId).maybeSingle();
  return !!data && !parseDocument(data.state).ok;
}

export async function saveLearnRow(db: DB, householdId: string, studentId: string, state: LearnState) {
  const { error } = await db
    .from("engine_progress")
    .upsert({ student_id: studentId, household_id: householdId, state: toEnvelope(state), updated_at: new Date().toISOString() }, { onConflict: "student_id" });
  if (error) throw new Error(error.message);
}
