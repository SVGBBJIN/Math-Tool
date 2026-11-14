"use server";
import { revalidatePath } from "next/cache";
import { requireContext, requireParent } from "@/lib/session";
import { parseAopsForm, parseCsv, parsePastedForm } from "@/lib/problem-input";
import type { FormState } from "./account";

export async function addAopsProblem(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const parsed = parseAopsForm(form);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await ctx.supabase
    .from("problems")
    .insert({ ...parsed.value, household_id: ctx.household.id, created_by: ctx.user.id });
  if (error) return { error: error.code === "23505" ? "That problem is already in the bank" : error.message };
  revalidatePath("/problems");
  return { message: "Added." };
}

export async function addPastedProblem(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const parsed = parsePastedForm(form);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await ctx.supabase
    .from("problems")
    .insert({ ...parsed.value, household_id: ctx.household.id, created_by: ctx.user.id });
  if (error) return { error: error.message };
  revalidatePath("/problems");
  return { message: "Added." };
}

/**
 * CSV import of AoPS metadata. Header: contest,year,number,answer,topic,techniques[,status]
 * Tags are ';'-separated. Rows that fail validation are reported, valid rows are inserted.
 */
export async function importCsv(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const text = String(form.get("csv") ?? "").trim();
  if (!text) return { error: "Paste CSV rows" };
  const { rows: parsed, errors } = parseCsv(text);
  const rows = parsed.map((r) => ({ ...r, household_id: ctx.household.id, created_by: ctx.user.id }));
  let inserted = 0;
  if (rows.length) {
    const { data, error } = await ctx.supabase
      .from("problems")
      .upsert(rows, { onConflict: "household_id,contest,year,number", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: error.message };
    inserted = data?.length ?? 0;
  }
  revalidatePath("/problems");
  const skipped = rows.length - inserted;
  return {
    message: `Imported ${inserted}${skipped ? `, ${skipped} already in bank` : ""}.`,
    error: errors.length ? errors.slice(0, 10).join("\n") : undefined,
  };
}

export async function setProblemStatus(id: string, status: "train" | "vault" | "burned") {
  const ctx = await requireContext();
  if (ctx.profile.role !== "parent") {
    if (status === "vault") return { error: "Only a parent can seal problems into the vault" };
    const { data: current } = await ctx.supabase.from("problems").select("status").eq("id", id).single();
    if (current?.status === "vault") return { error: "Vault problems are unsealed only by endurance mode" };
  }
  const { error } = await ctx.supabase.from("problems").update({ status }).eq("id", id);
  revalidatePath("/problems");
  return error ? { error: error.message } : {};
}

export async function deleteProblem(id: string) {
  const ctx = await requireParent();
  const { error } = await ctx.supabase.from("problems").delete().eq("id", id).eq("household_id", ctx.household.id);
  revalidatePath("/problems");
  return error ? { error: error.message } : {};
}
