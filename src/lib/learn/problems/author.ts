// Small helpers so problem files read as content.
import { rng } from "../content/author";
import type { Option } from "../cards/types";
import type { Problem, ProblemFamily, Step, StepInput } from "./types";

export { rng };

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** A reduced fraction as text: "3/4", or "5" when it is whole. */
export function frac(n: number, d = 1): string {
  if (d < 0) [n, d] = [-n, -d];
  const k = gcd(n, d) || 1;
  return d / k === 1 ? `${n / k}` : `${n / k}/${d / k}`;
}
const value = (s: string) => { const [n, d = "1"] = s.split("/"); return Number(n) / Number(d); };
/** A value as card markup: $\frac{3}{4}$ or $12$. */
export function tex(v: string | number): string {
  const s = String(v);
  const [n, d] = s.split("/");
  return d ? `$${n.startsWith("-") ? "-" : ""}\\frac{${n.replace("-", "")}}{${d}}$` : `$${s}$`;
}

export const num = (answer: string | number, slips?: [string | number, string][], unit?: string): StepInput => ({
  kind: "numeric",
  answer: String(answer),
  ...(unit ? { unit } : {}),
  ...(slips?.length ? { slips: slips.map(([a, feedback]) => ({ answer: String(a), feedback })) } : {}),
});
export const choice = (answer: string, options: Option[]): StepInput => ({ kind: "choice", answer, options });
export const opt = (id: string, text: string, feedback?: string): Option => ({ id, text, ...(feedback ? { feedback } : {}) });

/**
 * The final question with five contest-style choices in increasing order. Distractors that
 * collide with the answer or each other are dropped and replaced with nearby values, so a
 * generated problem always has exactly five different choices.
 */
export function amc(correct: string | number, distractors: (string | number)[]): StepInput {
  const key = String(correct);
  const out: string[] = [key];
  const add = (v: string) => { if (out.length < 5 && Number.isFinite(value(v)) && !out.some((o) => Math.abs(value(o) - value(v)) < 1e-12)) out.push(v); };
  for (const d of distractors) add(String(d));
  const [n, d] = key.includes("/") ? key.split("/").map(Number) : [Number(key), 1];
  for (let k = 1; out.length < 5 && k < 50; k++) {
    if (d === 1) { add(String(n + k)); add(String(n - k)); } else { add(frac(n + k, d)); add(frac(Math.max(1, n - k), d)); }
  }
  const values = out.sort((a, b) => value(a) - value(b));
  return { kind: "amc", values, answer: values.indexOf(key) };
}

export const step = (prompt: string, input: StepInput, hint: string, solution: string): Step => ({ prompt, input, hint, solution });

type Body = Omit<Problem, "id" | "domain" | "difficulty" | "family" | "params">;
export const problem = (id: string, domain: Problem["domain"], difficulty: Problem["difficulty"], body: Body): Problem => ({ id: `p.${domain}.${id}`, domain, difficulty, ...body });

/** A family of problems with fresh numbers. Every variant is recomputed by PROBLEM_VERIFIERS. */
export function problemFamily(
  key: string, domain: Problem["domain"], difficulty: Problem["difficulty"], make: (r: ReturnType<typeof rng>) => Body & { params: Record<string, number> },
): ProblemFamily {
  const id = `p.${domain}.${key}`;
  return { id, domain, difficulty, make: (seed) => ({ ...make(rng(seed)), id: `${id}~${seed}`, domain, difficulty, family: id }) };
}
