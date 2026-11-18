// Daily Problem validation, run by `npm run verify:cards` before every build. A single
// problem fails the build.
//   shape   ids, steps, the key step, five increasing and different final choices, markup;
//   keys    every computable step equals its independent recomputation (./verifiers.ts),
//           the checker accepts the key and rejects every listed slip;
//   words   no real contest names; slips are wrong answers, not the key.
import { MarkupError, parseRich } from "../cards/markup";
import { parseRational } from "../math/rational";
import { PROBLEMS, PROBLEM_FAMILIES, checkStep } from "./index";
import type { Problem } from "./types";
import { PROBLEM_VERIFIERS } from "./verifiers";

export const PROBLEM_VARIANT_SEEDS = 30;
const BANNED = /\b(AMC|AIME|MAA|MATHCOUNTS|USAMO|USAJMO|olympiad)\b|#\s*\d+/i;
const value = (s: string) => { const r = parseRational(s); return r ? Number(r.n) / Number(r.d) : NaN; };
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export interface ProblemIssue { problem: string; issue: string }

export function validateProblem(p: Problem): string[] {
  const out: string[] = [];
  const add = (m: string) => out.push(m);
  const texts: [string, string][] = [["title", p.title], ["statement", p.statement], ["takeaway", p.takeaway]];
  p.steps.forEach((s, k) => {
    texts.push([`step ${k + 1} prompt`, s.prompt], [`step ${k + 1} hint`, s.hint], [`step ${k + 1} solution`, s.solution]);
    if (s.input.kind === "choice") for (const o of s.input.options) texts.push([`step ${k + 1} option ${o.id}`, o.text], ...(o.feedback ? [[`step ${k + 1} option ${o.id} feedback`, o.feedback] as [string, string]] : []));
    if (s.input.kind === "numeric") for (const sl of s.input.slips ?? []) texts.push([`step ${k + 1} slip ${sl.answer}`, sl.feedback]);
  });
  for (const [where, t] of texts) {
    if (!t.trim()) add(`${where} is empty`);
    if (BANNED.test(t)) add(`${where} names a real contest or a problem number`);
    try { parseRich(t); } catch (e) { add(`${where}: ${e instanceof MarkupError ? e.message : String(e)}`); }
  }
  if (p.steps.length < 2) add("needs at least two steps");
  if (!Number.isInteger(p.part) || p.part < 0 || p.part >= p.steps.length - 1) add("the key step must be a step before the final one");
  p.steps.forEach((s, k) => {
    const last = k === p.steps.length - 1;
    if (last !== (s.input.kind === "amc")) add(`step ${k + 1}: the final step, and only the final step, gives the five choices`);
  });

  const verify = PROBLEM_VERIFIERS[p.family ?? p.id];
  if (!verify) { add("no independent verifier"); return out; }
  let keys: (number | null)[];
  try { keys = verify(p.params ?? {}); } catch (e) { add(`verifier failed: ${String(e)}`); return out; }
  if (keys.length !== p.steps.length) { add(`verifier gives ${keys.length} keys for ${p.steps.length} steps`); return out; }

  p.steps.forEach((s, k) => {
    const i = s.input;
    const key = keys[k];
    const at = `step ${k + 1}`;
    switch (i.kind) {
      case "numeric": {
        if (!parseRational(i.answer)) { add(`${at}: key "${i.answer}" is not a number`); break; }
        if (key === null || !close(value(i.answer), key)) add(`${at}: key ${i.answer} but the verifier gets ${key}`);
        if (checkStep(s, { kind: "numeric", text: i.answer }).status !== "correct") add(`${at}: the checker rejects its own key`);
        for (const sl of i.slips ?? []) {
          if (checkStep(s, { kind: "numeric", text: sl.answer }).status !== "incorrect") add(`${at}: slip ${sl.answer} is accepted as correct`);
        }
        break;
      }
      case "choice": {
        if (key !== null) add(`${at}: a choice step should have no computed key`);
        if (!i.options.some((o) => o.id === i.answer)) add(`${at}: the answer is not an option`);
        if (new Set(i.options.map((o) => o.id)).size !== i.options.length) add(`${at}: repeated option ids`);
        if (i.options.length < 3) add(`${at}: needs at least three options`);
        break;
      }
      case "amc": {
        const vals = i.values.map(value);
        if (i.values.length !== 5) add(`${at}: needs exactly five choices, has ${i.values.length}`);
        if (vals.some((v) => !Number.isFinite(v))) add(`${at}: a choice is not a number`);
        if (vals.some((v, j) => j > 0 && !(v > vals[j - 1]))) add(`${at}: choices must be different and in increasing order`);
        if (!(i.answer >= 0 && i.answer < i.values.length)) { add(`${at}: answer index out of range`); break; }
        if (key === null || !close(vals[i.answer], key)) add(`${at}: answer ${i.values[i.answer]} but the verifier gets ${key}`);
        if (vals.filter((v) => key !== null && close(v, key)).length !== 1) add(`${at}: the right value must appear exactly once`);
        break;
      }
    }
  });
  return out;
}

export function validateAllProblems(): { problems: number; variants: number; issues: ProblemIssue[] } {
  const issues: ProblemIssue[] = [];
  const ids = new Set<string>();
  for (const p of PROBLEMS) {
    if (ids.has(p.id)) issues.push({ problem: p.id, issue: "duplicate id" });
    ids.add(p.id);
    for (const issue of validateProblem(p)) issues.push({ problem: p.id, issue });
  }
  let variants = 0;
  for (const f of PROBLEM_FAMILIES) {
    if (ids.has(f.id)) issues.push({ problem: f.id, issue: "duplicate id" });
    ids.add(f.id);
    for (let seed = 0; seed < PROBLEM_VARIANT_SEEDS; seed++) {
      variants++;
      let p: Problem;
      try { p = f.make(seed * 7919 + 13); } catch (e) { issues.push({ problem: `${f.id}~seed ${seed}`, issue: `make failed: ${String(e)}` }); continue; }
      for (const issue of validateProblem(p)) issues.push({ problem: p.id, issue });
    }
  }
  return { problems: PROBLEMS.length + PROBLEM_FAMILIES.length, variants, issues };
}
