// The Daily Problem: one contest-style problem a day, solved the Khan Academy way, one
// small step at a time. Each step has its own answer box, a hint, and a worked solution
// that "Show me this step" reveals. On "part" days the earlier steps are already worked
// and the student solves the key step on their own.
//
// Problems are plain data like cards. Every computable step answer is recomputed by an
// independent function in ./verifiers.ts, and `npm run verify:cards` fails the build on
// any difference (see ./validate.ts).
import type { Figure, KnownSlip, Option } from "../cards/types";

export type ProblemDomain = "alg" | "nt" | "cp" | "geo";
export const DOMAIN_NAME: Record<ProblemDomain, string> = {
  alg: "Algebra",
  nt: "Number Theory",
  cp: "Counting & Probability",
  geo: "Geometry",
};
export const PROBLEM_DOMAINS: ProblemDomain[] = ["alg", "nt", "cp", "geo"];

export type StepInput =
  /** A number, compared exactly (integers, fractions, terminating decimals). */
  | { kind: "numeric"; answer: string; unit?: string; slips?: KnownSlip[] }
  /** Pick one: used for "which idea fits here?" steps, which have no computable key. */
  | { kind: "choice"; options: Option[]; answer: string }
  /** The final question, contest style: five values in increasing order, (A) to (E). */
  | { kind: "amc"; values: string[]; answer: number };

export interface Step {
  /** The small question this step asks. */
  prompt: string;
  input: StepInput;
  /** One nudge. Using it is recorded. */
  hint: string;
  /** The worked step, shown after it is solved or revealed. */
  solution: string;
}

export interface Problem {
  id: string;
  domain: ProblemDomain;
  /** 1 (warm-up) to 5 (late in the contest). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  title: string;
  statement: string;
  figure?: Figure;
  /** In order. The last step is always the final answer, as an `amc` step. */
  steps: Step[];
  /** The key step: what a student solves on a "part" day. Never the final step. */
  part: number;
  /** The one idea to carry away. */
  takeaway: string;
  /** For generated problems: the family id and the numbers used. */
  family?: string;
  params?: Record<string, number>;
}

/** A problem template whose numbers change with the seed. `make` must be deterministic. */
export interface ProblemFamily {
  id: string;
  domain: ProblemDomain;
  difficulty: Problem["difficulty"];
  make(seed: number): Problem;
}

export type ProblemMode = "full" | "part";

/** Progress on one step. `shown` = the student chose "Show me this step". */
export interface StepProgress { status: "open" | "solved" | "shown"; tries: number; hint: boolean }

/** One day's problem and how it went. Kept in the learning record. */
export interface ProblemDay {
  date: string;
  problemId: string;
  mode: ProblemMode;
  steps: StepProgress[];
  done: boolean;
  /** clean = every step the student owned was right first time, no hints; solved = got there with help; shown = a step was revealed. */
  outcome: "clean" | "solved" | "shown" | null;
}
