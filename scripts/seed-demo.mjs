// Seeds LOCAL demo data: a parent + student login and 20 original practice problems.
// Usage: node --env-file=.env.local scripts/seed-demo.mjs
// Refuses to run against anything but a local Supabase.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost"].includes(host)) {
  throw new Error(`Refusing to seed demo data into non-local Supabase (${host}).`);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = "demo-password-123";

async function ensureUser(email) {
  const { data: list } = await db.auth.admin.listUsers();
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

const parentId = await ensureUser("parent@demo.local");
const studentId = await ensureUser("student@demo.local");

let { data: parentProfile } = await db.from("profiles").select("household_id").eq("id", parentId).maybeSingle();
let householdId = parentProfile?.household_id;
if (!householdId) {
  const { data: h, error } = await db
    .from("households")
    .insert({ name: "Demo household", timezone: "America/Los_Angeles", amc_date: "2027-03-04", created_by: parentId })
    .select("id")
    .single();
  if (error) throw error;
  householdId = h.id;
  await db.from("profiles").insert([
    { id: parentId, household_id: householdId, role: "parent", display_name: "Demo Parent" },
    { id: studentId, household_id: householdId, role: "student", display_name: "Demo Student" },
  ]);
}

const problems = JSON.parse(readFileSync(new URL("./demo/problems.json", import.meta.url)));
const { count } = await db.from("problems").select("id", { count: "exact", head: true }).eq("household_id", householdId);
if (!count) {
  const { error } = await db.from("problems").insert(
    problems.map((p) => ({
      household_id: householdId,
      source: "pasted",
      contest: "Demo (original practice)",
      statement: p.statement,
      choices: p.choices,
      answer: p.answer,
      difficulty: p.difficulty,
      topic_tags: p.topics,
      technique_tags: p.techniques,
      status: "train",
      created_by: parentId,
    })),
  );
  if (error) throw error;
}
console.log(`Seeded. Logins (local only): parent@demo.local / student@demo.local, password ${PASSWORD}`);
