// Validation + normalization for problem-bank input. Pure (no I/O) so the signed-in server
// actions and the browser-only guest mode share one set of rules.
import { z } from "zod";
import { TECHNIQUES, TOPICS, normalizeTags } from "./tags";
import { aopsProblemUrl, aopsSolutionUrl } from "./aops";

export type Letter = "A" | "B" | "C" | "D" | "E";
export type ProblemStatus = "train" | "vault" | "burned";

/** A validated problem, before an owner/id is attached. */
export interface ProblemInput {
  source: "aops_wiki" | "pasted";
  contest: string | null;
  year: number | null;
  number: number | null;
  url: string | null;
  solution_url: string | null;
  statement: string | null;
  choices: Record<string, string> | null;
  answer: Letter;
  difficulty: number;
  topic_tags: string[];
  technique_tags: string[];
  status: ProblemStatus;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const LetterSchema = z.enum(["A", "B", "C", "D", "E"]);
const Contest = z.string().trim().regex(/^AMC (8|10|12)[AB]?$/, "Contest like 'AMC 10A'");

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : (e as Error).message };
}

function aopsProblem(c: { contest: string; year: number; number: number; answer: Letter; status: "train" | "vault"; topics: string[]; techniques: string[] }): ProblemInput {
  return {
    source: "aops_wiki",
    contest: c.contest,
    year: c.year,
    number: c.number,
    url: aopsProblemUrl(c.contest, c.year, c.number),
    solution_url: aopsSolutionUrl(c.contest, c.year, c.number),
    statement: null,
    choices: null,
    answer: c.answer,
    difficulty: c.number,
    topic_tags: c.topics,
    technique_tags: c.techniques,
    status: c.status,
  };
}

export function parseAopsForm(form: FormData): Parsed<ProblemInput> {
  try {
    const p = z
      .object({
        contest: Contest,
        year: z.coerce.number().int().min(2000).max(2100),
        number: z.coerce.number().int().min(1).max(25),
        answer: LetterSchema,
        status: z.enum(["train", "vault"]),
      })
      .parse({
        contest: form.get("contest"),
        year: form.get("year"),
        number: form.get("number"),
        answer: String(form.get("answer") ?? "").toUpperCase(),
        status: form.get("status") ?? "train",
      });
    const techniques = normalizeTags(String(form.get("techniques") ?? ""), TECHNIQUES);
    if (!techniques.length) return { ok: false, error: "Add at least one technique tag" };
    const topics = normalizeTags(String(form.get("topics") ?? ""), TOPICS);
    return { ok: true, value: aopsProblem({ ...p, topics, techniques }) };
  } catch (e) {
    return fail(e);
  }
}

export function parsePastedForm(form: FormData): Parsed<ProblemInput> {
  try {
    const statement = z.string().trim().min(10, "Paste the problem statement").max(5000).parse(form.get("statement"));
    const choices = Object.fromEntries(
      (["A", "B", "C", "D", "E"] as const).map((l) => [l, String(form.get(`choice${l}`) ?? "").trim()]),
    );
    if (Object.values(choices).some((c) => !c)) return { ok: false, error: "Fill in all five choices" };
    const answer = LetterSchema.parse(String(form.get("answer") ?? "").toUpperCase());
    const difficulty = z.coerce.number().int().min(1).max(25).parse(form.get("difficulty"));
    const techniques = normalizeTags(String(form.get("techniques") ?? ""), TECHNIQUES);
    if (!techniques.length) return { ok: false, error: "Add at least one technique tag" };
    const topics = normalizeTags(String(form.get("topics") ?? ""), TOPICS);
    return {
      ok: true,
      value: {
        source: "pasted",
        contest: String(form.get("contest") ?? "").trim() || null,
        year: null,
        number: null,
        url: null,
        solution_url: null,
        statement,
        choices,
        answer,
        difficulty,
        topic_tags: topics,
        technique_tags: techniques,
        status: "train",
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/**
 * CSV of AoPS metadata. Header: contest,year,number,answer,topic,techniques[,status]
 * Tags are ';'-separated. Invalid rows are reported; valid rows are returned.
 */
export function parseCsv(text: string): { rows: ProblemInput[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: [] };
  const header = lines[0].toLowerCase().replace(/\s/g, "");
  const body = header.startsWith("contest,") ? lines.slice(1) : lines;
  const rows: ProblemInput[] = [];
  const errors: string[] = [];
  body.forEach((line, i) => {
    const [contest, year, number, answer, topic, techniques, status] = line.split(",").map((c) => c.trim());
    try {
      const c = Contest.parse(contest);
      const y = z.coerce.number().int().min(2000).max(2100).parse(year);
      const n = z.coerce.number().int().min(1).max(25).parse(number);
      const a = LetterSchema.parse((answer ?? "").toUpperCase());
      const tech = normalizeTags(techniques ?? "", TECHNIQUES);
      if (!tech.length) throw new Error("no technique tags");
      const st = z.enum(["train", "vault"]).parse(status || "train");
      rows.push(
        aopsProblem({ contest: c, year: y, number: n, answer: a, status: st, topics: normalizeTags(topic ?? "", TOPICS), techniques: tech }),
      );
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof z.ZodError ? e.issues[0].message : (e as Error).message}`);
    }
  });
  return { rows, errors };
}
