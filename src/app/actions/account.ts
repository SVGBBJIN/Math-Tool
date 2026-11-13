"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/session";

export type FormState = { error?: string; message?: string };

const Password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
const SignInSchema = z.object({ email: z.email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const SignUpSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(60, "Name is too long"),
  email: z.email("Enter a valid email"),
  password: Password,
});

function validTimezone(tz: unknown): string | undefined {
  if (typeof tz !== "string" || !tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };
  redirect("/");
}

/**
 * Self-service account creation. Supabase creates the auth user; a database trigger
 * (`handle_new_user`) creates the profile and settings row from the metadata passed here.
 */
export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignUpSchema.safeParse({
    displayName: form.get("displayName"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, timezone: validTimezone(form.get("timezone")) },
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });
  if (error) return { error: error.message };
  // Supabase returns an obfuscated user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with that email already exists. Try signing in." };
  }
  if (!data.session) return { message: "Check your email to confirm your account, then sign in." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const SettingsSchema = z.object({
  timezone: z.string().min(1),
  amcDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  finalsStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  finalsEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
});

export async function updateSettings(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
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
