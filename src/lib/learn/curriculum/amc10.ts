// The AMC 10 course. Forty concepts in five domains. Concept ids are permanent: saved
// progress refers to them. To add a concept, add it to a unit here; `npm run verify:cards`
// checks the graph (unknown ids, cycles, missing objectives).
import type { Concept, Course, Prerequisite } from "./types";

const req = (concept: string): Prerequisite => ({ concept, strength: "required" });
const helps = (concept: string): Prerequisite => ({ concept, strength: "helpful" });

type Draft = Omit<Concept, "domain" | "unit" | "objectives" | "related" | "prerequisites"> & {
  objectives: [key: string, text: string][];
  prerequisites?: Prerequisite[];
  related?: string[];
};
const unit = (id: string, name: string, domain: string, drafts: Draft[]) => ({
  id,
  name,
  concepts: drafts.map((d): Concept => ({
    ...d,
    domain,
    unit: id,
    prerequisites: d.prerequisites ?? [],
    related: d.related ?? [],
    objectives: d.objectives.map(([key, text]) => ({ id: `${d.id}/${key}`, text })),
  })),
});

export const AMC10: Course = {
  id: "amc10",
  name: "AMC 10 Mathematics",
  domains: [
    {
      id: "alg", name: "Algebra", topic: "algebra",
      units: [
        unit("alg.equations", "Equations and relationships", "alg", [
          {
            id: "alg.word-equations", name: "Words into equations",
            description: "Turn a story into an equation by naming the unknown and writing down what the story says about it.",
            objectives: [
              ["define", "Choose a variable that makes the conditions easy to write."],
              ["translate", "Write an equation from a verbal condition."],
              ["answer", "Answer the question that was asked, not just the value of the variable."],
            ],
            techniques: ["Name the unknown", "Check against the question"],
            related: ["alg.systems", "alg.ratios-rates"],
            standard: "Sets up and solves an unfamiliar one-unknown story problem and reports the quantity that was asked for.",
          },
          {
            id: "alg.ratios-rates", name: "Ratios and rates",
            description: "Ratios compare parts; rates compare different units. Most rate problems come down to distance = rate × time in disguise.",
            objectives: [
              ["parts", "Split a quantity in a given ratio using parts."],
              ["rate", "Use amount = rate × time for work and travel."],
              ["average", "Find an average rate over unequal segments."],
            ],
            prerequisites: [helps("alg.word-equations")],
            techniques: ["Count parts", "Rate × time table"],
            related: ["geo.similar"],
            standard: "Solves combined-rate and average-speed problems without averaging the rates.",
          },
          {
            id: "alg.systems", name: "Systems of equations",
            description: "Several conditions on several unknowns. Often the quickest path is to add or subtract whole equations rather than solve for each letter.",
            objectives: [
              ["eliminate", "Solve a two-variable system by elimination or substitution."],
              ["combine", "Find a requested combination directly by adding or subtracting equations."],
            ],
            prerequisites: [req("alg.word-equations")],
            techniques: ["Elimination", "Add all the equations"],
            related: ["alg.symmetric-sums"],
            standard: "Finds a requested combination of unknowns without solving for every variable when a shortcut exists.",
          },
          {
            id: "alg.inequalities", name: "Bounding and inequalities",
            description: "Pin a quantity between two bounds, then use the fact that it is an integer.",
            objectives: [
              ["solve", "Solve a linear inequality, flipping the sign when multiplying by a negative."],
              ["bound", "Bound an integer quantity and list the remaining possibilities."],
            ],
            prerequisites: [helps("alg.word-equations")],
            techniques: ["Squeeze between bounds"],
            standard: "Uses bounds to cut an integer search down to a handful of cases.",
          },
        ]),
        unit("alg.expressions", "Expressions and factoring", "alg", [
          {
            id: "alg.exponents", name: "Exponent rules",
            description: "Powers of the same base combine by adding and multiplying exponents. Rewriting everything in one base is the main move.",
            objectives: [
              ["rules", "Simplify products, quotients and powers of powers."],
              ["base", "Rewrite numbers in a common base to compare or solve."],
            ],
            techniques: ["Common base"],
            related: ["alg.geo-seq", "nt.primes"],
            standard: "Solves exponential equations by moving to a common base.",
          },
          {
            id: "alg.factoring", name: "Factoring patterns",
            description: "Rewriting a sum as a product. A product tells you far more than a sum: when it is zero, what divides it, how it compares.",
            objectives: [
              ["common", "Pull out the factor every term shares, including a whole bracket."],
              ["squares", "Factor a difference of two squares, and use it to compute."],
              ["sum-product", "Factor x² + bx + c by finding two numbers with sum b and product c."],
              ["choose", "Recognize which factoring pattern an expression fits."],
            ],
            techniques: ["Common factor first", "Difference of squares", "Sum and product"],
            related: ["alg.quadratic-equations", "alg.vieta", "nt.primes"],
            standard: "Factors an unfamiliar expression completely, choosing the pattern without being told, and uses factoring to shortcut arithmetic.",
          },
          {
            id: "alg.quadratic-equations", name: "Solving quadratics",
            description: "Get zero on one side, factor, and use the fact that a product is zero only when a factor is zero. Complete the square when factoring fails.",
            objectives: [
              ["zero-product", "Solve a quadratic by factoring with zero on one side."],
              ["square", "Solve by completing the square when no integer pair works."],
            ],
            prerequisites: [req("alg.factoring")],
            techniques: ["Zero-product rule", "Completing the square"],
            related: ["alg.vieta"],
            standard: "Solves a quadratic given in a non-standard form, choosing between factoring and completing the square.",
          },
          {
            id: "alg.vieta", name: "Sum and product of roots",
            description: "The coefficients of a quadratic already tell you the sum and product of its roots. Many questions about roots never need the roots themselves.",
            objectives: [
              ["read", "Read the sum and product of the roots from the coefficients."],
              ["build", "Compute expressions in the roots from their sum and product."],
              ["reverse", "Recover an unknown coefficient or root from information about the roots."],
            ],
            prerequisites: [req("alg.factoring"), helps("alg.quadratic-equations")],
            techniques: ["Vieta's formulas", "Rewrite in terms of sum and product"],
            related: ["alg.symmetric-sums"],
            standard: "Answers questions about the roots of a quadratic without solving it, including when the roots are not integers.",
          },
          {
            id: "alg.symmetric-sums", name: "Symmetric expressions",
            description: "Expressions that do not change when x and y swap can be rebuilt from x + y and xy.",
            objectives: [
              ["squares", "Find x² + y² from x + y and xy."],
              ["reciprocals", "Combine reciprocals into a ratio of sum and product."],
            ],
            prerequisites: [req("alg.factoring"), helps("alg.vieta")],
            techniques: ["Square the sum"],
            related: ["alg.systems"],
            standard: "Evaluates a symmetric expression without finding the individual values.",
          },
        ]),
        unit("alg.sequences", "Sequences and functions", "alg", [
          {
            id: "alg.arith-seq", name: "Arithmetic sequences",
            description: "Sequences with a constant step. The nth term counts steps from the start, and the sum is the number of terms times the average of the ends.",
            objectives: [
              ["term", "Find any term by counting steps from a known term."],
              ["count", "Count how many terms an arithmetic sequence has."],
              ["sum", "Sum an arithmetic sequence by pairing the ends."],
              ["middle", "Use the middle term as the average."],
            ],
            techniques: ["Count the gaps", "Pair first and last", "Average × count"],
            related: ["ps.small-cases", "alg.geo-seq"],
            standard: "Finds terms, term counts and sums of arithmetic sequences in problems that do not announce themselves as sequences.",
          },
          {
            id: "alg.geo-seq", name: "Geometric sequences",
            description: "Sequences with a constant ratio. Each step multiplies, so terms are powers of the ratio.",
            objectives: [
              ["term", "Find a term or the ratio from two known terms."],
              ["sum", "Sum a short geometric sequence."],
            ],
            prerequisites: [req("alg.exponents")],
            techniques: ["Divide consecutive terms"],
            related: ["alg.arith-seq"],
            standard: "Moves between terms of a geometric sequence using the ratio.",
          },
          {
            id: "alg.functions", name: "Functions",
            description: "A rule that turns an input into one output. Contest problems test whether you can follow notation carefully.",
            objectives: [
              ["evaluate", "Evaluate and compose functions from a rule."],
              ["defined", "Apply a newly defined operation exactly as written."],
            ],
            techniques: ["Substitute carefully"],
            standard: "Evaluates nested and newly defined operations without notation slips.",
          },
        ]),
      ],
    },
    {
      id: "nt", name: "Number Theory", topic: "number_theory",
      units: [
        unit("nt.divisibility-unit", "Divisibility", "nt", [
          {
            id: "nt.divisibility", name: "Multiples and divisibility",
            description: "\"Divisible by d\" means \"equal to d times a whole number\". Writing that down turns divisibility questions into algebra.",
            objectives: [
              ["form", "Write a multiple of d as d·k and use it to explain a divisibility fact."],
              ["consecutive", "Use the fact that any n consecutive integers contain exactly one multiple of n."],
              ["count", "Count the multiples of a number in a range."],
              ["digits", "Test divisibility by 3 and 9 with the digit sum."],
            ],
            techniques: ["Write n = d·k", "Consecutive integers", "Count multiples by dividing"],
            related: ["nt.remainders", "nt.primes", "cp.inclusion-exclusion"],
            standard: "Explains why an expression is always divisible by a number and counts multiples in a range, including ranges that do not start at 1.",
          },
          {
            id: "nt.primes", name: "Prime factorization",
            description: "Every whole number above 1 is a product of primes in exactly one way. That product is the number's fingerprint: divisors, squares and common factors can all be read from it.",
            objectives: [
              ["factor", "Write a number as a product of prime powers."],
              ["divisors", "Count divisors from the exponents."],
              ["squares", "Decide whether a number is a perfect square or cube from its exponents."],
              ["build", "Find the smallest number to multiply by to reach a square or cube."],
            ],
            prerequisites: [req("nt.divisibility")],
            techniques: ["Factor tree", "Add one to each exponent and multiply", "Even exponents mean square"],
            related: ["nt.gcd-lcm", "alg.exponents", "alg.factoring"],
            standard: "Reads divisor counts and square or cube conditions straight from a prime factorization, including for numbers given as products.",
          },
          {
            id: "nt.gcd-lcm", name: "GCD and LCM",
            description: "The greatest common divisor takes the smaller exponent of each prime; the least common multiple takes the larger.",
            objectives: [
              ["compute", "Find a GCD and LCM from prime factorizations."],
              ["product", "Use gcd × lcm = product of the two numbers."],
              ["meet", "Use an LCM to find when repeating events coincide."],
            ],
            prerequisites: [req("nt.primes")],
            techniques: ["Min and max of exponents"],
            related: ["nt.diophantine", "nt.cycles"],
            standard: "Uses GCD and LCM in word problems about repeating events and shared factors.",
          },
        ]),
        unit("nt.modular", "Modular arithmetic", "nt", [
          {
            id: "nt.remainders", name: "Remainders",
            description: "A remainder is what is left over after removing as many full groups as possible. Remainders can be added and multiplied without knowing the original numbers.",
            objectives: [
              ["meaning", "Write a number as (divisor × quotient) + remainder and interpret each part."],
              ["combine", "Find the remainder of a sum or product from the remainders of its parts."],
              ["eliminate", "Use remainders to rule out possibilities."],
              ["negative", "Replace a remainder with a simpler equivalent, such as −1."],
            ],
            prerequisites: [req("nt.divisibility")],
            techniques: ["Reduce first, then compute", "Rule out by remainder", "Use −1 for a remainder one short"],
            related: ["nt.cycles", "ps.parity-invariants", "nt.digits-bases"],
            standard: "Finds remainders of large sums and products by reducing first, and uses remainders to show that something is impossible.",
          },
          {
            id: "nt.cycles", name: "Repeating patterns",
            description: "There are only finitely many remainders, so powers and other repeated processes must eventually cycle. Find the cycle length, then find where you land in it.",
            objectives: [
              ["find", "Find the cycle of last digits of the powers of a number."],
              ["position", "Use the cycle length to find a far-off term."],
              ["transfer", "Apply cycle reasoning to days, clocks and other repeating settings."],
            ],
            prerequisites: [req("nt.remainders")],
            techniques: ["List until it repeats", "Divide the position by the cycle length"],
            related: ["ps.small-cases", "nt.gcd-lcm"],
            standard: "Finds a far-off term of any repeating process, handling the case where the position is an exact multiple of the cycle length.",
          },
          {
            id: "nt.digits-bases", name: "Digits and place value",
            description: "A two-digit number with digits a and b is 10a + b. Writing digits as letters turns digit puzzles into equations.",
            objectives: [
              ["expand", "Write a number in expanded form using its digits."],
              ["solve", "Solve a digit puzzle using expanded form and bounds on digits."],
            ],
            prerequisites: [helps("nt.remainders")],
            techniques: ["Expanded form"],
            standard: "Solves digit-reversal and digit-sum puzzles algebraically.",
          },
          {
            id: "nt.diophantine", name: "Whole-number equations",
            description: "Equations where only whole-number answers count. Divisibility cuts the search down to a few cases.",
            objectives: [
              ["search", "Find all non-negative integer solutions of ax + by = c."],
              ["factor", "Solve xy + ax + by = c by completing the rectangle."],
            ],
            prerequisites: [req("nt.gcd-lcm"), helps("nt.remainders")],
            techniques: ["Step by the other coefficient", "Complete the rectangle"],
            standard: "Counts the whole-number solutions of a two-variable linear equation.",
          },
        ]),
      ],
    },
    {
      id: "cp", name: "Counting and Probability", topic: "counting_probability",
      units: [
        unit("cp.counting", "Counting", "cp", [
          {
            id: "cp.multiplication", name: "Counting in stages",
            description: "Build each outcome one decision at a time. When every choice at one stage can be followed by the same number of choices at the next, multiply.",
            objectives: [
              ["stages", "Break an outcome into stages and multiply the number of choices."],
              ["repeat", "Tell whether a choice uses up an option or leaves it available."],
              ["restrict", "Handle a restricted position first."],
            ],
            techniques: ["One slot per decision", "Most restricted slot first", "Glue items that must stay together"],
            related: ["cp.overcounting", "cp.probability", "cp.complement"],
            standard: "Counts arrangements with restrictions by choosing a good order of decisions.",
          },
          {
            id: "cp.overcounting", name: "When order does not matter",
            description: "If you count ordered picks but the order does not matter, each outcome was counted several times. Divide by the number of times each one was counted.",
            objectives: [
              ["decide", "Decide whether two orderings represent the same outcome."],
              ["divide", "Count unordered selections by dividing ordered counts."],
              ["partial", "Divide only by the orderings of the part that is interchangeable."],
            ],
            prerequisites: [req("cp.multiplication")],
            techniques: ["Count ordered, then divide", "n choose k"],
            related: ["cp.stars-bars", "cp.probability"],
            standard: "Counts selections where some roles are distinct and others are interchangeable.",
          },
          {
            id: "cp.complement", name: "Counting the opposite",
            description: "When the thing you want comes in many shapes but its opposite is simple, count everything and subtract the opposite.",
            objectives: [
              ["spot", "Recognize when the complement is easier to count."],
              ["subtract", "Compute total minus complement for an \"at least one\" condition."],
              ["opposite", "State the exact opposite of a condition."],
            ],
            prerequisites: [req("cp.multiplication")],
            techniques: ["Total minus none", "Name the opposite precisely"],
            related: ["cp.probability", "cp.casework"],
            standard: "Chooses complementary counting unprompted and states the complement correctly, including for \"at least two\" and \"not all different\".",
          },
          {
            id: "cp.casework", name: "Casework",
            description: "Split a count into cases that do not overlap and together cover everything, then add.",
            objectives: [
              ["split", "Choose cases that are disjoint and exhaustive."],
              ["organize", "Order cases so none is missed."],
            ],
            prerequisites: [req("cp.multiplication")],
            techniques: ["Case on the most constrained item"],
            related: ["cp.complement"],
            standard: "Solves a counting problem with three or more cases without missing or double-counting.",
          },
          {
            id: "cp.inclusion-exclusion", name: "Overlapping sets",
            description: "To count things in A or B, add the two counts and subtract what was counted twice.",
            objectives: [
              ["two", "Count a union of two overlapping sets."],
              ["only", "Find how many are in exactly one set."],
            ],
            prerequisites: [helps("nt.divisibility")],
            techniques: ["Add, then subtract the overlap", "Venn diagram"],
            standard: "Counts \"A or B but not both\" situations with a Venn diagram.",
          },
          {
            id: "cp.stars-bars", name: "Distributing identical objects",
            description: "Handing out identical objects is the same as placing dividers in a row.",
            objectives: [
              ["model", "Translate a distribution into objects and dividers."],
              ["minimum", "Handle \"at least one each\" by giving one to everyone first."],
            ],
            prerequisites: [req("cp.overcounting")],
            techniques: ["Stars and bars"],
            standard: "Counts distributions of identical objects with and without minimums.",
          },
        ]),
        unit("cp.probability-unit", "Probability", "cp", [
          {
            id: "cp.probability", name: "Probability by counting",
            description: "When outcomes are equally likely, a probability is favourable outcomes over all outcomes. The hard part is making sure the outcomes really are equally likely.",
            objectives: [
              ["ratio", "Compute a probability as favourable over total."],
              ["equally", "Choose a sample space of equally likely outcomes."],
              ["complement", "Use 1 minus the probability of the opposite."],
            ],
            prerequisites: [req("cp.multiplication"), helps("cp.complement")],
            techniques: ["List the sample space", "One minus"],
            related: ["cp.expected-value"],
            standard: "Finds probabilities for two-stage experiments using an equally likely sample space.",
          },
          {
            id: "cp.expected-value", name: "Expected value",
            description: "The long-run average of a random quantity: each value times its probability, added up.",
            objectives: [
              ["compute", "Compute an expected value from a table of outcomes."],
              ["linear", "Add expected values of separate parts."],
            ],
            prerequisites: [req("cp.probability")],
            techniques: ["Weighted average"],
            standard: "Computes the expected value of a simple game.",
          },
        ]),
      ],
    },
    {
      id: "geo", name: "Geometry", topic: "geometry",
      units: [
        unit("geo.triangles", "Angles and triangles", "geo", [
          {
            id: "geo.angles", name: "Angle chasing",
            description: "A few facts (straight lines, triangles, parallel lines, isosceles triangles) let you pass a known angle around a figure until it reaches the one you want.",
            objectives: [
              ["triangle", "Use the angle sum of a triangle and angles on a straight line."],
              ["exterior", "Use the exterior angle of a triangle as the sum of the two far interior angles."],
              ["isosceles", "Use equal sides to mark equal angles."],
              ["parallel", "Transfer an angle across parallel lines."],
            ],
            techniques: ["Mark everything you know", "Exterior angle shortcut", "Equal sides give equal angles"],
            related: ["geo.similar", "geo.circle-angles"],
            standard: "Finds an unknown angle in a figure needing three or more steps, choosing which facts to use.",
          },
          {
            id: "geo.triangle-area", name: "Triangle area",
            description: "Half of base times height, where any side can be the base. Triangles sharing a height have areas in the ratio of their bases.",
            objectives: [
              ["base", "Choose a convenient base and height."],
              ["shared", "Compare areas of triangles that share a height."],
            ],
            techniques: ["Pick the base that has a known height"],
            related: ["geo.area-ratios", "geo.coordinates"],
            standard: "Finds areas by choosing a base whose height is known.",
          },
          {
            id: "geo.pythagorean", name: "Right triangles",
            description: "In a right triangle the squares of the legs add up to the square of the hypotenuse. A few families of side lengths come up again and again.",
            objectives: [
              ["compute", "Find a missing side of a right triangle."],
              ["triples", "Recognize scaled 3-4-5 and 5-12-13 triangles."],
              ["special", "Use the side ratios of 45-45-90 and 30-60-90 triangles."],
            ],
            techniques: ["Spot a scaled triple", "Drop an altitude to make right triangles"],
            related: ["geo.coordinates", "geo.circle-lengths"],
            standard: "Creates right triangles in a figure that does not show them and finds lengths from them.",
          },
          {
            id: "geo.similar", name: "Similar triangles",
            description: "Triangles with the same angles are scaled copies of each other. Every pair of matching sides has the same ratio, and areas scale by the square of that ratio.",
            objectives: [
              ["identify", "Identify similar triangles from two pairs of equal angles."],
              ["match", "Match corresponding sides and set up a proportion."],
              ["area", "Use the square of the scale factor for areas."],
            ],
            prerequisites: [req("geo.angles")],
            techniques: ["Find two equal angles", "Name vertices in matching order", "Square the scale factor for area"],
            related: ["geo.area-ratios", "alg.ratios-rates"],
            standard: "Finds similar triangles in a figure with a parallel line or shared angle and uses them for lengths and areas.",
          },
          {
            id: "geo.area-ratios", name: "Area ratios",
            description: "Many area problems need no lengths at all, only how the pieces compare.",
            objectives: [
              ["bases", "Split a triangle's area in the ratio of bases on a common line."],
              ["scale", "Combine similar-triangle and shared-height ratios."],
            ],
            prerequisites: [req("geo.similar"), helps("geo.triangle-area")],
            techniques: ["Same height, compare bases"],
            standard: "Finds what fraction of a figure a region covers using ratios alone.",
          },
        ]),
        unit("geo.circles", "Circles, coordinates and solids", "geo", [
          {
            id: "geo.circle-angles", name: "Angles in circles",
            description: "An angle at the edge of a circle is half the arc it cuts off, so angles standing on the same arc are equal.",
            objectives: [
              ["inscribed", "Relate an inscribed angle to its arc and central angle."],
              ["diameter", "Use the right angle standing on a diameter."],
            ],
            prerequisites: [req("geo.angles")],
            techniques: ["Draw radii to make isosceles triangles"],
            standard: "Finds angles in a circle figure using inscribed angles and radii.",
          },
          {
            id: "geo.circle-lengths", name: "Lengths in circles",
            description: "Radii to tangent points meet tangents at right angles, which hides right triangles inside circle figures.",
            objectives: [
              ["tangent", "Use the right angle between a radius and a tangent."],
              ["chord", "Find a chord length from its distance to the centre."],
            ],
            prerequisites: [helps("geo.pythagorean")],
            techniques: ["Draw the radius to the tangent point"],
            standard: "Finds tangent and chord lengths by drawing the right radii.",
          },
          {
            id: "geo.coordinates", name: "Coordinate geometry",
            description: "Placing a figure on a grid turns geometry into arithmetic with slopes, distances and midpoints.",
            objectives: [
              ["distance", "Find distances, midpoints and slopes."],
              ["area", "Find the area of a polygon from its vertices."],
            ],
            prerequisites: [helps("geo.pythagorean")],
            techniques: ["Box and subtract"],
            standard: "Finds lengths and areas of figures given by coordinates.",
          },
          {
            id: "geo.solids", name: "Solids",
            description: "Volumes, surface areas and distances in boxes, cylinders and pyramids. Most questions reduce to a flat slice.",
            objectives: [
              ["volume", "Compute volumes and surface areas of standard solids."],
              ["slice", "Find a space diagonal by slicing to a right triangle."],
            ],
            prerequisites: [helps("geo.pythagorean"), helps("geo.triangle-area")],
            techniques: ["Take a flat slice"],
            standard: "Finds a length inside a solid by choosing the right cross-section.",
          },
        ]),
      ],
    },
    {
      id: "ps", name: "Problem-Solving Strategies", topic: "logic_misc",
      units: [
        unit("ps.strategies", "General strategies", "ps", [
          {
            id: "ps.small-cases", name: "Small cases and patterns",
            description: "When a problem is too big to see, shrink it. Solve the first few cases, look for the pattern, then explain why it holds.",
            objectives: [
              ["shrink", "Replace a large parameter with small ones and tabulate results."],
              ["justify", "Check a guessed pattern against one more case before trusting it."],
            ],
            techniques: ["Make a table"],
            related: ["nt.cycles", "alg.arith-seq"],
            standard: "Finds and checks a pattern from small cases in an unfamiliar setting.",
          },
          {
            id: "ps.working-backwards", name: "Working backwards",
            description: "When you know where a process ends, undo it one step at a time.",
            objectives: [
              ["undo", "Reverse a sequence of operations from the final value."],
              ["test", "Test answer candidates efficiently when reversing is hard."],
            ],
            techniques: ["Undo each step in reverse order"],
            standard: "Recovers a starting value from the end of a multi-step process.",
          },
          {
            id: "ps.parity-invariants", name: "Parity and invariants",
            description: "Look for something that never changes, such as whether a total is odd or even. It can show that a target is unreachable.",
            objectives: [
              ["parity", "Track odd and even through sums and products."],
              ["invariant", "Find a quantity a process cannot change."],
            ],
            prerequisites: [helps("nt.remainders")],
            techniques: ["Odd or even?"],
            related: ["nt.remainders"],
            standard: "Uses parity to decide whether an outcome is possible.",
          },
          {
            id: "ps.symmetry", name: "Symmetry",
            description: "If two cases are mirror images, solve one and double it, or notice that their probabilities must be equal.",
            objectives: [
              ["pair", "Pair up outcomes that are mirror images."],
              ["half", "Use equal likelihood of symmetric outcomes."],
            ],
            techniques: ["Pair up mirror cases"],
            related: ["cp.probability"],
            standard: "Uses a symmetry argument to avoid a long count.",
          },
        ]),
      ],
    },
  ],
};
