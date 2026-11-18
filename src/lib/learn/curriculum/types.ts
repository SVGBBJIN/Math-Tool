// Curriculum model: Course → Domain → Unit → Concept → Learning objectives → Cards.
// Plain data. The graph rules (lookups, prerequisite checks, cycle detection) live in
// ./index.ts; nothing here knows about progress or the UI.

export interface Objective {
  /** Unique within the course: "<conceptId>/<key>". Cards point at exactly one objective. */
  id: string;
  /** Measurable: starts with a verb, describes something a card can ask the student to do. */
  text: string;
}

export interface Prerequisite {
  concept: string;
  /**
   * required: the daily selection will not start this concept until the prerequisite is
   *           established (see `isLocked` in ../mastery.ts). The student can still open it.
   * helpful:  related background. Never blocks anything; used to order what comes next.
   */
  strength: "required" | "helpful";
}

export interface Concept {
  id: string;
  name: string;
  domain: string;
  unit: string;
  /** One or two sentences: what the idea is and why it matters in contest problems. */
  description: string;
  objectives: Objective[];
  prerequisites: Prerequisite[];
  /** Named problem-solving techniques this concept teaches. */
  techniques: string[];
  /** Other concepts that use or echo this one (symmetric by convention, not enforced). */
  related: string[];
  /** What mastered performance looks like for this concept, in plain words. */
  standard: string;
}

export interface Unit { id: string; name: string; concepts: Concept[] }
export interface Domain {
  id: string;
  name: string;
  /** Topic key in data/topic-distribution.json, used to balance which domain gets the next new concept. */
  topic: string;
  units: Unit[];
}
export interface Course { id: string; name: string; domains: Domain[] }
