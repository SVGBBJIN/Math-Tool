// `npm run verify:cards` (and `npm run build`, through "prebuild") runs this file: every
// card's key and reference path is re-verified, and any mismatch fails the build.
import { expect, it } from "vitest";
import { verifyAllCards } from "@/lib/engine/verify-cards";

it("every card's key and reference path verifies", () => {
  const report = verifyAllCards();
  for (const f of report.failures) console.error(`MISMATCH ${f.card}: ${f.problem}`);
  console.log(`verify:cards — ${report.hand} hand-written cards, ${report.generated} generated variants, ${report.failures.length} mismatches`);
  expect(report.failures).toEqual([]);
  expect(report.hand).toBeGreaterThanOrEqual(40);
}, 120_000);
