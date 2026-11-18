// The Daily Problem bank: original contest-style problems, each broken into the small steps
// a tutor would ask. Families generate fresh numbers, so a problem can come back without
// repeating. Every number here is recomputed independently in ./verifiers.ts.
import type { Figure } from "../cards/types";
import { amc, choice, frac, num, opt, problem, problemFamily, step, tex } from "./author";
import type { Problem, ProblemFamily } from "./types";

const C2 = (n: number) => (n * (n - 1)) / 2;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Right triangle (vertical leg a, horizontal leg b) with the right angle at the bottom left, scaled to fit. */
function rightTriangle(a: number, b: number, alt: string, inradius?: number): Figure {
  const k = Math.min(200 / b, 130 / a);
  const [C, B, A]: [number, number][] = [[40, 160], [40 + b * k, 160], [40, 160 - a * k]];
  return {
    w: 280, h: 190, alt,
    items: [
      { t: "poly", pts: [C, B, A], fill: "tint" },
      { t: "angle", at: C, p: B, q: A, r: 14, square: true },
      { t: "label", at: [26, 160 - (a * k) / 2], text: String(a), tone: "muted" },
      { t: "label", at: [40 + (b * k) / 2, 178], text: String(b), tone: "muted" },
      ...(inradius ? [{ t: "circle" as const, c: [40 + inradius * k, 160 - inradius * k] as [number, number], r: inradius * k }] : []),
    ],
  };
}

const TRIPLES: [number, number, number][] = [[6, 8, 10], [9, 12, 15], [12, 16, 20], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 35, 37], [15, 20, 25]];

export const PROBLEMS: Problem[] = [
  // ================================================================ algebra
  problem("tickets", "alg", 2, {
    title: "Tickets at the school play",
    statement: "A school play sold adult tickets for 9 dollars each and student tickets for 5 dollars each. It sold 140 tickets in all and took in 940 dollars. How many adult tickets were sold?",
    part: 1,
    steps: [
      step("Start with a guess that is easy to work out: suppose all 140 tickets were student tickets. How many dollars would that bring in?",
        num(700, [[1260, "That is what 140 **adult** tickets would bring in. Start from the cheaper ticket."]]),
        "140 tickets at 5 dollars each.",
        "$140 \\times 5 = 700$ dollars."),
      step("Now swap one student ticket for an adult ticket. By how many dollars does the total go up?",
        num(4, [[9, "You gain a 9-dollar ticket, but you also lose a 5-dollar one."]]),
        "You gain one adult ticket and lose one student ticket.",
        "Each swap adds $9 - 5 = 4$ dollars."),
      step("The real total is 940 dollars. How many dollars short of that is the all-student guess?",
        num(240),
        "Subtract the guess from the real total.",
        "$940 - 700 = 240$ dollars."),
      step("So how many adult tickets were sold?",
        amc(60, [40, 50, 80, 100]),
        "Each swap closes 4 dollars of the 240-dollar gap.",
        "$240 \\div 4 = 60$ swaps, so 60 adult tickets and 80 student tickets. Check: $60 \\cdot 9 + 80 \\cdot 5 = 540 + 400 = 940$."),
    ],
    takeaway: "Guess that everything is the cheaper kind, then count how many swaps close the gap.",
  }),
  problem("work", "alg", 3, {
    title: "Painting the fence",
    statement: "Working together, Ava and Ben can paint a fence in 4 hours. Ben, working alone, takes 6 hours. How many hours would Ava take working alone?",
    part: 2,
    steps: [
      step("Think in rates. What fraction of the fence do Ava and Ben paint together in one hour?",
        num("1/4", [[4, "4 is hours per fence. Flip it to get fences per hour."]]),
        "4 hours for one fence means how much fence per hour?",
        "One fence in 4 hours is $\\frac{1}{4}$ of the fence per hour."),
      step("What fraction of the fence does Ben paint alone in one hour?",
        num("1/6"),
        "Same idea: one fence in 6 hours.",
        "Ben paints $\\frac{1}{6}$ of the fence per hour."),
      step("Rates add when people work together. What fraction of the fence does Ava paint in one hour?",
        num("1/12", [["1/2", "That is $\\frac{1}{6 - 4}$. Hours don't subtract; rates do."], ["5/12", "That adds the rates. Ava's rate is what is left after Ben's."]]),
        "Together rate minus Ben's rate.",
        "$\\frac{1}{4} - \\frac{1}{6} = \\frac{3}{12} - \\frac{2}{12} = \\frac{1}{12}$ of the fence per hour."),
      step("How many hours would Ava take alone?",
        amc(12, [2, 5, 10, 24]),
        "If she paints $\\frac{1}{12}$ of it each hour…",
        "At $\\frac{1}{12}$ of a fence per hour she needs 12 hours. Check: $\\frac{1}{12} + \\frac{1}{6} = \\frac{1}{4}$."),
    ],
    takeaway: "Work problems: add and subtract rates (jobs per hour), never the hours themselves.",
  }),
  problem("squares", "alg", 3, {
    title: "Sum and sum of squares",
    statement: "Two numbers have a sum of 30, and the sum of their squares is 468. What is their product?",
    part: 2,
    steps: [
      step("Which identity connects the sum, the sum of squares and the product?",
        choice("a", [
          opt("a", "$(x + y)^2 = x^2 + 2xy + y^2$", "Yes: it holds the sum, the squares and the product all at once."),
          opt("b", "$(x + y)^2 = x^2 + y^2$", "That drops the middle term $2xy$, and the middle term is exactly what we want."),
          opt("c", "$x^2 - y^2 = (x - y)(x + y)$", "That is for a **difference** of squares. Here we know a sum."),
        ]),
        "You know $x + y$ and $x^2 + y^2$, and you want $xy$.",
        "$(x + y)^2 = x^2 + 2xy + y^2$ contains all three quantities."),
      step("What is $(x + y)^2$?",
        num(900, [[60, "That is $2 \\cdot 30$. Squaring means $30 \\cdot 30$."]]),
        "Square the sum.",
        "$(x + y)^2 = 30^2 = 900$."),
      step("So $900 = 468 + 2xy$. What is $2xy$?",
        num(432),
        "Subtract the sum of squares from 900.",
        "$2xy = 900 - 468 = 432$."),
      step("What is the product $xy$?",
        amc(216, [162, 196, 234, 432]),
        "Halve $2xy$.",
        "$xy = 432 \\div 2 = 216$. (The numbers are 12 and 18: $144 + 324 = 468$.)"),
    ],
    takeaway: "Know the sum and the sum of squares? Square the sum: the product falls out of the middle term.",
  }),

  // ================================================================ number theory
  problem("remainder", "nt", 3, {
    title: "Remainder 2, four times",
    statement: "What is the smallest positive integer that leaves a remainder of 2 when divided by each of 3, 4, 5 and 6, and is also divisible by 7?",
    part: 1,
    steps: [
      step("If $N$ leaves remainder 2 on division by 3, 4, 5 and 6, then $N - 2$ is a multiple of all four. What is the smallest positive common multiple of 3, 4, 5 and 6?",
        num(60, [[360, "$3 \\cdot 4 \\cdot 5 \\cdot 6 = 360$ is a common multiple, but not the least: 3 and 6 (and 4 and 6) share factors."]]),
        "Find the least common multiple: $4 = 2^2$, $6 = 2 \\cdot 3$.",
        "$\\text{lcm}(3, 4, 5, 6) = 2^2 \\cdot 3 \\cdot 5 = 60$."),
      step("So $N = 60k + 2$ for some whole number $k$. What is the smallest $k$ that makes $60k + 2$ divisible by 7?",
        num(3, [[5, "Check it: $60 \\cdot 5 + 2 = 302 = 7 \\cdot 43 + 1$. Not divisible by 7."]]),
        "$60 = 56 + 4$, so $60k + 2$ has the same remainder mod 7 as $4k + 2$. Try $k = 1, 2, 3$.",
        "$4k + 2$ is 6, 10, 14 for $k = 1, 2, 3$, and 14 is the first multiple of 7. So $k = 3$."),
      step("What is $N$?",
        amc(182, [62, 122, 242, 422]),
        "Put $k$ back into $60k + 2$.",
        "$N = 60 \\cdot 3 + 2 = 182 = 7 \\cdot 26$."),
    ],
    takeaway: "Same remainder for several divisors? Subtract it, and you're looking at multiples of the LCM.",
  }),
  problem("gcdlcm", "nt", 4, {
    title: "GCD 6, LCM 180",
    statement: "Positive integers $a < b$ have greatest common divisor 6 and least common multiple 180. What is the smallest possible value of $a + b$?",
    part: 0,
    steps: [
      step("Write $a = 6x$ and $b = 6y$, where $x$ and $y$ have no common factor. Then the LCM is $6xy$. What is $xy$?",
        num(30, [[180, "180 is the LCM itself, which is $6xy$. Divide by 6."]]),
        "$6xy = 180$.",
        "$6xy = 180$, so $xy = 30$."),
      step("How many pairs $x < y$ multiply to 30 and share no common factor?",
        num(4),
        "List factor pairs of 30. Since $30 = 2 \\cdot 3 \\cdot 5$ has no repeated prime, every pair works.",
        "$(1, 30)$, $(2, 15)$, $(3, 10)$, $(5, 6)$: four pairs, and none shares a factor."),
      step("Which pair has the smallest sum $x + y$? Enter that sum.",
        num(11),
        "Pairs that are closest together have the smallest sum.",
        "The sums are 31, 17, 13 and 11. The smallest is $5 + 6 = 11$."),
      step("What is the smallest possible $a + b$?",
        amc(66, [36, 60, 78, 186]),
        "$a + b = 6(x + y)$.",
        "$a + b = 6 \\cdot 11 = 66$, from $a = 30$ and $b = 36$: gcd 6 and lcm 180."),
    ],
    takeaway: "Pull out the GCD: a = gx, b = gy with x, y coprime, and the LCM is gxy.",
  }),

  // ================================================================ counting and probability
  problem("dice", "cp", 2, {
    title: "At least one 6",
    statement: "Three fair six-sided dice are rolled. What is the probability that at least one of them shows a 6?",
    part: 2,
    steps: [
      step("What is the cleanest way in?",
        choice("a", [
          opt("a", "Count the outcomes with no 6 at all, and subtract", "Yes. \"At least one\" is the opposite of \"none\", and none is one simple count."),
          opt("b", "Add the chances of exactly one, two and three 6s", "That works, but it is three separate counts. The opposite event is one count."),
          opt("c", "Add $\\frac{1}{6}$ three times", "That counts a roll with two or three 6s more than once."),
        ]),
        "\"At least one\" usually means: look at the opposite.",
        "The opposite of \"at least one 6\" is \"no 6s\", which is easy to count."),
      step("How many equally likely outcomes are there in all?",
        num(216, [[18, "That adds 6 three times. Each die multiplies the count by 6."]]),
        "Each die has 6 faces, independently.",
        "$6 \\cdot 6 \\cdot 6 = 216$."),
      step("How many outcomes show no 6 on any die?",
        num(125, [[15, "That adds 5 three times. Multiply: each die has 5 allowed faces."]]),
        "Each die can show 1 to 5.",
        "$5 \\cdot 5 \\cdot 5 = 125$."),
      step("What is the probability of at least one 6?",
        amc("91/216", ["1/216", "25/72", "1/2", "125/216"]),
        "Subtract the \"no 6\" outcomes from all outcomes.",
        "$216 - 125 = 91$ outcomes have at least one 6, so the probability is $\\frac{91}{216}$."),
    ],
    takeaway: "\"At least one\": count the opposite (none), then subtract from the total.",
  }),
  problem("banana", "cp", 3, {
    title: "Keep the N's apart",
    statement: "In how many ways can the letters of BANANA be arranged so that the two N's are not next to each other?",
    part: 1,
    steps: [
      step("Set the N's aside. How many different arrangements of B, A, A, A are there?",
        num(4, [[24, "$4! = 24$ treats the three A's as different. Swapping two A's changes nothing."]]),
        "Only the position of B matters.",
        "B can go in any of 4 places, and the A's fill the rest: 4 arrangements."),
      step("In an arrangement like _B_A_A_A_, how many gaps (counting both ends) could hold an N?",
        num(5, [[3, "Count the ends too: before the first letter and after the last."]]),
        "4 letters make gaps between them and at both ends.",
        "4 letters leave $4 + 1 = 5$ gaps."),
      step("The two N's go into two different gaps, so they can't touch. How many ways are there to choose 2 of the 5 gaps?",
        num(10, [[20, "$5 \\cdot 4 = 20$ counts each pair twice. The N's are identical, so order doesn't matter."], [25, "Both N's in the same gap would put them next to each other."]]),
        "Choose 2 gaps out of 5, order not mattering.",
        "$\\binom{5}{2} = 10$."),
      step("How many arrangements keep the N's apart?",
        amc(40, [20, 30, 50, 60]),
        "Multiply: arrangements of the other letters times ways to place the N's.",
        "$4 \\cdot 10 = 40$. (Check: all $\\frac{6!}{3! \\cdot 2!} = 60$ arrangements, minus 20 with NN together, is 40.)"),
    ],
    takeaway: "To keep letters apart: arrange the others first, then drop them into the gaps.",
  }),

  // ================================================================ geometry
  problem("boxarea", "geo", 3, {
    title: "Box it in",
    statement: "A quadrilateral has vertices $(0, 0)$, $(6, 0)$, $(8, 5)$ and $(1, 7)$. What is its area?",
    figure: {
      w: 260, h: 230, alt: "A grid from 0 to 8 across and 0 to 7 up. A quadrilateral joins (0,0), (6,0), (8,5) and (1,7), and a dashed rectangle from (0,0) to (8,7) encloses it.",
      items: [
        { t: "poly", pts: [[30, 200], [222, 200], [222, 25], [30, 25]] },
        { t: "line", a: [30, 25], b: [222, 25], dash: true },
        { t: "poly", pts: [[30, 200], [174, 200], [222, 75], [54, 25]], fill: "accent" },
        { t: "label", at: [22, 214], text: "(0,0)", tone: "muted" }, { t: "label", at: [174, 214], text: "(6,0)", tone: "muted" },
        { t: "label", at: [238, 75], text: "(8,5)", tone: "muted" }, { t: "label", at: [54, 14], text: "(1,7)", tone: "muted" },
      ],
    },
    part: 1,
    steps: [
      step("Draw the smallest rectangle around the shape with sides on grid lines. What is the rectangle's area?",
        num(56),
        "The shape reaches from $x = 0$ to $x = 8$ and from $y = 0$ to $y = 7$.",
        "The rectangle is $8 \\times 7$, so its area is 56."),
      step("Three right triangles lie inside the rectangle but outside the quadrilateral. What is their total area?",
        num("31/2", [[15, "Close: the left triangle is $\\frac{1 \\cdot 7}{2} = 3.5$, not 3."]]),
        "The corners cut off are at the lower right, the upper right and the left side. Each is half of a small rectangle.",
        "Lower right $(6,0), (8,0), (8,5)$: $\\frac{2 \\cdot 5}{2} = 5$. Upper right $(8,5), (8,7), (1,7)$: $\\frac{7 \\cdot 2}{2} = 7$. Left $(0,0), (0,7), (1,7)$: $\\frac{1 \\cdot 7}{2} = 3.5$. Total $15.5$."),
      step("What is the area of the quadrilateral?",
        amc("81/2", [38, 39, 41, 42]),
        "Rectangle minus the corner triangles.",
        "$56 - 15.5 = 40.5 = \\frac{81}{2}$."),
    ],
    takeaway: "Awkward polygon on a grid? Box it in a rectangle and subtract the right-triangle corners.",
  }),
  problem("polygon", "geo", 2, {
    title: "Diagonals of a regular polygon",
    statement: "Each interior angle of a regular polygon measures 156°. How many diagonals does the polygon have?",
    part: 1,
    steps: [
      step("What is each exterior angle, in degrees?",
        num(24, [[204, "Interior and exterior angles add to 180°, not 360°."]]),
        "An interior and an exterior angle together make a straight line.",
        "$180 - 156 = 24$ degrees."),
      step("The exterior angles of any polygon add to 360°. How many sides does this one have?",
        num(15),
        "How many 24° turns make a full turn?",
        "$360 \\div 24 = 15$ sides."),
      step("From one vertex, how many diagonals can be drawn?",
        num(12, [[14, "Two of the other vertices are neighbours: joining to them gives sides, not diagonals."], [13, "Leave out the vertex itself **and** its two neighbours."]]),
        "Not to itself, and not to its two neighbours.",
        "$15 - 3 = 12$ diagonals from each vertex."),
      step("How many diagonals does the polygon have in total?",
        amc(90, [45, 75, 105, 180]),
        "15 vertices with 12 diagonals each counts every diagonal twice.",
        "$\\frac{15 \\cdot 12}{2} = 90$."),
    ],
    takeaway: "Regular polygon from an angle: go through the exterior angle, 360° ÷ exterior = number of sides.",
  }),
  problem("similar", "geo", 4, {
    title: "A parallel cut",
    statement: "In triangle $ABC$, point $D$ is on $AB$ and point $E$ is on $AC$ with $DE \\parallel BC$. If $AD = 4$, $DB = 6$ and $BC = 15$, what is the ratio of the area of triangle $ADE$ to the area of trapezoid $DBCE$?",
    figure: {
      w: 280, h: 200, alt: "Triangle ABC with A at the top and BC along the bottom. A segment DE, parallel to BC, cuts across the triangle 4 tenths of the way down from A.",
      items: [
        { t: "poly", pts: [[110, 25], [30, 180], [250, 180]] },
        { t: "poly", pts: [[110, 25], [78, 87], [166, 87]], fill: "accent" },
        { t: "label", at: [110, 14], text: "A" }, { t: "label", at: [20, 190], text: "B" }, { t: "label", at: [260, 190], text: "C" },
        { t: "label", at: [64, 86], text: "D" }, { t: "label", at: [180, 86], text: "E" },
        { t: "label", at: [82, 52], text: "4", tone: "muted" }, { t: "label", at: [42, 136], text: "6", tone: "muted" }, { t: "label", at: [140, 194], text: "15", tone: "muted" },
      ],
    },
    part: 2,
    steps: [
      step("What is $\\frac{AD}{AB}$?",
        num("2/5", [["2/3", "That is $\\frac{AD}{DB}$. Compare $AD$ with the whole side $AB = 10$."]]),
        "$AB = AD + DB$.",
        "$AB = 4 + 6 = 10$, so $\\frac{AD}{AB} = \\frac{4}{10} = \\frac{2}{5}$."),
      step("Triangle $ADE$ is similar to triangle $ABC$. How long is $DE$?",
        num(6, [[10, "That uses $\\frac{AD}{DB}$. Matching sides are $DE$ and $BC$, scaled by $\\frac{AD}{AB}$."]]),
        "Every length in $ADE$ is $\\frac{2}{5}$ of the matching length in $ABC$.",
        "$DE = \\frac{2}{5} \\cdot 15 = 6$."),
      step("Areas scale by the **square** of the length ratio. What fraction of triangle $ABC$'s area is triangle $ADE$?",
        num("4/25", [["2/5", "That is the length ratio. Areas use its square."]]),
        "Square $\\frac{2}{5}$.",
        "$(\\frac{2}{5})^2 = \\frac{4}{25}$."),
      step("What is the ratio of the area of $ADE$ to the area of trapezoid $DBCE$?",
        amc("4/21", ["4/25", "2/5", "4/9", "2/3"]),
        "The trapezoid is what is left of $ABC$: $25 - 4$ parts.",
        "If $ABC$ is 25 parts, $ADE$ is 4 and the trapezoid is 21, so the ratio is $\\frac{4}{21}$."),
    ],
    takeaway: "Similar figures: lengths scale by k, areas by k². Then the leftover piece is the difference.",
  }),
];

export const PROBLEM_FAMILIES: ProblemFamily[] = [
  // ---------------------------------------------------------------- algebra
  problemFamily("vieta", "alg", 3, (r) => {
    let s = 0, p = 0;
    do { s = r.int(4, 9); p = r.int(2, Math.floor((s * s - 1) / 4)); } while (Number.isInteger(Math.sqrt(s * s - 4 * p)));
    return {
      title: "Without finding the roots",
      statement: `Let $r$ and $t$ be the two roots of $x^2 - ${s}x + ${p} = 0$. What is $r^2 + t^2$?`,
      params: { s, p },
      part: 3,
      steps: [
        step("The roots are not whole numbers. What lets you skip finding them?",
          choice("a", [
            opt("a", "The sum and product of the roots can be read off the coefficients", "Yes: for $x^2 - Sx + P$, the roots add to $S$ and multiply to $P$."),
            opt("b", "The quadratic formula gives whole numbers here", `The discriminant ${s * s - 4 * p} is not a perfect square, so the roots are irrational.`),
            opt("c", "$r^2 + t^2$ is just $(r + t)^2$", "That drops the cross term $2rt$."),
          ]),
          "What can you say about $r + t$ and $rt$ straight from the equation?",
          "For $x^2 - Sx + P = 0$, the roots satisfy $r + t = S$ and $rt = P$."),
        step("What is $r + t$?",
          num(s, [[-s, "Careful with the sign: $x^2 - Sx + P$ has roots adding to $+S$."]]),
          "Read it off the $x$ coefficient, minding the sign.",
          `$r + t = ${s}$.`),
        step("What is $rt$?",
          num(p, [[-p, "The constant term is $+P$ here, so the product is positive."]]),
          "Read it off the constant term.",
          `$rt = ${p}$.`),
        step(`Since $(r + t)^2 = r^2 + t^2 + 2rt$, we get $r^2 + t^2 = ${s}^2 -$ □. What number goes in the box?`,
          num(2 * p, [[p, "The cross term is $2rt$, not $rt$."]]),
          "The box is $2rt$.",
          `$2rt = 2 \\cdot ${p} = ${2 * p}$.`),
        step("What is $r^2 + t^2$?",
          amc(s * s - 2 * p, [s * s, s * s + 2 * p, s * s - p, s * s - 4 * p]),
          `Compute $${s * s} - ${2 * p}$.`,
          `$r^2 + t^2 = ${s}^2 - 2 \\cdot ${p} = ${s * s} - ${2 * p} = ${s * s - 2 * p}$.`),
      ],
      takeaway: "Symmetric expressions in the roots (like r² + t²) come straight from the sum and product.",
    };
  }),
  problemFamily("arith", "alg", 2, (r) => {
    const a1 = r.int(2, 15), d = r.int(2, 9), m = r.int(3, 6), n = m + r.int(5, 9), k = r.int(25, 40);
    const T = (i: number) => a1 + (i - 1) * d;
    const ans = T(k);
    return {
      title: "Two terms, then a far one",
      statement: `In an arithmetic sequence, term number ${m} is ${T(m)} and term number ${n} is ${T(n)}. What is term number ${k}?`,
      params: { a1, d, m, n, k },
      part: 1,
      steps: [
        step(`Going from term ${m} to term ${n}, how many times is the common difference added?`,
          num(n - m, [[n - m + 1, `That counts the terms from ${m} to ${n}. Count the gaps between them.`]]),
          "Count steps, not terms: from term 1 to term 3 is 2 steps.",
          `$${n} - ${m} = ${n - m}$ steps.`),
        step("What is the common difference?",
          num(d),
          `The value grows by $${T(n)} - ${T(m)} = ${T(n) - T(m)}$ over those steps.`,
          `$\\frac{${T(n) - T(m)}}{${n - m}} = ${d}$.`),
        step(`How many more steps are there from term ${n} to term ${k}?`,
          num(k - n),
          "Subtract the term numbers.",
          `$${k} - ${n} = ${k - n}$ steps.`),
        step(`What is term number ${k}?`,
          amc(ans, [ans - d, ans + d, T(m) + (k - n) * d, k * d]),
          `Start at ${T(n)} and add ${d} a total of ${k - n} times.`,
          `$${T(n)} + ${k - n} \\cdot ${d} = ${ans}$.`),
      ],
      takeaway: "In an arithmetic sequence, divide the change by the number of steps to get d, then step from the nearest known term.",
    };
  }),

  // ---------------------------------------------------------------- number theory
  problemFamily("evendiv", "nt", 3, (r) => {
    const a = r.int(2, 5), b = r.int(1, 3), c = r.int(0, 2);
    const N = 2 ** a * 3 ** b * 5 ** c;
    const rest = (b + 1) * (c + 1);
    const form = c ? `2^{${a}} \\cdot 3^{${b}} \\cdot 5^{${c}}` : `2^{${a}} \\cdot 3^{${b}}`;
    return {
      title: "Even divisors",
      statement: `How many positive divisors of ${N} are even?`,
      params: { a, b, c },
      part: 1,
      steps: [
        step(`Write ${N} as a product of primes. What is the exponent of 2?`,
          num(a),
          "Keep halving until the result is odd, and count the halvings.",
          `$${N} = ${form}$, so the exponent of 2 is ${a}.`),
        step(`Every divisor is $2^i$ times a divisor of the odd part. For the divisor to be **even**, how many choices are there for $i$?`,
          num(a, [[a + 1, "That includes $i = 0$, and $2^0 = 1$ gives an odd divisor."]]),
          `$i$ can be 0 up to ${a}, but even means $i \\ge 1$.`,
          `$i = 1, 2, \\ldots, ${a}$: ${a} choices.`),
        step(`How many divisors does the odd part $${c ? `3^{${b}} \\cdot 5^{${c}}` : `3^{${b}}`}$ have?`,
          num(rest),
          c ? "Each exponent can be 0 up to its maximum: multiply the counts." : `The power of 3 can be 0 up to ${b}.`,
          c ? `$(${b} + 1)(${c} + 1) = ${rest}$.` : `$${b} + 1 = ${rest}$.`),
        step(`How many divisors of ${N} are even?`,
          amc(a * rest, [(a + 1) * rest, rest, (a - 1) * rest, (a + 2) * rest]),
          "Multiply the choices for the power of 2 by the choices for the odd part.",
          `$${a} \\cdot ${rest} = ${a * rest}$.`),
      ],
      takeaway: "Count divisors by exponents: each prime's exponent is an independent choice, restricted as the question demands.",
    };
  }),
  problemFamily("units", "nt", 2, (r) => {
    const base = r.pick([2, 3, 7, 8] as const), e = r.int(2001, 2099);
    const cycle: Record<number, number[]> = { 2: [2, 4, 8, 6], 3: [3, 9, 7, 1], 7: [7, 9, 3, 1], 8: [8, 4, 2, 6] };
    const digits = cycle[base];
    const rem = e % 4;
    const ans = digits[(rem + 3) % 4];
    const others = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => digits.includes(x) && x !== ans);
    return {
      title: "The last digit of a huge power",
      statement: `What is the units digit of $${base}^{${e}}$?`,
      params: { base, e },
      part: 1,
      steps: [
        step(`Write the units digits of $${base}^1, ${base}^2, ${base}^3, \\ldots$ After how many powers does the pattern start repeating?`,
          num(4),
          "Only the units digit matters: multiply the last digit by " + base + " each time.",
          `The units digits go ${digits.join(", ")}, ${digits[0]}, … so the pattern repeats every 4 powers.`),
        step(`What is the remainder when ${e} is divided by 4?`,
          num(rem),
          "Only the last two digits matter for division by 4.",
          `$${e} = 4 \\cdot ${Math.floor(e / 4)} + ${rem}$, so the remainder is ${rem}.`),
        step(`What is the units digit of $${base}^{${e}}$?`,
          amc(ans, [...others, 0, 5]),
          rem === 0 ? "Remainder 0 means the last spot in the cycle, not the first." : `Remainder ${rem} means spot ${rem} in the cycle.`,
          `${rem === 0 ? "Remainder 0 lands on the 4th" : `Remainder ${rem} lands on spot ${rem}`} of ${digits.join(", ")}, so the units digit is ${ans}.`),
      ],
      takeaway: "Units digits of powers cycle. Find the cycle length, then use the exponent's remainder (0 means the last spot).",
    };
  }),

  // ---------------------------------------------------------------- counting and probability
  problemFamily("digitsum", "cp", 3, (r) => {
    const s = r.int(4, 9);
    const ans = C2(s + 1);
    return {
      title: "Digits that add up",
      statement: `How many three-digit positive integers have digits that add up to ${s}?`,
      params: { s },
      part: 0,
      steps: [
        step(`Call the digits $a, b, c$, with $a \\ge 1$ because it is the leading digit. Let $a' = a - 1$, so $a' \\ge 0$. Then $a' + b + c$ equals what?`,
          num(s - 1, [[s, "Taking 1 off $a$ takes 1 off the total."]]),
          "Taking 1 away from $a$ takes 1 away from the sum.",
          `$a' + b + c = ${s} - 1 = ${s - 1}$, with every letter now allowed to be 0. (No digit can exceed 9 here, so that limit never bites.)`),
        step(`Count the solutions with stars and bars: ${s - 1} stars and 2 bars in a row. How many symbols is that in all?`,
          num(s + 1),
          "Stars plus bars.",
          `${s - 1} + 2 = ${s + 1} symbols. Each arrangement is one solution: the bars split the stars into $a'$, $b$, $c$.`),
        step("Choose which 2 of those positions hold the bars. How many three-digit numbers is that?",
          amc(ans, [C2(s + 2), C2(s), (s + 1) * s * (s - 1) / 6, s * s]),
          `Choose 2 of the ${s + 1} spots.`,
          `$\\binom{${s + 1}}{2} = ${ans}$.`),
      ],
      takeaway: "Sum of digits = constant: shift the leading digit to start at 0, then use stars and bars.",
    };
  }),
  problemFamily("orboth", "cp", 2, (r) => {
    const [p, q] = r.pick([[2, 3], [3, 5], [2, 5], [3, 7], [4, 5], [5, 7]] as const);
    const N = r.int(200, 600);
    const [A, B, C] = [Math.floor(N / p), Math.floor(N / q), Math.floor(N / (p * q))];
    return {
      title: "One or the other, not both",
      statement: `How many integers from 1 to ${N} are divisible by ${p} or by ${q}, but not by both?`,
      params: { p, q, N },
      part: 2,
      steps: [
        step(`How many integers from 1 to ${N} are divisible by ${p}?`,
          num(A),
          `Divide ${N} by ${p} and round down.`,
          `${N} ÷ ${p} rounded down is ${A}.`),
        step(`How many are divisible by ${q}?`,
          num(B),
          `Divide ${N} by ${q} and round down.`,
          `${N} ÷ ${q} rounded down is ${B}.`),
        step(`How many are divisible by both ${p} and ${q}, that is, by ${p * q}?`,
          num(C),
          `${p} and ${q} share no factor, so "both" means divisible by $${p} \\cdot ${q}$.`,
          `${N} ÷ ${p * q} rounded down is ${C}.`),
        step("How many are divisible by exactly one of them?",
          amc(A + B - 2 * C, [A + B - C, A + B, A + B - 3 * C, A - C]),
          "The numbers divisible by both were counted in both lists. Remove them from each.",
          `$${A} + ${B} - 2 \\cdot ${C} = ${A + B - 2 * C}$. (Subtracting ${C} once gives "or"; twice gives "exactly one".)`),
      ],
      takeaway: "\"Or\" subtracts the overlap once; \"exactly one\" subtracts it twice.",
    };
  }),
  problemFamily("marbles", "cp", 3, (r) => {
    const red = r.int(3, 7);
    let blue = r.int(4, 9);
    if (blue === red) blue += 1;
    const n = red + blue, same = C2(red) + C2(blue);
    const ans = frac(same, C2(n));
    return {
      title: "Two of a color",
      statement: `A bag holds ${red} red marbles and ${blue} blue marbles. Two marbles are drawn at random, without replacement. What is the probability that they are the same color?`,
      params: { red, blue },
      part: 1,
      steps: [
        step("How many different pairs of marbles can be drawn?",
          num(C2(n), [[n * (n - 1), "That counts each pair twice (first-then-second). A pair has no order."]]),
          `Choose 2 of the ${n} marbles.`,
          `$\\binom{${n}}{2} = ${C2(n)}$.`),
        step("How many of those pairs are both red?",
          num(C2(red)),
          `Choose 2 of the ${red} red marbles.`,
          `$\\binom{${red}}{2} = ${C2(red)}$.`),
        step("How many pairs are both blue?",
          num(C2(blue)),
          `Choose 2 of the ${blue} blue marbles.`,
          `$\\binom{${blue}}{2} = ${C2(blue)}$.`),
        step("What is the probability that both marbles are the same color?",
          amc(ans, [frac(red * red + blue * blue, n * n), frac(C2(n) - same, C2(n)), "1/2", frac(C2(red), C2(n))]),
          "Same color = both red or both blue. Divide by all pairs.",
          `$\\frac{${C2(red)} + ${C2(blue)}}{${C2(n)}} = \\frac{${same}}{${C2(n)}}$${gcd(same, C2(n)) > 1 ? `, which reduces to ${tex(ans)}` : ""}.`),
      ],
      takeaway: "Without replacement: count unordered pairs with binomials, then favourable over total.",
    };
  }),

  // ---------------------------------------------------------------- geometry
  problemFamily("altitude", "geo", 3, (r) => {
    const [a, b, c] = r.pick(TRIPLES);
    const area = (a * b) / 2;
    const h = frac(a * b, c);
    return {
      title: "Altitude to the hypotenuse",
      statement: `A right triangle has legs ${a} and ${b}. What is the length of the altitude drawn to its hypotenuse?`,
      figure: rightTriangle(a, b, `A right triangle with legs ${a} and ${b}, with the right angle at the bottom left.`),
      params: { a, b },
      part: 2,
      steps: [
        step("How long is the hypotenuse?",
          num(c, [[a + b, "The hypotenuse is shorter than the two legs together: use $a^2 + b^2 = c^2$."]]),
          `$${a}^2 + ${b}^2 = c^2$.`,
          `$\\sqrt{${a * a} + ${b * b}} = \\sqrt{${c * c}} = ${c}$.`),
        step("What is the area of the triangle?",
          num(area, [[a * b, "Don't forget the $\\frac{1}{2}$."]]),
          "The legs are a base and a height.",
          `$\\frac{1}{2} \\cdot ${a} \\cdot ${b} = ${area}$.`),
        step("The area is also $\\frac{1}{2} \\cdot \\text{hypotenuse} \\cdot h$. So what is (hypotenuse) × $h$?",
          num(a * b, [[area, "That is the area itself. The hypotenuse times $h$ is **twice** the area."]]),
          "Double the area.",
          `$${c} \\cdot h = 2 \\cdot ${area} = ${a * b}$.`),
        step("What is the altitude $h$?",
          amc(h, [frac(c, 2), frac(a * b, a + b), frac(a + b, 2), frac(a * b, 2 * c)]),
          `Divide ${a * b} by ${c}.`,
          `$h = \\frac{${a * b}}{${c}}$${h !== `${a * b}/${c}` ? ` = ${tex(h)}` : ""}.`),
      ],
      takeaway: "Compute the area two ways, with different bases, and solve for the unknown height.",
    };
  }),
  problemFamily("inradius", "geo", 4, (r) => {
    const [a, b, c] = r.pick(TRIPLES);
    const area = (a * b) / 2, s = (a + b + c) / 2, rad = area / s;
    return {
      title: "The circle inside",
      statement: `A circle sits inside a right triangle with legs ${a} and ${b}, touching all three sides. What is the radius of the circle?`,
      figure: rightTriangle(a, b, `A right triangle with legs ${a} and ${b} and a circle inside it touching all three sides.`, rad),
      params: { a, b },
      part: 2,
      steps: [
        step("How long is the hypotenuse?",
          num(c),
          `$${a}^2 + ${b}^2 = c^2$.`,
          `$\\sqrt{${a * a + b * b}} = ${c}$.`),
        step("What is the area of the triangle?",
          num(area, [[a * b, "Don't forget the $\\frac{1}{2}$."]]),
          "Half of leg times leg.",
          `$\\frac{1}{2} \\cdot ${a} \\cdot ${b} = ${area}$.`),
        step("Join the circle's centre to the three corners: that splits the triangle into three triangles of height $r$. So area $= r \\cdot s$, where $s$ is the semiperimeter. What is $s$?",
          num(s, [[a + b + c, "That's the whole perimeter. The semiperimeter is half of it."]]),
          "Half the perimeter.",
          `$s = \\frac{${a} + ${b} + ${c}}{2} = ${s}$.`),
        step("What is the radius?",
          amc(rad, [frac(rad, 2), frac(c, 2), 2 * rad, rad + 1]),
          `$r = \\text{area} \\div s$.`,
          `$r = \\frac{${area}}{${s}} = ${rad}$.`),
      ],
      takeaway: "Inradius: area = r × semiperimeter. (In a right triangle that's also r = (a + b − c)/2.)",
    };
  }),
];
