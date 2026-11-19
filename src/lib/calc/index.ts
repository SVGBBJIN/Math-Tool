// The step-by-step calculator: every tool, grouped by domain. Pure logic; the popup UI is
// src/components/calculator/CalculatorPopup.tsx.
import { ALGEBRA_TOOLS } from "./algebra";
import { ARITHMETIC_TOOLS } from "./arithmetic";
import { COUNTING_TOOLS } from "./counting";
import { CalcError, DOMAINS, type CalcResult, type Tool } from "./core";
import { NUMBER_THEORY_TOOLS } from "./number-theory";

export { CalcError, DOMAINS };
export type { CalcResult, Tool };
export type { Domain, Field, Step } from "./core";

export const TOOLS: Tool[] = [...ARITHMETIC_TOOLS, ...NUMBER_THEORY_TOOLS, ...COUNTING_TOOLS, ...ALGEBRA_TOOLS];

export const getTool = (id: string) => TOOLS.find((t) => t.id === id);

/** Run a tool. Input problems come back as { error }, never as a thrown exception. */
export function runTool(tool: Tool, values: Record<string, string>): { result: CalcResult } | { error: string } {
  try {
    return { result: tool.run(values) };
  } catch (e) {
    if (e instanceof CalcError) return { error: e.message };
    console.error(e);
    return { error: "Something went wrong with that input. Check it and try again." };
  }
}
