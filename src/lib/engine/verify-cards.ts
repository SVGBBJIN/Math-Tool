// Re-verifies every card's key and reference path. Run by `npm run verify:cards`, which
// `npm run build` calls first, so a wrong key fails the build.
//
// Two layers, on purpose:
//   1. the reference path is replayed through the same verifier the student uses;
//   2. the key is checked again by an INDEPENDENT method that shares no code with that
//      verifier: exact polynomial identities and exact root tests for Module A, plain
//      brute-force enumeration of the full-size problem for Module B.
import { evaluate, gcd, parseExpr, varsOf, type Expr } from "./expr/ast";
import type { ExprCard } from "./expr/module";
import { coeffs, fAdd, fMul, fr, fVal, pEq, pMul, pConst, pSub, pVars, pDegree, squareFree, toPoly, type Frac, type Poly } from "./expr/poly";
import { parseState } from "./expr/state";
import { runTerm, structModule, template, type StructCard, type StructState } from "./struct/module";
import { PACKS, replay, type Card } from "./registry";

export interface Failure { card: string; problem: string }
export interface Report { hand: number; generated: number; failures: Failure[] }

const FUZZ_SEEDS = 40;
/** User-facing text must not name real contests, years or problem numbers. */
const BANNED = /\b(AMC|AIME|MAA|MATHCOUNTS|USAMO|USAJMO|olympiad)\b|\b(19|20)\d\d\b|#\s*\d+/i;

// ---- Module A: exact, symbolic checks ----------------------------------------------
function factorsOf(e: Expr): Expr[] {
  if (e.k === "mul") return e.factors.flatMap(factorsOf);
  if (e.k === "pow") return factorsOf(e.base);
  if (e.k === "neg") return factorsOf(e.arg);
  return varsOf(e).size ? [e] : [];
}
const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
/** Irreducible over the rationals, with no common integer factor left inside. */
function irreducible(f: Expr): string | null {
  const p = toPoly(f);
  const cs = [...p.values()];
  if (cs.some((c) => c.d !== 1)) return "has fractional coefficients";
  if (cs.reduce((g, c) => gcd(g, c.n), 0) !== 1) return "still has a common numeric factor";
  const deg = pDegree(p);
  if (deg === 1) return null;
  const names = pVars(p);
  if (names.length !== 1) return "has degree above 1 in several variables";
  const c = coeffs(p, names[0])!;
  if (deg === 2) {
    const disc = fAdd(fMul(c[1], c[1]), fMul(fr(-4), fMul(c[2], c[0])));
    return isSquare(disc.n) && isSquare(disc.d) ? "is a quadratic that still factors" : null;
  }
  return "has degree above 2";
}
const horner = (c: Frac[], x: Frac) => c.reduceRight((acc, k) => fAdd(fMul(acc, x), k), fr(0));
/** Every rational root p/q with |p| ≤ 80, q ≤ 8, found by exact substitution. */
function rationalRoots(c: Frac[]): number[] {
  const out = new Set<number>();
  for (let q = 1; q <= 8; q++) for (let p = -80 * q; p <= 80 * q; p++) if (gcd(p, q) === 1 && horner(c, fr(p, q)).n === 0) out.add(p / q);
  return [...out];
}
/** Number of distinct real roots: sign changes of the square-free part on a fine grid. */
function realRootCount(c: Frac[]): number {
  const sf = squareFree(c).map(fVal);
  const f = (x: number) => sf.reduceRight((acc, k) => acc * x + k, 0);
  let count = 0;
  let prev = f(-300.0037);
  for (let x = -300; x <= 300; x += 0.005) {
    const y = f(x + 0.0013);
    if (y === 0 || prev * y < 0) count++;
    prev = y;
  }
  return count;
}

function checkExprKey(card: ExprCard): string[] {
  const out: string[] = [];
  const start = parseState(card.start);
  const g = card.goal;
  if (g.type === "factored" || g.type === "form") {
    if (start.kind !== "expr") return ["start is not an expression"];
    const final = parseExpr(g.final);
    if (!pEq(toPoly(start.expr), toPoly(final))) out.push(`key ${g.final} does not multiply out to the starting expression`);
    if (g.type === "factored") for (const f of factorsOf(final)) {
      const why = irreducible(f);
      if (why) out.push(`key is not fully factored: a factor ${why}`);
    }
  } else if (g.type === "solved") {
    if (start.kind !== "eqs") return ["start is not an equation"];
    const P: Poly = start.eqs.map((e) => pSub(toPoly(e.lhs), toPoly(e.rhs))).reduce(pMul, pConst(fr(1)));
    const names = pVars(P);
    const c = names.length === 1 ? coeffs(P, names[0]) : null;
    if (!c) return ["equation is not a one-variable polynomial"];
    const key = g.solutions.map((s) => evaluate(parseExpr(s), {}));
    const f = (x: number) => c.map(fVal).reduceRight((acc, k) => acc * x + k, 0);
    for (const [i, x] of key.entries()) if (Math.abs(f(x)) > 1e-8) out.push(`key value ${g.solutions[i]} does not satisfy the equation`);
    if (new Set(key.map((x) => x.toFixed(9))).size !== key.length) out.push("key lists a solution twice");
    if (realRootCount(c) !== key.length) out.push(`equation has ${realRootCount(c)} real solutions but the key lists ${key.length}`);
    for (const r of rationalRoots(c)) if (!key.some((x) => Math.abs(x - r) < 1e-9)) out.push(`rational solution ${r} is missing from the key`);
  }
  return out;
}

// ---- Module B: brute force on the full-size problem ------------------------------------
function checkStructKey(card: StructCard): string[] {
  const out: string[] = [];
  const t = template(card.template);
  for (const [name, p] of [["full", card.full], ["scaled-down", card.small]] as const) {
    const all = t.universe(p);
    if (new Set(all).size !== all.length) out.push(`${name} brute force lists an outcome twice`);
  }
  const full = t.universe(card.full).length;
  if (full !== card.answer) out.push(`brute force of the full problem gives ${full}, key says ${card.answer}`);
  if (String(card.small.items).length > String(card.full.items).length) out.push("scaled-down version is larger than the real one");
  for (const key of ["k", "kind", "special", "leader"]) if (card.small[key] !== card.full[key]) out.push(`scaled-down version changes "${key}", so slots no longer play the same roles`);

  // The reference structure, enumerated on the FULL problem too: every valid outcome exactly once.
  let state: StructState = structModule.init(card);
  for (const step of card.path) {
    if (step.move === "check") break;
    const r = structModule.apply(card, state, step);
    if (r.ok) state = r.state;
  }
  const total = new Map<string, number>();
  for (const term of state.terms) {
    const run = runTerm(t, term, card.full);
    if (run.uneven) out.push(`slot "${run.uneven.slot.id}" shows ${run.uneven.expected} options but offers ${run.uneven.got} on the full problem`);
    const d = term.div ? t.divisors.find((x) => x.id === term.div)!.value(card.full) : 1;
    for (const [key, m] of run.mult) total.set(key, (total.get(key) ?? 0) + (term.sign * m) / d);
  }
  const valid = new Set(t.universe(card.full));
  for (const [key, c] of total) if (Math.abs(c - (valid.has(key) ? 1 : 0)) > 1e-9) out.push(`reference structure counts ${t.show(key, card.full)} ${c} times on the full problem`);
  for (const key of valid) if (!total.has(key)) out.push(`reference structure misses ${t.show(key, card.full)} on the full problem`);
  return out;
}

export function checkCard(card: Card): string[] {
  const out: string[] = [];
  const r = replay(card);
  if (!r.ok) out.push(`reference path: ${r.error}`);
  if (!card.path.some((s) => card.keyMoves.includes(s.move))) out.push("the reference path never uses the key move");
  for (const text of [card.prompt, card.insight, card.nudge, card.why ?? ""]) if (BANNED.test(text)) out.push(`user-facing text names a real contest, year or problem number: "${text.slice(0, 50)}"`);
  try {
    out.push(...(card.module === "expr" ? checkExprKey(card) : checkStructKey(card)));
  } catch (e) {
    out.push(`independent check crashed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return out;
}

export function verifyAllCards(fuzzSeeds = FUZZ_SEEDS): Report {
  const failures: Failure[] = [];
  const note = (card: string, problems: string[]) => problems.forEach((problem) => failures.push({ card, problem }));
  let hand = 0;
  let generated = 0;
  const ids = new Set<string>();
  for (const pack of PACKS) {
    for (const card of pack.cards) {
      hand++;
      if (ids.has(card.id)) note(card.id, ["duplicate card id"]);
      ids.add(card.id);
      note(card.id, checkCard(card));
    }
    const order = pack.skills.map((s) => s.id);
    for (const skill of pack.skills) {
      const want: [string, string][] = [[skill.worked, "worked"], ...skill.reps.map((id): [string, string] => [id, "rep"]), [skill.twist, "twist"]];
      for (const [id, type] of want) {
        const card = pack.cards.find((c) => c.id === id);
        if (!card) note(skill.id, [`missing card ${id}`]);
        else if (card.type !== type || card.skill !== skill.id) note(id, [`should be a ${type} card of ${skill.id}`]);
      }
      if (!pack.cards.find((c) => c.id === skill.worked)?.why) note(skill.worked, ["worked example has no explanation"]);
      for (const pre of skill.prereqs) if (!order.includes(pre) || order.indexOf(pre) >= order.indexOf(skill.id)) note(skill.id, [`prerequisite ${pre} must come earlier in the pack`]);
      for (const type of ["rep", "twist"] as const) for (let seed = 1; seed <= fuzzSeeds; seed++) {
        generated++;
        try {
          const card = pack.generate(skill.id, type, seed);
          const handKeys = pack.cards.filter((c) => c.skill === skill.id && c.type === type).map((c) => c.keyMoves.join());
          if (!handKeys.includes(card.keyMoves.join())) note(card.id, ["generated card practises a different key move than the hand-written ones"]);
          note(card.id, checkCard(card as Card));
        } catch (e) {
          note(`${skill.id}~${type}~${seed}`, [`generator crashed: ${e instanceof Error ? e.message : String(e)}`]);
        }
      }
    }
  }
  return { hand, generated, failures };
}
