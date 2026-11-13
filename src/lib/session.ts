import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { localDate } from "./dates";

export interface Household {
  id: string;
  name: string;
  timezone: string;
  amc_date: string | null;
  finals_start: string | null;
  finals_end: string | null;
  texts_enabled: boolean;
}

export interface Profile {
  id: string;
  household_id: string;
  role: "parent" | "student";
  display_name: string;
}

/** Signed-in user with a profile and household, or redirect to login/setup. */
export async function requireContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, household_id, role, display_name")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect("/setup");

  const { data: household } = await supabase
    .from("households")
    .select("id, name, timezone, amc_date, finals_start, finals_end, texts_enabled")
    .eq("id", profile.household_id)
    .single<Household>();
  if (!household) redirect("/setup");

  return { supabase, user, profile, household, today: localDate(household.timezone) };
}

export async function requireStudent() {
  const ctx = await requireContext();
  if (ctx.profile.role !== "student") redirect("/?only=student");
  return ctx;
}

export async function requireParent() {
  const ctx = await requireContext();
  if (ctx.profile.role !== "parent") redirect("/?only=parent");
  return ctx;
}

/** The household's student (first one). Parents view the student's data. */
export async function householdStudent(ctx: Awaited<ReturnType<typeof requireContext>>) {
  if (ctx.profile.role === "student") return ctx.profile;
  const { data } = await ctx.supabase
    .from("profiles")
    .select("id, household_id, role, display_name")
    .eq("household_id", ctx.household.id)
    .eq("role", "student")
    .order("created_at")
    .limit(1)
    .maybeSingle<Profile>();
  return data;
}
