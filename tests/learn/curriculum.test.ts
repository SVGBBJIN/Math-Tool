import { describe, expect, it } from "vitest";
import { AMC10 } from "@/lib/learn/curriculum/amc10";
import { CONCEPTS, ancestorsOf, findCycle, importanceOf, validateCurriculum, type Concept, type Course } from "@/lib/learn/curriculum";

const clone = (): Course => structuredClone(AMC10);
const concept = (c: Course, id: string): Concept => c.domains.flatMap((d) => d.units.flatMap((u) => u.concepts)).find((x) => x.id === id)!;

describe("curriculum", () => {
  it("is a sound course: hierarchy, objectives, prerequisites, no cycles", () => {
    expect(validateCurriculum()).toEqual([]);
    expect(AMC10.domains.length).toBeGreaterThanOrEqual(4);
    expect(CONCEPTS.length).toBeGreaterThanOrEqual(35);
    for (const c of CONCEPTS) {
      expect(c.objectives.length).toBeGreaterThanOrEqual(2);
      expect(c.standard.length).toBeGreaterThan(20);
    }
  });

  it("detects a prerequisite cycle", () => {
    const c = clone();
    concept(c, "nt.divisibility").prerequisites.push({ concept: "nt.cycles", strength: "helpful" });
    expect(findCycle(c.domains.flatMap((d) => d.units.flatMap((u) => u.concepts)))).toEqual(expect.arrayContaining(["nt.divisibility", "nt.cycles"]));
    expect(validateCurriculum(c).some((p) => p.startsWith("prerequisite cycle"))).toBe(true);
  });

  it("rejects unknown prerequisites, missing objectives, duplicate ids and misfiled concepts", () => {
    const c = clone();
    concept(c, "geo.similar").prerequisites.push({ concept: "geo.nope", strength: "required" });
    concept(c, "alg.functions").objectives = [concept(c, "alg.functions").objectives[0]];
    concept(c, "nt.primes").objectives[1].id = concept(c, "nt.primes").objectives[0].id;
    concept(c, "cp.casework").unit = "cp.probability-unit";
    const problems = validateCurriculum(c).join("\n");
    expect(problems).toMatch(/unknown prerequisite geo\.nope/);
    expect(problems).toMatch(/alg\.functions needs at least two learning objectives/);
    expect(problems).toMatch(/duplicate objective id nt\.primes/);
    expect(problems).toMatch(/cp\.casework records the wrong domain or unit/);
  });

  it("knows which concepts lean on which", () => {
    expect([...ancestorsOf("nt.cycles")]).toEqual(expect.arrayContaining(["nt.remainders", "nt.divisibility"]));
    expect(importanceOf("nt.divisibility")).toBeGreaterThan(importanceOf("nt.cycles"));
    // Helpful prerequisites never count as ancestors (they don't block).
    expect(ancestorsOf("alg.ratios-rates").size).toBe(0);
  });
});
