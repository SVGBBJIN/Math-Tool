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

describe.skipIf(!local)("RLS", () => {
  let admin: SupabaseClient, parent: SupabaseClient, student: SupabaseClient, outsider: SupabaseClient;
  let householdId: string, studentId: string, problemId: string;

  beforeAll(async () => {
    admin = createClient(url, secret, { auth: { persistSession: false } });
    parent = await login("parent@demo.local", "demo-password-123");
    student = await login("student@demo.local", "demo-password-123");
    // An unrelated user in another household.
    const email = `outsider-${Date.now()}@demo.local`;
    await admin.auth.admin.createUser({ email, password: "outsider-pass-1", email_confirm: true });
    outsider = await login(email, "outsider-pass-1");
    await outsider.rpc("create_household", { p_name: "Other", p_display_name: "Other parent", p_timezone: "UTC" });
    const { data: s } = await student.auth.getUser();
    studentId = s.user!.id;
    const { data: prof } = await student.from("profiles").select("household_id").eq("id", studentId).single();
    householdId = prof!.household_id;
    const { data: p } = await student.from("problems").select("id").limit(1).single();
    problemId = p!.id;
  });

  it("anonymous users see nothing", async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from("problems").select("id");
    expect(data).toEqual([]);
  });

  it("another household cannot read or write ours", async () => {
    expect((await outsider.from("problems").select("id").eq("household_id", householdId)).data).toEqual([]);
    expect((await outsider.from("attempts").select("id")).data).toEqual([]);
    const { error } = await outsider.from("problems").insert({
      household_id: householdId, source: "pasted", statement: "x".repeat(20), answer: "A", difficulty: 1, technique_tags: ["casework"],
    });
    expect(error).not.toBeNull();
  });

  it("the student cannot change household settings", async () => {
    await student.from("households").update({ timezone: "UTC" }).eq("id", householdId);
    const { data } = await admin.from("households").select("timezone").eq("id", householdId).single();
    expect(data!.timezone).toBe("America/Los_Angeles");
  });

  it("a parent cannot log attempts for the student", async () => {
    const { error } = await parent.from("attempts").insert({
      household_id: householdId, student_id: studentId, problem_id: problemId, context: "trainer",
      local_date: "2026-11-12", seconds: 1, correct: true,
    });
    expect(error).not.toBeNull();
  });

  it("the student cannot delete problems", async () => {
    await student.from("problems").delete().eq("id", problemId);
    const { data } = await admin.from("problems").select("id").eq("id", problemId);
    expect(data).toHaveLength(1);
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
  });
});
