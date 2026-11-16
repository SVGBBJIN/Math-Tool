// `npm run verify:cards` (and `npm run build`, through "prebuild") runs this file: the
// curriculum graph and every card are re-validated, and any problem fails the build.
import { expect, it } from "vitest";
import { validateAllCards } from "@/lib/learn/cards/validate";
import { validateCurriculum } from "@/lib/learn/curriculum";

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
