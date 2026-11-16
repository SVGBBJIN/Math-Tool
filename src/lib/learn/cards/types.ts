// Card model. A card develops ONE capability: it belongs to one concept and one learning
// objective, and its type says what kind of evidence a response gives. Cards are plain
// data (JSON-serialisable), so they can be written by hand or produced by an authoring
// tool later; either way they only reach students after ./validate.ts passes.

export type CardType = "insight" | "technique" | "recognition" | "application" | "variation";
/** What a response to a card is evidence OF. Retention is not a card type: it is any of these after time has passed. */
export type Dimension = "comprehension" | "recognition" | "application" | "transfer";
export const DIMENSION_OF: Record<CardType, Dimension> = {
  insight: "comprehension",
  technique: "comprehension",
  recognition: "recognition",
  application: "application",
  variation: "transfer",
};
export const CARD_TYPES: CardType[] = ["insight", "technique", "recognition", "application", "variation"];

/** A specific wrong answer and what it usually means. Worded as a possibility, never as a diagnosis. */
export interface KnownSlip { answer: string; feedback: string }
export interface Option { id: string; text: string; feedback?: string }

export type Interaction =
  /** A number, compared exactly: integers, fractions and terminating decimals. */
  | { kind: "numeric"; answer: string; unit?: string; slips?: KnownSlip[] }
  /** A polynomial expression, compared symbolically. `factored` also requires a complete factorisation. */
  | { kind: "expression"; answer: string; vars: string[]; form: "any" | "factored"; slips?: KnownSlip[] }
  /** Pick one. For predictions and "which idea fits": never used for application or variation cards. */
  | { kind: "choice"; options: Option[]; answer: string }
  /** Pick every one that applies. */
  | { kind: "multi"; options: Option[]; answers: string[] }
  /** Put the steps of an argument in order. `items` is the correct order; the UI shuffles. */
  | { kind: "order"; items: Option[] }
  /** Reasoning with gaps. `text` contains {{0}}, {{1}}, … where the blanks go. */
  | { kind: "blanks"; text: string; blanks: { answer: string; slips?: KnownSlip[] }[] }
  /** Tap parts of the figure. Target ids refer to `target` items in the card's figure. */
  | { kind: "tap"; answers: string[] }
  /** Explain in your own words, then compare with a model answer and tick the points you covered. */
  | { kind: "explain"; placeholder: string; model: string; points: string[] };

export type Response =
  | { kind: "numeric"; text: string }
  | { kind: "expression"; text: string }
  | { kind: "choice"; id: string }
  | { kind: "multi"; ids: string[] }
  | { kind: "order"; ids: string[] }
  | { kind: "blanks"; values: string[] }
  | { kind: "tap"; ids: string[] }
  | { kind: "explain"; text: string; covered: number[] };

export type Pt = [number, number];
export type FigItem =
  | { t: "line"; a: Pt; b: Pt; dash?: boolean }
  | { t: "poly"; pts: Pt[]; fill?: "tint" | "accent" }
  | { t: "circle"; c: Pt; r: number }
  | { t: "dot"; at: Pt }
  | { t: "label"; at: Pt; text: string; tone?: "muted" | "accent" }
  /** Angle mark at `at`, between the rays towards p and q. `square` draws a right-angle box. */
  | { t: "angle"; at: Pt; p: Pt; q: Pt; r?: number; square?: boolean; tone?: "accent" }
  /** Equal-length tick marks on a segment. */
  | { t: "tick"; a: Pt; b: Pt; n?: number }
  /** A tappable spot (only meaningful with a `tap` interaction). */
  | { t: "target"; id: string; at: Pt; r?: number; name: string };
export interface Figure {
  w: number;
  h: number;
  /** Describes the figure for screen readers and for anyone who cannot see it. */
  alt: string;
  items: FigItem[];
}

export type Verification =
  /** The key is recomputed by an independent function in content/verifiers.ts (brute force or exact arithmetic). */
  | { method: "computed"; note: string }
  /** No computable key (a judgement about which idea fits, a self-explanation). `note` says how it was reviewed. */
  | { method: "reasoned"; note: string };

export interface Provenance {
  origin: "original" | "adapted" | "generated";
  author: string;
  created: string;
  /** For `adapted`: what it was adapted from (an internal card id; never a contest problem). */
  basedOn?: string;
}

export interface Card {
  id: string;
  conceptId: string;
  objectiveId: string;
  type: CardType;
  /** 1 (first contact) to 5 (hard for the contest). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** Teaching shown before the task. Required for technique cards: the method and a demonstration. */
  teach?: { body: string; steps?: string[] };
  prompt: string;
  figure?: Figure;
  interaction: Interaction;
  /** One nudge towards the idea. Using it is recorded and lowers the weight of the evidence. */
  hint?: string;
  feedback: {
    /** Why the reasoning works (shown on a correct answer). */
    correct: string;
    /** The reasoning that was needed (shown on a wrong answer with no more specific match). */
    incorrect: string;
  };
  explanation: { summary: string; steps?: string[] };
  /** The one sentence to remember. */
  takeaway: string;
  /** When this idea is the right tool. */
  whenToUse: string;
  /** Concepts this card leans on beyond its own concept's prerequisites. */
  requires?: string[];
  /** Estimated seconds to complete. */
  seconds: number;
  verification: Verification;
  source: Provenance;
  /** Set on generated variants: the family they come from and the numbers used. */
  family?: string;
  params?: Record<string, number>;
}

/**
 * A family of cards that test the same skill with different numbers, so a review never has to
 * repeat an identical problem. `make` must be deterministic in `seed`.
 */
export interface CardFamily {
  id: string;
  conceptId: string;
  objectiveId: string;
  type: "application" | "variation";
  difficulty: Card["difficulty"];
  make(seed: number): Card;
}
