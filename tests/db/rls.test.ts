// Row-level security checks against the LOCAL Supabase (run: npm run test:db).
import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const local = url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname);

async function login(email: string, password: string) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

describe.skipIf(!local)("accounts + RLS", () => {
  let admin: SupabaseClient, user: SupabaseClient, outsider: SupabaseClient;
  let householdId: string, userId: string, problemId: string;

  beforeAll(async () => {
    admin = createClient(url, secret, { auth: { persistSession: false } });
    user = await login("demo@demo.local", "demo-password-123");
    // An unrelated account. Creating it must provision its own profile + settings row.
    const email = `outsider-${Date.now()}@demo.local`;
    await admin.auth.admin.createUser({ email, password: "outsider-pass-1", email_confirm: true });
    outsider = await login(email, "outsider-pass-1");
    const { data: u } = await user.auth.getUser();
    userId = u.user!.id;
    const { data: prof } = await user.from("profiles").select("household_id").eq("id", userId).single();
    householdId = prof!.household_id;
    const { data: p } = await user.from("problems").select("id").limit(1).single();
    problemId = p!.id;
  });

  it("creating an auth user provisions a profile and a settings row", async () => {
    const { data: me } = await outsider.auth.getUser();
    const { data: prof } = await outsider.from("profiles").select("household_id, display_name").eq("id", me.user!.id).single();
    expect(prof?.display_name).toMatch(/^outsider-/);
    const { data: h } = await outsider.from("households").select("id, timezone").eq("id", prof!.household_id).single();
    expect(h?.timezone).toBe("America/Los_Angeles");
    expect(prof!.household_id).not.toBe(householdId);
  });

  it("sign-up metadata sets the display name and a valid time zone; a bad zone falls back", async () => {
    const mk = async (tz: string) => {
      const email = `meta-${Date.now()}-${Math.random().toString(36).slice(2)}@demo.local`;
      const { data } = await admin.auth.admin.createUser({
        email, password: "meta-pass-123", email_confirm: true, user_metadata: { display_name: "Ada", timezone: tz },
      });
      const { data: prof } = await admin.from("profiles").select("display_name, households(timezone)").eq("id", data.user!.id).single();
      return prof as unknown as { display_name: string; households: { timezone: string } };
    };
    expect(await mk("Europe/London")).toMatchObject({ display_name: "Ada", households: { timezone: "Europe/London" } });
    expect((await mk("Not/AZone")).households.timezone).toBe("America/Los_Angeles");
  });

  it("anonymous users see nothing", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from("problems").select("id");
    expect(data).toEqual([]);
  });

  it("another account cannot read or write ours", async () => {
    expect((await outsider.from("problems").select("id").eq("household_id", householdId)).data).toEqual([]);
    expect((await outsider.from("attempts").select("id")).data).toEqual([]);
    const { error } = await outsider.from("problems").insert({
      household_id: householdId, source: "pasted", statement: "x".repeat(20), answer: "A", difficulty: 1, technique_tags: ["casework"],
    });
    expect(error).not.toBeNull();
    await outsider.from("households").update({ timezone: "UTC" }).eq("id", householdId);
    const { data } = await admin.from("households").select("timezone").eq("id", householdId).single();
    expect(data!.timezone).toBe("America/Los_Angeles");
  });

  it("the owner can update their own settings", async () => {
    const { error } = await user.from("households").update({ amc_date: "2027-03-04" }).eq("id", householdId);
    expect(error).toBeNull();
  });

  it("a user cannot move their profile to another household or change anything but the name", async () => {
    const { data: other } = await outsider.from("profiles").select("household_id").limit(1).single();
    const { error } = await user.from("profiles").update({ household_id: other!.household_id }).eq("id", userId);
    expect(error).not.toBeNull();
  });

  it("the public cannot call the internal provisioning function", async () => {
    const { error } = await user.rpc("provision_account", { p_user: userId, p_email: "x@y.z", p_meta: {} });
    expect(error).not.toBeNull();
  });

  it("schema rejects AoPS problem text and generated problems in the vault", async () => {
    const aopsWithText = await admin.from("problems").insert({
      household_id: householdId, source: "aops_wiki", url: "https://artofproblemsolving.com/x", statement: "copied text",
      answer: "A", difficulty: 1, technique_tags: ["casework"],
    });
    expect(aopsWithText.error?.message).toMatch(/aops_no_text/);
    const genVault = await admin.from("problems").insert({
      household_id: householdId, source: "generated", statement: "a generated problem", answer: "A", difficulty: 1,
      technique_tags: ["casework"], status: "vault",
    });
    expect(genVault.error?.message).toMatch(/generated_not_vault/);
    expect(problemId).toBeTruthy();
  });
});
