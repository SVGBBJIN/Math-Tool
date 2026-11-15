// The shell shared by both modules: a state, a set of legal moves, a verifier that
// checks each move by computation, and a goal. A topic pack is plain data on top of it.

export interface ParamSpec {
  name: string;
  label: string;
  kind: "int" | "term" | "choice";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface MoveDef {
  id: string;
  name: string;
  /** Extra names accepted at scaffolding level 3, where the student names the move first. */
  aliases?: string[];
  blurb: string;
  params: ParamSpec[];
}

/** One move as the student (or a reference path) makes it. */
export interface MoveInput {
  move: string;
  params?: Record<string, string>;
  /** Module-specific pointer to the piece acted on (Module A: branch / side / part). */
  target?: { eq?: number; side?: "lhs" | "rhs"; part?: number };
}

export type ApplyResult<S> =
  | { ok: true; state: S; done?: boolean }
  | {
      ok: false;
      /** One line: why the move was rejected. */
      reason: string;
      /** Extra lines, e.g. a concrete counterexample. */
      detail?: string[];
      domain?: boolean;
      /** Rejected because it changes nothing: not counted as a wrong move. */
      noop?: boolean;
    };

/** A choice offered in the move menu. Module B presets the parameters (a specific slot). */
export interface MoveOption {
  key: string;
  move: string;
  label: string;
  hint?: string;
  preset?: Record<string, string>;
}

export type CardType = "worked" | "rep" | "twist";
export type ModuleId = "expr" | "struct";

export interface CardBase {
  id: string;
  module: ModuleId;
  skill: string;
  type: CardType;
  prompt: string;
  /** Hand-authored shortest path. Re-verified by `npm run verify:cards`. */
  path: MoveInput[];
  /** The move(s) this card exists to practise; any one of them counts. */
  keyMoves: string[];
  /** One line shown after every card, including "not sure". */
  insight: string;
  /** First rung of the hint ladder. */
  nudge: string;
  /** Worked examples: one or two sentences on why the key move is the right one. */
  why?: string;
  /** Seconds for the decision step; overrides the per-type budget. */
  timeLimit?: number;
  generated?: boolean;
}

export interface EngineModule<S, C extends CardBase> {
  id: ModuleId;
  init(card: C): S;
  /** Every move in this card's pack (scaffolding level 2 shows all of them). */
  options(card: C, state: S): MoveOption[];
  moveDef(card: C, moveId: string): MoveDef | undefined;
  /** Builds the next state and verifies it by computation. */
  apply(card: C, state: S, input: MoveInput): ApplyResult<S>;
  isGoal(card: C, state: S): boolean;
  show(state: S, card: C): string;
  /** The answer in its final form, for the reveal and the mistakes log. */
  answer(card: C): string;
  optionKey(input: MoveInput): string;
}

export interface Skill {
  id: string;
  title: string;
  blurb: string;
  prereqs: string[];
  /** Card ids: one worked example, three easy reps, one twist. */
  worked: string;
  reps: [string, string, string];
  twist: string;
}

export interface TopicPack<C extends CardBase = CardBase> {
  id: string;
  title: string;
  module: ModuleId;
  /** Topic from src/lib/tags.ts; ties the pack to data/topic-distribution.json. */
  topic: string;
  skills: Skill[];
  cards: C[];
  /** Fresh variants with new numbers. Every result is checked before it is shown. */
  generate(skill: string, type: "rep" | "twist", seed: number): C;
}
