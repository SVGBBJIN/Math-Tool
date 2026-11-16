// Curriculum engine: lookups over the course, and the checks that keep the graph sound.
// Pure functions over plain data; no progress, no UI.
import distribution from "../../../../data/topic-distribution.json";
import { AMC10 } from "./amc10";
import type { Concept, Course, Domain, Objective, Unit } from "./types";

export type { Concept, Course, Domain, Objective, Prerequisite, Unit } from "./types";
export const COURSE: Course = AMC10;

export const allConcepts = (course: Course = COURSE): Concept[] => course.domains.flatMap((d) => d.units.flatMap((u) => u.concepts));
/** Teaching order: the order concepts are written in the course. Prerequisites always come first within a domain. */
export const CONCEPTS: Concept[] = allConcepts();

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));
const OBJECTIVES = new Map<string, { objective: Objective; concept: Concept }>(
  CONCEPTS.flatMap((c) => c.objectives.map((o) => [o.id, { objective: o, concept: c }] as [string, { objective: Objective; concept: Concept }])),
);
const DOMAINS = new Map(COURSE.domains.map((d) => [d.id, d]));
const UNITS = new Map(COURSE.domains.flatMap((d) => d.units.map((u) => [u.id, u] as [string, Unit])));

export const conceptOf = (id: string): Concept | undefined => BY_ID.get(id);
export const objectiveOf = (id: string): Objective | undefined => OBJECTIVES.get(id)?.objective;
export const domainOf = (id: string): Domain | undefined => DOMAINS.get(id);
export const unitOf = (id: string): Unit | undefined => UNITS.get(id);
export const orderOf = (id: string): number => CONCEPTS.findIndex((c) => c.id === id);

export const requiredPrereqs = (c: Concept): string[] => c.prerequisites.filter((p) => p.strength === "required").map((p) => p.concept);

/** Concepts that list `id` as a prerequisite (either strength). */
export function dependentsOf(id: string, concepts: Concept[] = CONCEPTS): Concept[] {
  return concepts.filter((c) => c.prerequisites.some((p) => p.concept === id));
}

/** Every concept reachable by following required prerequisites upward. */
export function ancestorsOf(id: string, concepts: Concept[] = CONCEPTS): Set<string> {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const out = new Set<string>();
  const walk = (x: string) => {
    for (const p of byId.get(x)?.prerequisites ?? []) {
      if (p.strength !== "required" || out.has(p.concept)) continue;
      out.add(p.concept);
      walk(p.concept);
    }
  };
  walk(id);
  return out;
}

/** How much of the curriculum leans on a concept: the number of concepts that require it, directly or not. */
export function importanceOf(id: string, concepts: Concept[] = CONCEPTS): number {
  return concepts.filter((c) => ancestorsOf(c.id, concepts).has(id)).length;
}

/** A cycle in the prerequisite graph (any strength), as a list of ids, or null. */
export function findCycle(concepts: Concept[] = CONCEPTS): string[] | null {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const state = new Map<string, 1 | 2>(); // 1 = on the current path, 2 = finished
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...path.slice(path.indexOf(id)), id];
    state.set(id, 1);
    path.push(id);
    for (const p of byId.get(id)?.prerequisites ?? []) {
      const found = byId.has(p.concept) ? visit(p.concept) : null;
      if (found) return found;
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const c of concepts) {
    const found = visit(c.id);
    if (found) return found;
  }
  return null;
}

/** Structural problems in a course. Empty means sound. */
export function validateCurriculum(course: Course = COURSE): string[] {
  const problems: string[] = [];
  const concepts = allConcepts(course);
  const ids = new Set<string>();
  const objectiveIds = new Set<string>();
  const unitIds = new Set<string>();
  const topics = distribution.topics as Record<string, unknown>;

  for (const d of course.domains) {
    if (!d.units.length) problems.push(`domain ${d.id} has no units`);
    if (!(d.topic in topics)) problems.push(`domain ${d.id} has unknown topic "${d.topic}"`);
    for (const u of d.units) {
      if (unitIds.has(u.id)) problems.push(`duplicate unit id ${u.id}`);
      unitIds.add(u.id);
      if (!u.concepts.length) problems.push(`unit ${u.id} has no concepts`);
      for (const c of u.concepts) {
        if (c.domain !== d.id || c.unit !== u.id) problems.push(`${c.id} records the wrong domain or unit`);
        if (!c.id.startsWith(`${d.id}.`)) problems.push(`${c.id} should start with "${d.id}."`);
      }
    }
  }
  for (const c of concepts) {
    if (ids.has(c.id)) problems.push(`duplicate concept id ${c.id}`);
    if (unitIds.has(c.id)) problems.push(`${c.id} is used as both a unit id and a concept id`);
    ids.add(c.id);
    if (!c.name.trim() || !c.description.trim() || !c.standard.trim()) problems.push(`${c.id} is missing a name, description or mastery standard`);
    if (c.objectives.length < 2) problems.push(`${c.id} needs at least two learning objectives`);
    if (!c.techniques.length) problems.push(`${c.id} lists no techniques`);
    for (const o of c.objectives) {
      if (objectiveIds.has(o.id)) problems.push(`duplicate objective id ${o.id}`);
      objectiveIds.add(o.id);
      if (!o.id.startsWith(`${c.id}/`)) problems.push(`objective ${o.id} does not belong to ${c.id}`);
      if (!/^[A-Z][a-z]+ /.test(o.text) || !o.text.endsWith(".")) problems.push(`objective ${o.id} should be a sentence starting with a verb`);
    }
  }
  for (const c of concepts) {
    const seen = new Set<string>();
    for (const p of c.prerequisites) {
      if (!ids.has(p.concept)) problems.push(`${c.id} has unknown prerequisite ${p.concept}`);
      if (p.concept === c.id) problems.push(`${c.id} lists itself as a prerequisite`);
      if (seen.has(p.concept)) problems.push(`${c.id} lists prerequisite ${p.concept} twice`);
      seen.add(p.concept);
    }
    for (const r of c.related) {
      if (!ids.has(r)) problems.push(`${c.id} has unknown related concept ${r}`);
      if (r === c.id) problems.push(`${c.id} lists itself as related`);
    }
  }
  const cycle = findCycle(concepts);
  if (cycle) problems.push(`prerequisite cycle: ${cycle.join(" → ")}`);
  return problems;
}

/** Share of contest problems per domain, for balancing which domain gets the next new concept. */
export function domainWeight(domainId: string): number {
  const topic = DOMAINS.get(domainId)?.topic ?? "";
  return (distribution.topics as Record<string, { weight: number }>)[topic]?.weight ?? 0.05;
}
