"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { TECHNIQUES, TOPICS, normalizeTags } from "@/lib/tags";
import { aopsProblemUrl, aopsSolutionUrl } from "@/lib/aops";
import type { FormState } from "./account";

const Letter = z.enum(["A", "B", "C", "D", "E"]);
const Contest = z.string().trim().regex(/^AMC (8|10|12)[AB]?$/, "Contest like 'AMC 10A'");

function tags(input: FormDataEntryValue | null, allowed: readonly string[]) {
  return normalizeTags(String(input ?? ""), allowed);
}

export async function addAopsProblem(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  try {
    const p = z
      .object({
        contest: Contest,
        year: z.coerce.number().int().min(2000).max(2100),
        number: z.coerce.number().int().min(1).max(25),
        answer: Letter,
        status: z.enum(["train", "vault"]),
      })
      .parse({
        contest: form.get("contest"),
        year: form.get("year"),
        number: form.get("number"),
        answer: String(form.get("answer") ?? "").toUpperCase(),
        status: form.get("status") ?? "train",
      });
    const techniques = tags(form.get("techniques"), TECHNIQUES);
    if (!techniques.length) return { error: "Add at least one technique tag" };
    const { error } = await ctx.supabase.from("problems").insert({
      household_id: ctx.household.id,
      source: "aops_wiki",
      contest: p.contest,
      year: p.year,
      number: p.number,
      url: aopsProblemUrl(p.contest, p.year, p.number),
      solution_url: aopsSolutionUrl(p.contest, p.year, p.number),
      answer: p.answer,
      difficulty: p.number,
      topic_tags: tags(form.get("topics"), TOPICS),
      technique_tags: techniques,
      status: p.status,
      created_by: ctx.user.id,
    });
    if (error) return { error: error.code === "23505" ? "That problem is already in the bank" : error.message };
  } catch (e) {
    return { error: e instanceof z.ZodError ? e.issues[0].message : (e as Error).message };
  }
  revalidatePath("/problems");
  return { message: "Added." };
}

export async function addPastedProblem(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  try {
    const statement = z.string().trim().min(10, "Paste the problem statement").max(5000).parse(form.get("statement"));
    const choices = Object.fromEntries(
      (["A", "B", "C", "D", "E"] as const).map((l) => [l, String(form.get(`choice${l}`) ?? "").trim()]),
    );
    if (Object.values(choices).some((c) => !c)) return { error: "Fill in all five choices" };
    const answer = Letter.parse(String(form.get("answer") ?? "").toUpperCase());
    const difficulty = z.coerce.number().int().min(1).max(25).parse(form.get("difficulty"));
    const techniques = tags(form.get("techniques"), TECHNIQUES);
    if (!techniques.length) return { error: "Add at least one technique tag" };
    const { error } = await ctx.supabase.from("problems").insert({
      household_id: ctx.household.id,
      source: "pasted",
      contest: String(form.get("contest") ?? "").trim() || null,
      statement,
      choices,
      answer,
      difficulty,
      topic_tags: tags(form.get("topics"), TOPICS),
      technique_tags: techniques,
      status: "train",
      created_by: ctx.user.id,
    });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof z.ZodError ? e.issues[0].message : (e as Error).message };
  }
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
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].toLowerCase().replace(/\s/g, "");
  const body = header.startsWith("contest,") ? lines.slice(1) : lines;
  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  body.forEach((line, i) => {
    const [contest, year, number, answer, topic, techniques, status] = line.split(",").map((c) => c.trim());
    try {
      const c = Contest.parse(contest);
      const y = z.coerce.number().int().min(2000).max(2100).parse(year);
      const n = z.coerce.number().int().min(1).max(25).parse(number);
      const a = Letter.parse((answer ?? "").toUpperCase());
      const tech = normalizeTags(techniques ?? "", TECHNIQUES);
      if (!tech.length) throw new Error("no technique tags");
      const st = z.enum(["train", "vault"]).parse(status || "train");
      rows.push({
        household_id: ctx.household.id,
        source: "aops_wiki",
        contest: c,
        year: y,
        number: n,
        url: aopsProblemUrl(c, y, n),
        solution_url: aopsSolutionUrl(c, y, n),
        answer: a,
        difficulty: n,
        topic_tags: normalizeTags(topic ?? "", TOPICS),
        technique_tags: tech,
        status: st,
        created_by: ctx.user.id,
      });
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof z.ZodError ? e.issues[0].message : (e as Error).message}`);
    }
  });
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
  // Sealing is allowed; unsealing is reserved for endurance mode so the vault stays blind.
  const { data: current } = await ctx.supabase.from("problems").select("status").eq("id", id).single();
  if (current?.status === "vault" && status !== "vault") {
    return { error: "Vault problems are unsealed only by endurance mode" };
  }
  const { error } = await ctx.supabase.from("problems").update({ status }).eq("id", id);
  revalidatePath("/problems");
  return error ? { error: error.message } : {};
}

export async function deleteProblem(id: string) {
  const ctx = await requireContext();
  const { error } = await ctx.supabase.from("problems").delete().eq("id", id).eq("household_id", ctx.household.id);
  revalidatePath("/problems");
  return error ? { error: error.message } : {};
}
