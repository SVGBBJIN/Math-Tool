"use server";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/session";
import { upsertActivity } from "@/lib/data";
import { KhanEntrySchema, summarizeKhanDay, type KhanEntryInput } from "@/lib/khan";

export async function logKhanSession(input: KhanEntryInput) {
  const parsed = KhanEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase: db, profile, household, today } = await requireStudent();
  const e = parsed.data;

  const { error } = await db.from("khan_sessions").insert({
    household_id: household.id,
    student_id: profile.id,
    local_date: today,
    unit: e.unit,
    skill: e.skill,
    minutes: e.minutes,
    questions_correct: e.questionsCorrect,
    questions_total: e.questionsTotal,
    proof_note: e.proofNote,
    proof_url: e.proofUrl ?? null,
  });
  if (error) return { error: error.message };

  // Derive the day's Khan activity from every entry logged today (so it is never double-counted).
  const { data: todays } = await db
    .from("khan_sessions")
    .select("minutes")
    .eq("student_id", profile.id)
    .eq("local_date", today);
  const summary = summarizeKhanDay((todays ?? []).map((r) => ({ minutes: r.minutes })));
  await upsertActivity(db, {
    household_id: household.id,
    student_id: profile.id,
    local_date: today,
    item: "khan",
    minutes: summary.minutes,
    completed: summary.completed,
  });

  revalidatePath("/khan");
  revalidatePath("/");
  return {};
}
