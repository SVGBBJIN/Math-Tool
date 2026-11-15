// The shell shared by both modules: a state, a set of legal moves, a verifier that
// checks each move by computation, and a goal. A topic pack is plain data on top of it.

export interface ParamSpec {
  name: string;
  label: string;
  /**
   * int / term: a slot filled by dropping a piece of the expression into it or with the keypad.
   * toggle: an on/off switch on the move itself (e.g. "include the negative root"), never a list.
   */
  kind: "int" | "term" | "toggle";
  placeholder?: string;
  /** toggle only: the value sent when on / off. */
  on?: string;
  off?: string;
}

export type ToolGroup = "factor" | "rewrite" | "equation" | "mod" | "build" | "join";

export interface MoveDef {
  id: string;
  name: string;
  blurb: string;
  params: ParamSpec[];
  /** Where the tile sits in the standing toolbox. Gesture-only moves have no tile. */
  group?: ToolGroup;
  /** Performed by direct manipulation (drag a term across "=", tap two like terms...), not a tile. */
  gesture?: boolean;
  /** Level 1: names the kind of step ("pull out the common factor"). */
  kind: string;
  /** Level 2: only the goal of the step ("get everything the terms share outside a bracket"). */
  goal: string;
  /** One line shown when the step locks in: why it works. */
  why: string;
}

/** One move as the student (or a reference path) makes it. */
export interface MoveInput {
  move: string;
  params?: Record<string, string>;
  /** Module-specific pointer to the piece acted on (Module A: branch / side / part). */
  target?: { eq?: number; side?: "lhs" | "rhs"; part?: number };
}

export type ApplyResult<S> =
  | { ok: true; state: S; done?: boolean; /** One line: why this step is valid. */ why?: string }
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
  /**
   * The standing toolbox: the same tiles for every card of this module, never a list
   * built for the question in front of the student.
   */
  toolbox(): MoveDef[];
  moveDef(moveId: string): MoveDef | undefined;
  /** Builds the next state and verifies it by computation. */
  apply(card: C, state: S, input: MoveInput): ApplyResult<S>;
  isGoal(card: C, state: S): boolean;
  show(state: S, card: C): string;
  /** The answer in its final form, for the reveal and the mistakes log. */
  answer(card: C): string;
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
