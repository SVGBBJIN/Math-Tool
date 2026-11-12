"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/session";
import { upsertActivity } from "@/lib/data";
import { ERROR_REVIEW_TARGET } from "@/lib/plan";

const Schema = z.object({
  attemptId: z.uuid(),
  takeaway: z.string().trim().min(5, "Write what you'll do differently").max(500),
  minutes: z.number().min(0).max(30),
});

export async function reviewError(input: z.input<typeof Schema>) {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase: db, profile, household, today } = await requireStudent();
  const { attemptId, takeaway, minutes } = parsed.data;

  const { error } = await db.from("error_reviews").insert({
    household_id: household.id,
    student_id: profile.id,
    attempt_id: attemptId,
    local_date: today,
    takeaway,
  });
  if (error) return { error: error.code === "23505" ? "Already reviewed" : error.message };

  await recomputeErrorReviewActivity(minutes);
  revalidatePath("/errors");
  revalidatePath("/");
  return {};
}

/** Recompute today's error_review activity: done after TARGET reviews or when nothing is left. */
async function recomputeErrorReviewActivity(addMinutes: number) {
  const { supabase: db, profile, household, today } = await requireStudent();
  const [{ count: reviewedToday }, { data: misses }, { data: reviewed }, { data: current }] = await Promise.all([
    db.from("error_reviews").select("id", { count: "exact", head: true }).eq("student_id", profile.id).eq("local_date", today),
    db.from("attempts").select("id").eq("student_id", profile.id).eq("correct", false).eq("finalized", true),
    db.from("error_reviews").select("attempt_id").eq("student_id", profile.id),
    db.from("day_activity").select("minutes").eq("student_id", profile.id).eq("local_date", today).eq("item", "error_review").maybeSingle(),
  ]);
  const reviewedIds = new Set((reviewed ?? []).map((r) => r.attempt_id));
  const remaining = (misses ?? []).filter((m) => !reviewedIds.has(m.id)).length;
  const done = (reviewedToday ?? 0) >= ERROR_REVIEW_TARGET || ((reviewedToday ?? 0) > 0 && remaining === 0);
  await upsertActivity(db, {
    household_id: household.id,
    student_id: profile.id,
    local_date: today,
    item: "error_review",
    minutes: Math.round((Number(current?.minutes ?? 0) + addMinutes) * 10) / 10,
    completed: done,
  });
}

/** When the error log is empty there is nothing to review; mark it done with a short check-in. */
export async function markNothingToReview() {
  const { supabase: db, profile, household, today } = await requireStudent();
  const { data: misses } = await db.from("attempts").select("id").eq("student_id", profile.id).eq("correct", false).eq("finalized", true);
  const { data: reviewed } = await db.from("error_reviews").select("attempt_id").eq("student_id", profile.id);
  const reviewedIds = new Set((reviewed ?? []).map((r) => r.attempt_id));
  if ((misses ?? []).some((m) => !reviewedIds.has(m.id))) return { error: "There are still misses to review" };
  await upsertActivity(db, {
    household_id: household.id,
    student_id: profile.id,
    local_date: today,
    item: "error_review",
    minutes: 0,
    completed: true,
  });
  revalidatePath("/");
  revalidatePath("/errors");
  return {};
}
