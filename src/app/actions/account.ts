"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireParent } from "@/lib/session";

export type FormState = { error?: string; message?: string };

const Creds = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };
  redirect("/");
}

/** Parent sign-up. Students never sign up themselves; the parent creates their login. */
export async function signUpParent(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get("adult") !== "on") return { error: "A parent or guardian must create the account." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email to confirm, then sign in." };
  redirect("/setup");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const HouseholdSchema = z.object({
  name: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(60),
  timezone: z.string().min(1),
});

export async function createHousehold(_: FormState, form: FormData): Promise<FormState> {
  const parsed = HouseholdSchema.safeParse({
    name: form.get("name"),
    displayName: form.get("displayName"),
    timezone: form.get("timezone"),
  });
  if (!parsed.success) return { error: "Fill in every field" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_display_name: parsed.data.displayName,
    p_timezone: parsed.data.timezone,
  });
  if (error) return { error: error.message };
  redirect("/settings");
}

const StudentSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  email: z.email("Enter a valid email for the student's login"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Parent creates the student's login (the student is a minor; the parent owns the account). */
export async function createStudent(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireParent();
  const parsed = StudentSchema.safeParse({
    displayName: form.get("displayName"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { count } = await ctx.supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("household_id", ctx.household.id)
    .eq("role", "student");
  if ((count ?? 0) > 0) return { error: "This household already has a student." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create the login" };
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id,
    household_id: ctx.household.id,
    role: "student",
    display_name: parsed.data.displayName,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: pErr.message };
  }
  revalidatePath("/settings");
  return { message: `Student login created for ${parsed.data.displayName}.` };
}

const SettingsSchema = z.object({
  timezone: z.string().min(1),
  amcDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  finalsStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  finalsEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
});

export async function updateSettings(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireParent();
  const parsed = SettingsSchema.safeParse({
    timezone: form.get("timezone"),
    amcDate: form.get("amcDate") ?? "",
    finalsStart: form.get("finalsStart") ?? "",
    finalsEnd: form.get("finalsEnd") ?? "",
  });
  if (!parsed.success) return { error: "Check the dates" };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
  } catch {
    return { error: "Unknown time zone" };
  }
  const { finalsStart, finalsEnd } = parsed.data;
  if (finalsStart && finalsEnd && finalsEnd < finalsStart) return { error: "Finals end is before finals start" };
  const { error } = await ctx.supabase
    .from("households")
    .update({
      timezone: parsed.data.timezone,
      amc_date: parsed.data.amcDate || null,
      finals_start: finalsStart || null,
      finals_end: finalsEnd || null,
    })
    .eq("id", ctx.household.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

/** Parent's master switch for Sendblue text reminders. Independent of every practice mode. */
export async function setTextReminders(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireParent();
  const enabled = form.get("enabled") === "on";
  const { error } = await ctx.supabase.from("households").update({ texts_enabled: enabled }).eq("id", ctx.household.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { message: enabled ? "Text reminders are on." : "Text reminders are off." };
}
