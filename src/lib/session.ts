import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { localDate } from "./dates";

/** Per-account settings. (Table name is historical: each account owns exactly one row.) */
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
  display_name: string;
}

/** Signed-in user with a profile and settings, or redirect to login. */
export async function requireContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loadProfile = () =>
    supabase.from("profiles").select("id, household_id, display_name").eq("id", user.id).maybeSingle<Profile>();
  let { data: profile } = await loadProfile();
  if (!profile) {
    // Account predates the sign-up trigger (or it failed): create the rows now, then retry once.
    await supabase.rpc("ensure_account");
    ({ data: profile } = await loadProfile());
  }
  if (!profile) redirect("/login?error=account");

  const { data: household } = await supabase
    .from("households")
    .select("id, name, timezone, amc_date, finals_start, finals_end, texts_enabled")
    .eq("id", profile.household_id)
    .single<Household>();
  if (!household) redirect("/login?error=account");

  return { supabase, user, profile, household, today: localDate(household.timezone) };
}
