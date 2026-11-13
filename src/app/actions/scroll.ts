"use server";
import { z } from "zod";
import { requireStudent } from "@/lib/session";
import { upsertActivity } from "@/lib/data";
import { SCROLL_MAX_MINUTES_PER_DAY, SCROLL_MAX_SECONDS_PER_PROBLEM } from "@/lib/scroll";

const Input = z.object({ seconds: z.number().min(0).max(3600) });

/** Credit time spent on one scroll problem toward today's minutes (streak minimum). Never a required item. */
export async function logScrollProblem(input: { seconds: number }): Promise<{ minutes?: number; error?: string }> {
  const { supabase: db, profile, household, today } = await requireStudent();
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  const add = Math.min(parsed.data.seconds, SCROLL_MAX_SECONDS_PER_PROBLEM) / 60;

  const { data } = await db
    .from("day_activity")
    .select("minutes")
    .eq("student_id", profile.id)
    .eq("local_date", today)
    .eq("item", "scroll")
    .maybeSingle();
  const minutes = Math.min(SCROLL_MAX_MINUTES_PER_DAY, Number(data?.minutes ?? 0) + add);
  await upsertActivity(db, {
    household_id: household.id,
    student_id: profile.id,
    local_date: today,
    item: "scroll",
    minutes: Math.round(minutes * 10) / 10,
    completed: false,
  });
  return { minutes };
}
