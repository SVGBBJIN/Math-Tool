// `npm run verify:cards` (and `npm run build`, through "prebuild") runs this file: the
// curriculum graph and every card are re-validated, and any problem fails the build.
import { expect, it } from "vitest";
import { validateAllCards } from "@/lib/learn/cards/validate";
import { validateCurriculum } from "@/lib/learn/curriculum";
import { validateAllProblems } from "@/lib/learn/problems/validate";

it("the curriculum graph is sound", () => {
  expect(validateCurriculum()).toEqual([]);
});

it("every card passes validation and every key matches its independent recomputation", () => {
  const report = validateAllCards();
  for (const p of report.problems) console.error(`CARD PROBLEM ${p.card}: ${p.problem}`);
  console.log(`verify:cards — ${report.cards} cards and ${report.variants} generated variants across ${report.concepts} concepts, ${report.problems.length} problems`);
  expect(report.problems).toEqual([]);
  expect(report.cards).toBeGreaterThanOrEqual(70);
}, 120_000);

it("every Daily Problem passes validation and every step key matches its independent recomputation", () => {
  const report = validateAllProblems();
  for (const p of report.issues) console.error(`PROBLEM ${p.problem}: ${p.issue}`);
  console.log(`verify:cards — ${report.problems} daily problems and ${report.variants} generated variants, ${report.issues.length} problems`);
  expect(report.issues).toEqual([]);
  expect(report.problems).toBeGreaterThanOrEqual(16);
}, 120_000);
