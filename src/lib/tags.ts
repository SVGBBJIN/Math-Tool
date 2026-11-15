// Controlled vocabularies so twins and mastery stats line up.

export const TOPICS = [
  "algebra",
  "counting_probability",
  "geometry",
  "number_theory",
  "logic_misc",
] as const;

export const TECHNIQUES = [
  "casework",
  "complementary_counting",
  "symmetry",
  "invariants",
  "modular_arithmetic",
  "prime_factorization",
  "divisibility",
  "similar_triangles",
  "coordinates",
  "pythagorean",
  "area_ratios",
  "angle_chasing",
  "circle_theorems",
  "three_d_geometry",
  "vieta",
  "factoring",
  "systems_of_equations",
  "sequences_series",
  "working_backwards",
  "small_cases_pattern",
  "stars_and_bars",
  "pigeonhole",
  "recursion",
  "ratios_rates",
  "bounding_inequalities",
  "expected_value",
  "exponents_logs",
  "digits_place_value",
  "functions",
  "estimation",
  "direct_counting",
  "conditional_probability",
] as const;

export const ERROR_TYPES = [
  { value: "concept_gap", label: "Concept gap" },
  { value: "no_approach", label: "Didn't see the approach" },
  { value: "setup_error", label: "Setup error" },
  // Stored as "careless" since M1; shown as an arithmetic slip.
  { value: "careless", label: "Arithmetic slip" },
  { value: "misread", label: "Misread" },
  { value: "out_of_time", label: "Ran out of time" },
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number]["value"];

export function label(tag: string): string {
  return tag.replace(/_/g, " ");
}

export function normalizeTags(input: string, allowed?: readonly string[]): string[] {
  const tags = input
    .split(/[;,]/)
    .map((t) => t.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean);
  const unique = [...new Set(tags)];
  if (allowed) {
    const bad = unique.filter((t) => !allowed.includes(t));
    if (bad.length) throw new Error(`Unknown tag(s): ${bad.join(", ")}`);
  }
  return unique;
}
