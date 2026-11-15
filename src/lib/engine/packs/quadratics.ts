// Topic pack: factoring and solving quadratics (Module A).
// 6 skills × (1 worked example + 3 easy reps + 1 twist) = 30 hand-written cards, plus
// generators for fresh reps and twists. Every card here is original, and every key and
// reference path is re-verified by `npm run verify:cards`.
import { add, gcd, mul, num, pow, show, v, type Expr } from "../expr/ast";
import { fromPoly, toPoly } from "../expr/poly";
import type { ExprCard, ExprGoal } from "../expr/module";
import type { CardType, MoveInput, Skill, TopicPack } from "../types";

const m = (move: string, params?: Record<string, string | number>, target?: MoveInput["target"]): MoveInput => ({
  move,
  ...(params ? { params: Object.fromEntries(Object.entries(params).map(([k, x]) => [k, String(x)])) } : {}),
  ...(target ? { target } : {}),
});

interface SkillText { insight: string; nudge: string; twistInsight: string; twistNudge: string }
const TEXT: Record<string, SkillText> = {
  "quad.gcf": {
    insight: "Before anything else, pull out what every term shares.",
    nudge: "What number and what power of x appear in every term?",
    twistInsight: "A common factor can be a whole bracket, not just a number or a letter.",
    twistNudge: "Look at the two big pieces. What do they share?",
  },
  "quad.dos": {
    insight: "Two squares with a minus between them: A² − B² = (A − B)(A + B).",
    nudge: "Can you write each term as something squared?",
    twistInsight: "A fourth power is a square of a square, so the pattern can fire twice. A sum of squares stays put.",
    twistNudge: "x⁴ is (x²)². After the first step, look at each bracket again.",
  },
  "quad.tri": {
    insight: "For x² + bx + c, find two numbers with sum b and product c. Signs come from c.",
    nudge: "List factor pairs of the constant term. Which pair adds to the middle coefficient?",
    twistInsight: "Exponents 4, 2, 0 mean a quadratic in disguise: let u = x².",
    twistNudge: "What would this look like if x² were a single letter?",
  },
  "quad.group": {
    insight: "Leading coefficient not 1: split the middle term into two pieces whose product is a·c, then group.",
    nudge: "Multiply the first and last coefficients. Which two numbers multiply to that and add to the middle one?",
    twistInsight: "Four terms? Try grouping straight away. There is nothing to split.",
    twistNudge: "Factor the first two terms and the last two terms separately.",
  },
  "quad.zero": {
    insight: "Factor, then use: if a product is 0, one of the factors is 0.",
    nudge: "Get the left side into factors with 0 on the right.",
    twistInsight: "The zero-product rule only works with 0 on the other side. Get zero first, then factor.",
    twistNudge: "The right side is not 0. What has to happen before you can split the factors?",
  },
  "quad.cts": {
    insight: "Add (b/2)² to make a perfect square, then take both square roots.",
    nudge: "Halve the coefficient of x and square it. What does that complete?",
    twistInsight: "When no whole-number pair works, completing the square still does. The roots just keep a square root.",
    twistNudge: "No pair of integers multiplies to 2 and adds to 6, so don't factor. Move the constant across first.",
  },
};

function card(
  id: string, skill: string, type: CardType, prompt: string, start: string, goal: ExprGoal, path: MoveInput[], keyMoves: string[],
  extra: Partial<ExprCard> = {},
): ExprCard {
  const t = TEXT[skill];
  return {
    id, module: "expr", skill, type, prompt, start, goal, path, keyMoves,
    insight: type === "twist" ? t.twistInsight : t.insight,
    nudge: type === "twist" ? t.twistNudge : t.nudge,
    ...extra,
  };
}
const F = "Factor completely.";
const S = "Solve for x.";
const fac = (final: string): ExprGoal => ({ type: "factored", final });
const sol = (...solutions: (string | number)[]): ExprGoal => ({ type: "solved", solutions: solutions.map(String) });
const P0 = { part: 0 };

const CARDS: ExprCard[] = [
  // ---- 1. common factor ----
  card("quad.gcf.w", "quad.gcf", "worked", F, "6x^2+9x", fac("3x(2x+3)"), [m("gcf", { f: "3x" })], ["gcf"], {
    why: "Both terms contain a 3 and an x, so 3x comes out. What is left in the bracket is always smaller and easier to read.",
  }),
  card("quad.gcf.r1", "quad.gcf", "rep", F, "4x^2+12x", fac("4x(x+3)"), [m("gcf", { f: "4x" })], ["gcf"]),
  card("quad.gcf.r2", "quad.gcf", "rep", F, "5x^3-10x^2", fac("5x^2(x-2)"), [m("gcf", { f: "5x^2" })], ["gcf"]),
  card("quad.gcf.r3", "quad.gcf", "rep", F, "8x^2-12x", fac("4x(2x-3)"), [m("gcf", { f: "4x" })], ["gcf"]),
  card("quad.gcf.t", "quad.gcf", "twist", F, "x(x-4)+3(x-4)", fac("(x-4)(x+3)"), [m("gcf", { f: "x-4" })], ["gcf"]),

  // ---- 2. difference of squares ----
  card("quad.dos.w", "quad.dos", "worked", F, "x^2-25", fac("(x-5)(x+5)"), [m("diff_squares", { A: "x", B: 5 })], ["diff_squares"], {
    why: "x² is a square and 25 is 5². A minus sign between two squares always splits into (A − B)(A + B); the middle terms cancel when you multiply back.",
  }),
  card("quad.dos.r1", "quad.dos", "rep", F, "x^2-49", fac("(x-7)(x+7)"), [m("diff_squares", { A: "x", B: 7 })], ["diff_squares"]),
  card("quad.dos.r2", "quad.dos", "rep", F, "4x^2-9", fac("(2x-3)(2x+3)"), [m("diff_squares", { A: "2x", B: 3 })], ["diff_squares"]),
  card("quad.dos.r3", "quad.dos", "rep", F, "25x^2-4y^2", fac("(5x-2y)(5x+2y)"), [m("diff_squares", { A: "5x", B: "2y" })], ["diff_squares"]),
  card("quad.dos.t", "quad.dos", "twist", F, "x^4-81", fac("(x-3)(x+3)(x^2+9)"),
    [m("diff_squares", { A: "x^2", B: 9 }), m("diff_squares", { A: "x", B: 3 }, P0)], ["diff_squares"]),

  // ---- 3. x² + bx + c ----
  card("quad.tri.w", "quad.tri", "worked", F, "x^2+7x+12", fac("(x+3)(x+4)"), [m("trinomial", { p: 3, q: 4 })], ["trinomial"], {
    why: "(x + p)(x + q) multiplies out to x² + (p + q)x + pq. So you need two numbers that add to 7 and multiply to 12: 3 and 4.",
  }),
  card("quad.tri.r1", "quad.tri", "rep", F, "x^2-5x+6", fac("(x-2)(x-3)"), [m("trinomial", { p: -2, q: -3 })], ["trinomial"]),
  card("quad.tri.r2", "quad.tri", "rep", F, "x^2+2x-15", fac("(x+5)(x-3)"), [m("trinomial", { p: 5, q: -3 })], ["trinomial"]),
  card("quad.tri.r3", "quad.tri", "rep", F, "x^2-x-12", fac("(x-4)(x+3)"), [m("trinomial", { p: -4, q: 3 })], ["trinomial"]),
  card("quad.tri.t", "quad.tri", "twist", F, "x^4-13x^2+36", fac("(x-2)(x+2)(x-3)(x+3)"),
    [m("substitute", { T: "x^2" }), m("trinomial", { p: -4, q: -9 }), m("back_substitute"), m("diff_squares", { A: "x", B: 2 }, P0), m("diff_squares", { A: "x", B: 3 }, { part: 2 })],
    ["substitute"], { timeLimit: 120 }),

  // ---- 4. split the middle term and group ----
  card("quad.group.w", "quad.group", "worked", F, "2x^2+7x+3", fac("(2x+1)(x+3)"), [m("split_middle", { p: 6, q: 1 }), m("group")], ["split_middle"], {
    why: "a·c = 2·3 = 6, and 6 and 1 multiply to 6 and add to 7. Splitting 7x into 6x + x lets each pair share the bracket (x + 3).",
    timeLimit: 45,
  }),
  card("quad.group.r1", "quad.group", "rep", F, "3x^2+10x+8", fac("(3x+4)(x+2)"), [m("split_middle", { p: 6, q: 4 }), m("group")], ["split_middle"], { timeLimit: 45 }),
  card("quad.group.r2", "quad.group", "rep", F, "2x^2-5x-3", fac("(2x+1)(x-3)"), [m("split_middle", { p: -6, q: 1 }), m("group")], ["split_middle"], { timeLimit: 45 }),
  card("quad.group.r3", "quad.group", "rep", F, "6x^2+x-2", fac("(2x-1)(3x+2)"), [m("split_middle", { p: 4, q: -3 }), m("group")], ["split_middle"], { timeLimit: 45 }),
  card("quad.group.t", "quad.group", "twist", F, "x^3+2x^2-9x-18", fac("(x-3)(x+3)(x+2)"), [m("group"), m("diff_squares", { A: "x", B: 3 }, P0)], ["group"]),

  // ---- 5. solve by factoring ----
  card("quad.zero.w", "quad.zero", "worked", S, "x^2-5x+6=0", sol(2, 3), [m("trinomial", { p: -2, q: -3 }), m("zero_product"), m("solve_linear")], ["zero_product"], {
    why: "Once the left side is a product and the right side is 0, one of the factors must be 0. Each factor gives one solution.",
  }),
  card("quad.zero.r1", "quad.zero", "rep", S, "x^2+3x-10=0", sol(-5, 2), [m("trinomial", { p: 5, q: -2 }), m("zero_product"), m("solve_linear")], ["zero_product"], { timeLimit: 45 }),
  card("quad.zero.r2", "quad.zero", "rep", S, "x^2-7x=0", sol(0, 7), [m("gcf", { f: "x" }), m("zero_product"), m("solve_linear")], ["zero_product"], { timeLimit: 45 }),
  card("quad.zero.r3", "quad.zero", "rep", S, "x^2=5x+14", sol(7, -2), [m("to_zero"), m("trinomial", { p: -7, q: 2 }), m("zero_product"), m("solve_linear")], ["zero_product"], { timeLimit: 60 }),
  card("quad.zero.t", "quad.zero", "twist", S, "(x-2)(x+3)=6", sol(-4, 3), [m("to_zero"), m("trinomial", { p: 4, q: -3 }), m("zero_product"), m("solve_linear")], ["to_zero", "add_both"], { timeLimit: 90 }),

  // ---- 6. completing the square ----
  card("quad.cts.w", "quad.cts", "worked", S, "x^2+6x-7=0", sol(1, -7),
    [m("add_both", { t: 7 }), m("add_both", { t: 9 }), m("perfect_square", { A: "x", B: 3 }), m("sqrt_both", { sign: "both" }), m("solve_linear")], ["perfect_square", "complete_square"], {
      why: "Half of 6 is 3, and 3² = 9. Adding 9 to both sides turns x² + 6x into the perfect square (x + 3)². Then both +4 and −4 square to 16, so there are two roots.",
    }),
  card("quad.cts.r1", "quad.cts", "rep", S, "(x-2)^2=9", sol(5, -1), [m("sqrt_both", { sign: "both" }), m("solve_linear")], ["sqrt_both"]),
  card("quad.cts.r2", "quad.cts", "rep", S, "x^2+4x=5", sol(1, -5), [m("add_both", { t: 4 }), m("perfect_square", { A: "x", B: 2 }), m("sqrt_both", { sign: "both" }), m("solve_linear")], ["perfect_square", "complete_square"], { timeLimit: 75 }),
  card("quad.cts.r3", "quad.cts", "rep", "Write in the form (x + h)² + k.", "x^2+6x+11", { type: "form", final: "(x+3)^2+2" }, [m("complete_square", { h: 3, k: 2 })], ["complete_square"]),
  card("quad.cts.t", "quad.cts", "twist", S, "x^2+6x+2=0", sol("-3+sqrt(7)", "-3-sqrt(7)"),
    [m("add_both", { t: -2 }), m("add_both", { t: 9 }), m("perfect_square", { A: "x", B: 3 }), m("sqrt_both", { sign: "both" }), m("solve_linear")], ["perfect_square", "complete_square"], { timeLimit: 150 }),
];

const skill = (id: string, title: string, blurb: string, prereqs: string[]): Skill => ({
  id, title, blurb, prereqs, worked: `${id}.w`, reps: [`${id}.r1`, `${id}.r2`, `${id}.r3`], twist: `${id}.t`,
});
const SKILLS: Skill[] = [
  skill("quad.gcf", "Common factor", "Pull out what every term shares.", []),
  skill("quad.dos", "Difference of squares", "A² − B² = (A − B)(A + B).", ["quad.gcf"]),
  skill("quad.tri", "Sum and product", "Factor x² + bx + c.", ["quad.gcf", "quad.dos"]),
  skill("quad.group", "Split and group", "Factor ax² + bx + c when a ≠ 1.", ["quad.tri"]),
  skill("quad.zero", "Solve by factoring", "Zero-product rule.", ["quad.tri"]),
  skill("quad.cts", "Complete the square", "Solve when factoring fails.", ["quad.zero"]),
];

// ---- generators ---------------------------------------------------------------
// Problems are built backwards from their answer (pick the factors or roots, multiply
// out), so the key is right by construction; the registry still replays every generated
// card through the verifier before it is shown.
export function rng(seed: number) {
  let a = (seed >>> 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type R = () => number;
const pick = (r: R, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r: R, lo: number, hi: number) => {
  let x = 0;
  while (x === 0) x = pick(r, lo, hi);
  return x;
};
const x = v("x");
const lin = (a: number, b: number): Expr => add([a === 1 ? x : mul([num(a), x], true), num(b)], true);
const expanded = (e: Expr) => show(fromPoly(toPoly(e)));

function generate(skillId: string, type: "rep" | "twist", seed: number): ExprCard {
  const r = rng(seed * 7919 + skillId.length * 104729 + (type === "twist" ? 31337 : 0));
  const id = `${skillId}~${type}~${seed}`;
  const make = (prompt: string, start: string, goal: ExprGoal, path: MoveInput[], keyMoves: string[], timeLimit?: number) =>
    card(id, skillId, type, prompt, start, goal, path, keyMoves, { generated: true, ...(timeLimit ? { timeLimit } : {}) });

  switch (`${skillId}/${type}`) {
    case "quad.gcf/rep": {
      const c = pick(r, 2, 6);
      const e = pick(r, 1, 2);
      let p = 1, q = 1;
      do { p = pick(r, 1, 5); q = nz(r, -7, 7); } while (gcd(p, q) !== 1);
      const f = mul([num(c), pow(x, e)], true);
      const inner = lin(p, q);
      return make(F, expanded(mul([f, inner], true)), fac(show(mul([f, inner], true))), [m("gcf", { f: show(f) })], ["gcf"]);
    }
    case "quad.gcf/twist": {
      const a = nz(r, -9, 9);
      let b = nz(r, -9, 9);
      if (b === 1) b = 2;
      const A = lin(1, a);
      const start = add([mul([x, A], true), mul([num(b), A], true)], true);
      return make(F, show(start), fac(show(mul([A, lin(1, b)], true))), [m("gcf", { f: show(A) })], ["gcf"]);
    }
    case "quad.dos/rep": {
      let a = 1, b = 1;
      do { a = pick(r, 1, 5); b = pick(r, 1, 9); } while (gcd(a, b) !== 1);
      const A = a === 1 ? "x" : `${a}x`;
      return make(F, `${a === 1 ? "" : a * a}x^2-${b * b}`, fac(`(${A}-${b})(${A}+${b})`), [m("diff_squares", { A, B: b })], ["diff_squares"]);
    }
    case "quad.dos/twist": {
      const k = pick(r, 2, 5);
      return make(F, `x^4-${k ** 4}`, fac(`(x-${k})(x+${k})(x^2+${k * k})`), [m("diff_squares", { A: "x^2", B: k * k }), m("diff_squares", { A: "x", B: k }, P0)], ["diff_squares"]);
    }
    case "quad.tri/rep": {
      let p = 1, q = 1;
      do { p = nz(r, -9, 9); q = nz(r, -9, 9); } while (p + q === 0);
      const final = mul([lin(1, p), lin(1, q)], true);
      return make(F, expanded(final), fac(show(final)), [m("trinomial", { p, q })], ["trinomial"]);
    }
    case "quad.tri/twist": {
      const a = pick(r, 1, 4);
      const b = pick(r, a + 1, 5);
      return make(F, `x^4-${a * a + b * b}x^2+${a * a * b * b}`, fac(`(x-${a})(x+${a})(x-${b})(x+${b})`),
        [m("substitute", { T: "x^2" }), m("trinomial", { p: -a * a, q: -b * b }), m("back_substitute"), m("diff_squares", { A: "x", B: a }, P0), m("diff_squares", { A: "x", B: b }, { part: 2 })],
        ["substitute"], 120);
    }
    case "quad.group/rep": {
      let a = 2, b = 1, c = 1, d = 1;
      do { a = pick(r, 2, 3); c = pick(r, 1, 2); b = nz(r, -5, 5); d = nz(r, -5, 5); } while (gcd(a, b) !== 1 || gcd(c, d) !== 1 || a * d + b * c === 0);
      const final = mul([lin(a, b), lin(c, d)], true);
      return make(F, expanded(final), fac(show(final)), [m("split_middle", { p: a * d, q: b * c }), m("group")], ["split_middle"], 45);
    }
    case "quad.group/twist": {
      const a = nz(r, -5, 5);
      const b = pick(r, 2, 5);
      const start = mul([add([pow(x, 2), num(-b * b)], true), lin(1, a)], true);
      return make(F, expanded(start), fac(show(mul([lin(1, -b), lin(1, b), lin(1, a)], true))), [m("group"), m("diff_squares", { A: "x", B: b }, P0)], ["group"]);
    }
    case "quad.zero/rep": {
      let p = 1, q = 1;
      do { p = nz(r, -9, 9); q = nz(r, -9, 9); } while (p === q || p + q === 0);
      return make(S, `${expanded(mul([lin(1, -p), lin(1, -q)], true))} = 0`, sol(p, q), [m("trinomial", { p: -p, q: -q }), m("zero_product"), m("solve_linear")], ["zero_product"], 45);
    }
    case "quad.zero/twist": {
      let p = 1, q = 1, a = 1, b = 0, c = 0;
      do {
        p = nz(r, -7, 7); q = nz(r, -7, 7); a = nz(r, -6, 6);
        b = a - (p + q);
        c = -a * b - p * q;
      } while (p === q || p + q === 0 || b === 0 || c === 0);
      return make(S, `${show(mul([lin(1, -a), lin(1, b)], true))} = ${show(num(c))}`, sol(p, q),
        [m("to_zero"), m("trinomial", { p: -p, q: -q }), m("zero_product"), m("solve_linear")], ["to_zero", "add_both"], 90);
    }
    case "quad.cts/rep": {
      const h = nz(r, -6, 6);
      const s = pick(r, 1, 7);
      const lhs = add([pow(x, 2), mul([num(2 * h), x], true)], true);
      return make(S, `${show(lhs)} = ${show(num(s * s - h * h))}`, sol(-h + s, -h - s),
        [m("add_both", { t: h * h }), m("perfect_square", { A: "x", B: h }), m("sqrt_both", { sign: "both" }), m("solve_linear")], ["perfect_square", "complete_square"], 75);
    }
    case "quad.cts/twist": {
      let h = 1, k = 2;
      do { h = nz(r, -5, 5); k = [2, 3, 5, 6, 7, 10, 11][pick(r, 0, 6)]; } while (h * h === k);
      const c = h * h - k;
      const lhs = add([pow(x, 2), mul([num(2 * h), x], true), num(c)], true);
      return make(S, `${show(lhs)} = 0`, sol(`${-h}+sqrt(${k})`, `${-h}-sqrt(${k})`),
        [m("add_both", { t: -c }), m("add_both", { t: h * h }), m("perfect_square", { A: "x", B: h }), m("sqrt_both", { sign: "both" }), m("solve_linear")], ["perfect_square", "complete_square"], 150);
    }
  }
  throw new Error(`No generator for ${skillId}/${type}`);
}

export const quadratics: TopicPack<ExprCard> = {
  id: "quad",
  title: "Factoring and quadratics",
  module: "expr",
  topic: "algebra",
  skills: SKILLS,
  cards: CARDS,
  generate,
};
