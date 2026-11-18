// Small helpers so card files read as content, not boilerplate.
import type { Card, CardFamily, CardType, KnownSlip, Option, Provenance, Verification } from "../cards/types";

export const ORIGINAL: Provenance = { origin: "original", author: "AMC Coach", created: "2026-11-16" };
export const adaptedFrom = (basedOn: string): Provenance => ({ origin: "adapted", author: "AMC Coach", created: "2026-11-16", basedOn });
export const COMPUTED = (note: string): Verification => ({ method: "computed", note });
export const REASONED = (note: string): Verification => ({ method: "reasoned", note });

type Body = Omit<Card, "id" | "conceptId" | "objectiveId" | "type" | "difficulty" | "seconds" | "source"> & { source?: Provenance };

/** Cards for one concept. Ids are "<concept>.<key>"; objectives are given by their short key. */
export function forConcept(conceptId: string) {
  return (key: string, type: CardType, objective: string, difficulty: Card["difficulty"], seconds: number, body: Body): Card => ({
    id: `${conceptId}.${key}`,
    conceptId,
    objectiveId: `${conceptId}/${objective}`,
    type,
    difficulty,
    seconds,
    source: ORIGINAL,
    ...body,
  });
}

export const opt = (id: string, text: string, feedback?: string): Option => ({ id, text, ...(feedback ? { feedback } : {}) });
export const slip = (answer: string | number, feedback: string): KnownSlip => ({ answer: String(answer), feedback });

/** Deterministic pseudo-random numbers from a seed (mulberry32). */
export function rng(seed: number) {
  let a = (seed >>> 0) + 0x6d2b79f5;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
  };
}

type FamilyBody = Omit<Card, "id" | "conceptId" | "objectiveId" | "type" | "difficulty" | "source" | "family" | "verification"> & { params: Record<string, number> };
/** A family of same-skill variants. Every variant is recomputed by FAMILY_VERIFIERS before it can be shown. */
export function family(
  conceptId: string, key: string, type: CardFamily["type"], objective: string, difficulty: Card["difficulty"], make: (r: ReturnType<typeof rng>) => FamilyBody,
): CardFamily {
  const id = `${conceptId}.${key}`;
  return {
    id, conceptId, objectiveId: `${conceptId}/${objective}`, type, difficulty,
    make: (seed) => ({
      ...make(rng(seed)),
      id: `${id}~${seed}`, conceptId, objectiveId: `${conceptId}/${objective}`, type, difficulty, family: id,
      source: { origin: "generated", author: "AMC Coach", created: "2026-11-16", basedOn: id },
      verification: COMPUTED("Recomputed from the variant's parameters by FAMILY_VERIFIERS."),
    }),
  };
}
