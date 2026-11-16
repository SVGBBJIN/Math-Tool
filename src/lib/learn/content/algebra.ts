// Algebra cards: factoring patterns, sum and product of roots, arithmetic sequences.
// The factoring cards adapt the worked examples of the earlier move-based practice pack.
import type { Card, CardFamily } from "../cards/types";
import { COMPUTED, REASONED, adaptedFrom, family, forConcept, opt, slip } from "./author";

const fac = forConcept("alg.factoring");
const vi = forConcept("alg.vieta");
const seq = forConcept("alg.arith-seq");

export const CARDS: Card[] = [
  // ---------------------------------------------------------------- factoring patterns
  fac("i1", "insight", "squares", 1, 35, {
    title: "No squaring required",
    prompt: "Find $51^2 - 49^2$. There is a way to do it without squaring either number.",
    interaction: { kind: "numeric", answer: "200", slips: [slip(4, "$(51 - 49)^2 = 4$, but a difference of squares is not the square of the difference."), slip(2, "$51 - 49 = 2$ is one of the two factors. The other is $51 + 49$.")] },
    feedback: { correct: "$(51 - 49)(51 + 49) = 2 \\cdot 100$.", incorrect: "A difference of two squares splits into (difference) × (sum): here $2 \\times 100$." },
    explanation: {
      summary: "$A^2 - B^2 = (A - B)(A + B)$, because when you multiply the right side out the middle terms $+AB$ and $-AB$ cancel. So $51^2 - 49^2 = (51 - 49)(51 + 49) = 2 \\cdot 100 = 200$.",
    },
    takeaway: "A² − B² = (A − B)(A + B): a difference of two squares is a product in disguise.",
    whenToUse: "Two squares with a minus between them, in algebra or in arithmetic.",
    verification: COMPUTED("Evaluates 51² − 49² by direct multiplication."),
  }),
  fac("t2", "technique", "common", 1, 50, {
    title: "Common factor first",
    source: adaptedFrom("quad.gcf"),
    teach: {
      body: "Before trying any pattern, pull out what every term shares. What is left in the bracket is smaller and easier to read. The shared factor can be a number, a power of $x$, or a whole bracket.",
      steps: [
        "$6x^2 + 9x$: both terms contain 3 and $x$, so $6x^2 + 9x = 3x(2x + 3)$.",
        "$x(x - 4) + 3(x - 4)$: both terms contain the bracket $(x - 4)$, so it equals $(x - 4)(x + 3)$.",
      ],
    },
    prompt: "Factor completely: $5x^3 - 10x^2$",
    interaction: { kind: "expression", answer: "5x^2(x-2)", vars: ["x"], form: "factored" },
    hint: "What is the largest number, and the highest power of $x$, that divides both terms?",
    feedback: { correct: "Both terms contain 5 and $x^2$; taking them out leaves $x - 2$.", incorrect: "Both terms share the number 5 and the power $x^2$. Take both out: $5x^2(\\dots)$." },
    explanation: { summary: "$5x^3 = 5x^2 \\cdot x$ and $10x^2 = 5x^2 \\cdot 2$, so $5x^3 - 10x^2 = 5x^2(x - 2)$." },
    takeaway: "Always take out the common factor first: the largest number and the highest power every term shares.",
    whenToUse: "The first step of every factoring problem.",
    verification: COMPUTED("The key is expanded and compared, exactly, with an independently written expanded form; completeness of the factorisation is checked symbolically."),
  }),
  fac("t1", "technique", "sum-product", 2, 60, {
    title: "Sum and product",
    source: adaptedFrom("quad.tri"),
    teach: {
      body: "$(x + p)(x + q)$ multiplies out to $x^2 + (p + q)x + pq$. So to factor $x^2 + bx + c$, look for two numbers that **add** to $b$ and **multiply** to $c$.",
      steps: [
        "Factor $x^2 + 7x + 12$.",
        "Pairs with product 12: $1 \\cdot 12$, $2 \\cdot 6$, $3 \\cdot 4$.",
        "The pair that adds to 7 is 3 and 4.",
        "$x^2 + 7x + 12 = (x + 3)(x + 4)$.",
      ],
    },
    prompt: "Factor: $x^2 + 9x + 20$",
    interaction: { kind: "expression", answer: "(x+4)(x+5)", vars: ["x"], form: "factored", slips: [slip("(x+2)(x+10)", "2 and 10 multiply to 20, but they add to 12. You need the pair that adds to 9.")] },
    hint: "List the pairs of whole numbers that multiply to 20. Which pair adds to 9?",
    feedback: { correct: "4 and 5 multiply to 20 and add to 9.", incorrect: "You need two numbers with product 20 and sum 9. The pairs for 20 are $1 \\cdot 20$, $2 \\cdot 10$ and $4 \\cdot 5$." },
    explanation: { summary: "$4 + 5 = 9$ and $4 \\cdot 5 = 20$, so $x^2 + 9x + 20 = (x + 4)(x + 5)$." },
    takeaway: "To factor x² + bx + c, find two numbers with sum b and product c. Start from the product.",
    whenToUse: "Any quadratic whose leading coefficient is 1.",
    verification: COMPUTED("The key is expanded and compared, exactly, with an independently written expanded form."),
  }),
  fac("r1", "recognition", "choose", 2, 40, {
    title: "Which ones are differences of squares?",
    prompt: "Which of these can be factored using $A^2 - B^2 = (A - B)(A + B)$?",
    interaction: {
      kind: "multi", answers: ["a", "c", "d"],
      options: [
        opt("a", "$x^2 - 16$", "$x^2 - 4^2$: yes."),
        opt("b", "$x^2 + 16$", "A sum of two squares has no such factorisation. The minus sign is essential."),
        opt("c", "$9x^2 - 1$", "$(3x)^2 - 1^2$: yes. 1 is a square too."),
        opt("d", "$x^4 - y^2$", "$(x^2)^2 - y^2$: yes. An even power is a square."),
        opt("e", "$x^2 - 6x$", "$6x$ is not a square. This one has a common factor instead: $x(x - 6)$."),
      ],
    },
    feedback: { correct: "Each of those is (something)² minus (something)², even when the squares are disguised as $9x^2$, 1 or $x^4$.", incorrect: "Ask of each term: is it something squared? And is there a minus sign between exactly two such terms?" },
    explanation: { summary: "$x^2 - 16 = (x-4)(x+4)$, $9x^2 - 1 = (3x-1)(3x+1)$ and $x^4 - y^2 = (x^2-y)(x^2+y)$. A sum of squares does not factor this way, and $x^2 - 6x$ only has a common factor." },
    takeaway: "Look for two squares and a minus sign. Coefficients, the number 1 and even powers can all be squares.",
    whenToUse: "Scanning an expression to decide which factoring pattern applies.",
    verification: REASONED("Pattern classification. The three factorisations quoted in the explanation are expanded and compared exactly by the verifier for this card."),
  }),
  fac("a2", "application", "sum-product", 2, 45, {
    title: "Mixed signs",
    source: adaptedFrom("quad.tri.r3"),
    prompt: "Factor: $x^2 - x - 12$",
    interaction: { kind: "expression", answer: "(x-4)(x+3)", vars: ["x"], form: "factored", slips: [slip("(x+4)(x-3)", "Those give a middle term of $+x$. The larger number has to carry the minus sign.")] },
    hint: "The product is negative, so the two numbers have opposite signs. Their sum is $-1$.",
    feedback: { correct: "$-4$ and $3$ multiply to $-12$ and add to $-1$.", incorrect: "A negative product means opposite signs. You need two numbers 1 apart that multiply to 12, with the larger one negative." },
    explanation: { summary: "The numbers must multiply to $-12$ and add to $-1$: that is $-4$ and $3$. So $x^2 - x - 12 = (x - 4)(x + 3)$." },
    takeaway: "The sign of the constant tells you whether the two numbers have the same sign or opposite signs.",
    whenToUse: "Quadratics with a negative constant term.",
    verification: COMPUTED("The key is expanded and compared, exactly, with an independently written expanded form."),
  }),
  fac("a1", "application", "squares", 3, 60, {
    title: "Factoring a number",
    requires: ["nt.primes"],
    prompt: "What is the largest prime factor of $2^{12} - 1$?",
    interaction: { kind: "numeric", answer: "13", slips: [slip(4095, "4095 is the number itself, and it is not prime: it ends in 5."), slip(7, "7 is a prime factor (from 63), but $2^6 + 1 = 65$ contributes a larger one.")] },
    hint: "$2^{12}$ is a square: it is $(2^6)^2$.",
    feedback: { correct: "$2^{12} - 1 = (2^6 - 1)(2^6 + 1) = 63 \\cdot 65$, and the pieces are easy to factor.", incorrect: "Treat it as a difference of squares: $(2^6)^2 - 1^2 = (2^6 - 1)(2^6 + 1) = 63 \\cdot 65$. Then factor 63 and 65." },
    explanation: { summary: "$2^{12} - 1 = (2^6 - 1)(2^6 + 1) = 63 \\cdot 65 = (3^2 \\cdot 7)(5 \\cdot 13)$. The largest prime factor is 13." },
    takeaway: "Factoring patterns work on numbers too: they break a big number into pieces you can handle.",
    whenToUse: "Finding factors of numbers written as a power plus or minus 1.",
    verification: COMPUTED("Factors 4095 by trial division."),
  }),
  fac("v1", "variation", "common", 3, 60, {
    title: "Two patterns in one",
    prompt: "Factor completely: $3x^3 - 12x$",
    interaction: { kind: "expression", answer: "3x(x-2)(x+2)", vars: ["x"], form: "factored" },
    hint: "Take out the common factor, then look again at what is left in the bracket.",
    feedback: { correct: "Common factor first, then the bracket turned out to be a difference of squares.", incorrect: "Start with the common factor $3x$. Then check the bracket: is it one of the patterns you know?" },
    explanation: { summary: "$3x^3 - 12x = 3x(x^2 - 4)$, and $x^2 - 4 = (x - 2)(x + 2)$. Completely factored: $3x(x - 2)(x + 2)$." },
    takeaway: "After every factoring step, look at each bracket again. \"Completely\" means no bracket can be split further.",
    whenToUse: "Any instruction to factor completely.",
    verification: COMPUTED("The key is expanded and compared, exactly, with an independently written expanded form; completeness is checked symbolically."),
  }),
  fac("v2", "variation", "sum-product", 3, 55, {
    title: "Sum and product, backwards",
    prompt: "$x^2 + bx + 12$ factors as $(x + p)(x + q)$, where $p$ and $q$ are positive whole numbers. How many different values of $b$ are possible?",
    interaction: { kind: "numeric", answer: "3", slips: [slip(6, "$p = 3, q = 4$ and $p = 4, q = 3$ give the same $b$. Count values of $b$, not ordered pairs.")] },
    hint: "$pq = 12$ and $b = p + q$. List the pairs.",
    feedback: { correct: "The pairs $1 \\cdot 12$, $2 \\cdot 6$, $3 \\cdot 4$ give $b = 13, 8, 7$.", incorrect: "$p$ and $q$ multiply to 12, and $b$ is their sum. List the factor pairs of 12 and add each pair." },
    explanation: { summary: "The factor pairs of 12 are $1 \\cdot 12$, $2 \\cdot 6$ and $3 \\cdot 4$, giving $b = 13$, 8 and 7. That is 3 values." },
    takeaway: "The same relationship (sum = b, product = c) can be run in either direction.",
    whenToUse: "Problems that ask which coefficients make a quadratic factorable.",
    verification: COMPUTED("Searches all positive pairs (p, q) with pq = 12 and counts distinct sums."),
  }),

  // ---------------------------------------------------------------- sum and product of roots
  vi("i1", "insight", "read", 2, 40, {
    title: "What the coefficients already know",
    prompt: "$(x - 3)(x - 5) = x^2 - 8x + 15$. The roots are 3 and 5; notice $3 + 5 = 8$ and $3 \\cdot 5 = 15$. Without solving, what do the roots of $x^2 - 10x + 21 = 0$ add up to?",
    interaction: { kind: "numeric", answer: "10", slips: [slip(-10, "The coefficient is $-10$, and the sum of the roots is its opposite."), slip(21, "21 is the product of the roots. The sum comes from the $x$ coefficient.")] },
    feedback: { correct: "The roots are 3 and 7, but you did not need to find them.", incorrect: "Compare with $(x - r)(x - s) = x^2 - (r + s)x + rs$: the $x$ coefficient is minus the sum of the roots." },
    explanation: { summary: "Any quadratic with roots $r$ and $s$ and leading coefficient 1 is $(x - r)(x - s) = x^2 - (r + s)x + rs$. Matching with $x^2 - 10x + 21$: $r + s = 10$ and $rs = 21$." },
    takeaway: "For x² + bx + c = 0: the roots add to −b and multiply to c.",
    whenToUse: "Any question about the roots of a quadratic that does not ask for the roots themselves.",
    verification: COMPUTED("Computes the roots exactly and adds them."),
  }),
  vi("t1", "technique", "build", 3, 60, {
    title: "Rebuild it from sum and product",
    teach: {
      body: "If a question asks for an expression in the two roots, rewrite the expression using only $r + s$ and $rs$. Then read those two numbers from the coefficients. The roots can be ugly; you never meet them.",
      steps: [
        "Roots of $x^2 - 5x + 3 = 0$ are $r$ and $s$. Find $r^2 + s^2$.",
        "From the coefficients: $r + s = 5$ and $rs = 3$.",
        "$(r + s)^2 = r^2 + 2rs + s^2$, so $r^2 + s^2 = (r + s)^2 - 2rs$.",
        "$r^2 + s^2 = 25 - 6 = 19$.",
      ],
    },
    prompt: "The roots of $x^2 - 6x + 4 = 0$ are $r$ and $s$. Find $r^2 + s^2$.",
    interaction: { kind: "numeric", answer: "28", slips: [slip(36, "$(r + s)^2 = 36$ also contains the cross term $2rs$. Subtract it."), slip(32, "The cross term is $2rs$, not $rs$: subtract $2 \\cdot 4$.")] },
    feedback: { correct: "$(r + s)^2 - 2rs = 36 - 8$.", incorrect: "$r + s = 6$ and $rs = 4$. Then $r^2 + s^2 = (r + s)^2 - 2rs$." },
    explanation: { summary: "$r + s = 6$ and $rs = 4$, so $r^2 + s^2 = (r + s)^2 - 2rs = 36 - 8 = 28$. (The roots are $3 \\pm \\sqrt{5}$, which you never needed.)" },
    takeaway: "r² + s² = (r + s)² − 2rs. Express what you want through the sum and the product.",
    whenToUse: "Symmetric expressions in the roots: squares, reciprocals, products like (r + 1)(s + 1).",
    verification: COMPUTED("Computes r² + s² with exact arithmetic on numbers of the form a + b√d."),
  }),
  vi("r1", "recognition", "build", 3, 40, {
    title: "Choosing the first move",
    prompt: "The roots of $x^2 - 7x + 5 = 0$ are $r$ and $s$, and you need $\\frac{1}{r} + \\frac{1}{s}$. Which first move is most promising?",
    interaction: {
      kind: "choice", answer: "combine",
      options: [
        opt("combine", "Combine the fractions into $\\frac{r + s}{rs}$", "Then both the top and the bottom can be read straight from the coefficients."),
        opt("solve", "Find $r$ and $s$ with the quadratic formula", "That works, but the roots contain $\\sqrt{29}$ and you would have to add reciprocals of them. There is a route with no square roots at all."),
        opt("guess", "Look for whole-number roots", "No two whole numbers multiply to 5 and add to 7, so the roots are not whole numbers."),
      ],
    },
    feedback: { correct: "Once it is written with $r + s$ and $rs$, the coefficients give the answer.", incorrect: "The expression is symmetric in $r$ and $s$, so it can be written using only $r + s$ and $rs$." },
    explanation: { summary: "$\\frac{1}{r} + \\frac{1}{s} = \\frac{r + s}{rs} = \\frac{7}{5}$. No roots were computed." },
    takeaway: "If swapping r and s leaves an expression unchanged, it can be rebuilt from r + s and rs.",
    whenToUse: "Before reaching for the quadratic formula: check whether the question is symmetric in the roots.",
    verification: REASONED("Approach comparison. The value 7/5 quoted in the explanation is recomputed exactly by the verifier for this card."),
  }),
  vi("a2", "application", "read", 2, 40, {
    title: "A leading coefficient",
    prompt: "What is the product of the roots of $2x^2 - 9x + 6 = 0$?",
    interaction: { kind: "numeric", answer: "3", slips: [slip(6, "The rule \"product = constant term\" needs a leading coefficient of 1. Divide the whole equation by 2 first.")] },
    hint: "Divide the equation by 2 so that it starts with $x^2$.",
    feedback: { correct: "Dividing by 2 gives $x^2 - \\frac{9}{2}x + 3 = 0$, and the constant term is the product.", incorrect: "Make the leading coefficient 1 first: $x^2 - \\frac{9}{2}x + 3 = 0$. Now the constant term is the product of the roots." },
    explanation: { summary: "Dividing by 2: $x^2 - \\frac{9}{2}x + 3 = 0$. The product of the roots is the constant term, 3. In general, for $ax^2 + bx + c = 0$ the product is $\\frac{c}{a}$." },
    takeaway: "For ax² + bx + c = 0: sum of roots = −b/a, product = c/a. Divide by a first.",
    whenToUse: "Quadratics whose leading coefficient is not 1.",
    verification: COMPUTED("Computes the product of the roots with exact arithmetic on numbers of the form a + b√d."),
  }),
  vi("a1", "application", "build", 3, 60, {
    title: "A product of shifted roots",
    prompt: "The roots of $x^2 + 4x - 7 = 0$ are $r$ and $s$. What is $(r + 1)(s + 1)$?",
    interaction: { kind: "numeric", answer: "-10", slips: [slip(-2, "The sum of the roots is $-4$, not $+4$: it is the opposite of the $x$ coefficient."), slip(-11, "Don't forget the $+1$ at the end: $(r+1)(s+1) = rs + (r + s) + 1$.")] },
    hint: "Multiply out $(r + 1)(s + 1)$ and group the terms into $rs$ and $r + s$.",
    feedback: { correct: "$rs + (r + s) + 1 = -7 - 4 + 1$.", incorrect: "Expand: $(r + 1)(s + 1) = rs + (r + s) + 1$, with $r + s = -4$ and $rs = -7$." },
    explanation: { summary: "$(r + 1)(s + 1) = rs + (r + s) + 1 = -7 + (-4) + 1 = -10$." },
    takeaway: "Expand first, then group into (sum) and (product) and substitute.",
    whenToUse: "Products or sums built from shifted or scaled roots.",
    verification: COMPUTED("Computes (r + 1)(s + 1) with exact arithmetic on numbers of the form a + b√d."),
  }),
  vi("v1", "variation", "reverse", 3, 55, {
    title: "A missing coefficient",
    prompt: "One root of $x^2 - 12x + k = 0$ is twice the other. What is $k$?",
    interaction: { kind: "numeric", answer: "32", slips: [slip(8, "8 is the larger root. $k$ is the product of the two roots."), slip(4, "4 is the smaller root. $k$ is the product of the two roots.")] },
    hint: "Call the roots $r$ and $2r$. What must they add up to?",
    feedback: { correct: "The roots add to 12, so they are 4 and 8, and $k$ is their product.", incorrect: "Call the roots $r$ and $2r$. Their sum is 12, so $r = 4$. Then $k$ is the product of the roots." },
    explanation: { summary: "Roots $r$ and $2r$ add to 12, so $r = 4$ and the roots are 4 and 8. Their product is $k = 32$." },
    takeaway: "Sum and product work in reverse: information about the roots pins down the coefficients.",
    whenToUse: "Finding an unknown coefficient from a relationship between the roots.",
    verification: COMPUTED("Searches integer k for a quadratic whose roots are in ratio 2 : 1."),
  }),
  vi("v2", "variation", "reverse", 3, 55, {
    title: "Mind the sign",
    prompt: "The roots of $x^2 + bx + 20 = 0$ are positive whole numbers that differ by 1. What is $b$?",
    interaction: { kind: "numeric", answer: "-9", slips: [slip(9, "The roots add to 9, and the sum of the roots is $-b$. So $b$ is negative.")] },
    hint: "Which two consecutive whole numbers multiply to 20?",
    feedback: { correct: "The roots are 4 and 5; their sum is 9, and $b$ is the opposite of the sum.", incorrect: "The roots multiply to 20 and differ by 1, so they are 4 and 5. Their sum equals $-b$." },
    explanation: { summary: "Two consecutive whole numbers with product 20 are 4 and 5. Sum of roots $= 9 = -b$, so $b = -9$. Check: $(x - 4)(x - 5) = x^2 - 9x + 20$." },
    takeaway: "Sum of roots is −b, not b. Positive roots mean a negative middle coefficient.",
    whenToUse: "Every use of sum-of-roots: check the sign.",
    verification: COMPUTED("Searches integer b for a quadratic with positive integer roots differing by 1 and product 20."),
  }),

  // ---------------------------------------------------------------- arithmetic sequences
  seq("i1", "insight", "sum", 1, 40, {
    title: "Pair the ends",
    prompt: "To add $1 + 2 + 3 + \\dots + 100$, pair the first with the last: $1 + 100$, then $2 + 99$, then $3 + 98$, and so on. Every pair makes 101. What is the total?",
    interaction: { kind: "numeric", answer: "5050", slips: [slip(10100, "100 numbers make 50 pairs, not 100."), slip(5000, "Each pair makes 101, not 100.")] },
    feedback: { correct: "50 pairs, each worth 101.", incorrect: "100 numbers form 50 pairs, and each pair adds to 101." },
    explanation: { summary: "There are 100 numbers, so 50 pairs, each with sum 101: $50 \\cdot 101 = 5050$. Put another way: the average of the numbers is $\\frac{1 + 100}{2}$, and there are 100 of them." },
    takeaway: "Sum of an evenly spaced list = (number of terms) × (average of first and last).",
    whenToUse: "Adding any evenly spaced list of numbers.",
    verification: COMPUTED("Adds 1 through 100 in a loop."),
  }),
  seq("t1", "technique", "count", 2, 50, {
    title: "Count the gaps",
    teach: {
      body: "To count the terms of an evenly spaced list, count the steps from the first term to the last, then add 1. (Fence posts: 5 gaps need 6 posts.)",
      steps: [
        "How many terms in $7, 11, 15, \\dots, 83$?",
        "Total distance: $83 - 7 = 76$. Each step is 4.",
        "Steps: $76 \\div 4 = 19$.",
        "Terms: $19 + 1 = 20$.",
      ],
    },
    prompt: "How many terms are in the list $5, 8, 11, \\dots, 62$?",
    interaction: { kind: "numeric", answer: "20", slips: [slip(19, "19 is the number of steps. There is one more term than there are steps.")] },
    feedback: { correct: "19 steps of 3 from 5 to 62, so 20 terms.", incorrect: "Distance $62 - 5 = 57$, step 3, so 19 steps. Then add 1 for the starting term." },
    explanation: { summary: "$62 - 5 = 57$ and $57 \\div 3 = 19$ steps, so there are $19 + 1 = 20$ terms." },
    takeaway: "Number of terms = (last − first) ÷ step + 1.",
    whenToUse: "Before summing a list, and whenever you count evenly spaced things.",
    verification: COMPUTED("Generates the list and counts it."),
  }),
  seq("r1", "recognition", "middle", 2, 40, {
    title: "The fastest way in",
    prompt: "Seven consecutive odd numbers add up to 133. Which fact gets you the middle number in a single step?",
    interaction: {
      kind: "choice", answer: "average",
      options: [
        opt("average", "The sum equals 7 times the middle number", "The numbers are balanced around the middle one, so it is their average: $133 \\div 7$."),
        opt("ends", "The first and the last add up to 133", "The first and last add up to twice the middle number, not to the whole sum."),
        opt("expand", "Call the first number $x$ and add up seven expressions", "That works, but it takes several steps and then you still have to walk to the middle."),
      ],
    },
    feedback: { correct: "Evenly spaced numbers balance around their middle, so the middle is the average.", incorrect: "In an evenly spaced list with an odd number of terms, the middle term is the average of all of them." },
    explanation: { summary: "The numbers are $m - 6, m - 4, m - 2, m, m + 2, m + 4, m + 6$. The offsets cancel, so the sum is $7m = 133$ and $m = 19$." },
    takeaway: "In an evenly spaced list with an odd number of terms, the middle term is the average: sum = count × middle.",
    whenToUse: "Sums of consecutive (or consecutive odd/even) numbers with the total given.",
    verification: REASONED("Approach comparison. The value 19 quoted in the explanation is recomputed by the verifier for this card."),
  }),
  seq("a1", "application", "term", 3, 55, {
    title: "From two terms to any term",
    prompt: "In an arithmetic sequence, the 4th term is 17 and the 10th term is 41. What is the 20th term?",
    interaction: { kind: "numeric", answer: "81", slips: [slip(77, "From the 10th term to the 20th is 10 steps, not 9."), slip(97, "The step is 4, not 24 ÷ 5: from the 4th term to the 10th is 6 steps.")] },
    hint: "How many steps is it from the 4th term to the 10th? How much did the sequence rise over those steps?",
    feedback: { correct: "6 steps raise it by 24, so each step is 4; ten more steps from 41 reach 81.", incorrect: "From the 4th to the 10th term is 6 steps and a rise of 24, so each step is 4. Then go 10 steps on from the 10th term." },
    explanation: { summary: "Six steps add $41 - 17 = 24$, so the common difference is 4. The 20th term is 10 steps after the 10th: $41 + 10 \\cdot 4 = 81$." },
    takeaway: "Move between terms by counting steps: difference in value = (number of steps) × (step size).",
    whenToUse: "Whenever two terms of an evenly spaced sequence are known.",
    verification: COMPUTED("Builds the sequence from the two given terms and reads off the 20th."),
  }),
  seq("a2", "application", "sum", 3, 60, {
    title: "Count, then sum",
    prompt: "What is $3 + 7 + 11 + \\dots + 79$?",
    interaction: { kind: "numeric", answer: "820", slips: [slip(779, "There are 20 terms, not 19: the number of terms is one more than the number of steps."), slip(1640, "Multiply the number of terms by the average of first and last, which is 41, not by their sum.")] },
    hint: "First count the terms. Then use (number of terms) × (average of first and last).",
    feedback: { correct: "20 terms with average 41.", incorrect: "Count first: $(79 - 3) \\div 4 = 19$ steps, so 20 terms. The average of first and last is 41." },
    explanation: { summary: "Steps: $(79 - 3) \\div 4 = 19$, so 20 terms. Average of first and last: $\\frac{3 + 79}{2} = 41$. Sum: $20 \\cdot 41 = 820$." },
    takeaway: "Summing an evenly spaced list takes two numbers: how many terms, and the average of the ends.",
    whenToUse: "Any sum written with \"…\" between evenly spaced terms.",
    verification: COMPUTED("Adds the terms in a loop."),
  }),
  seq("v1", "variation", "middle", 3, 50, {
    title: "Not the middle this time",
    prompt: "Five consecutive even numbers add up to 320. What is the **largest** of them?",
    interaction: { kind: "numeric", answer: "68", slips: [slip(64, "64 is the middle number. The question asks for the largest, two steps of 2 above it."), slip(66, "The numbers are even, so they go up in steps of 2: the largest is two steps above the middle.")] },
    hint: "Find the middle number first.",
    feedback: { correct: "The middle is $320 \\div 5 = 64$, and the largest is two steps of 2 above it.", incorrect: "The middle number is the average, $320 \\div 5 = 64$. The numbers are 60, 62, 64, 66, 68." },
    explanation: { summary: "The middle number is $320 \\div 5 = 64$, so the five numbers are 60, 62, 64, 66, 68. The largest is 68." },
    takeaway: "Find the middle from the average, then walk to the term the question actually asks for.",
    whenToUse: "Consecutive-number problems that ask for the first or last term.",
    verification: COMPUTED("Searches for five consecutive even numbers with sum 320."),
  }),
  seq("v2", "variation", "sum", 4, 60, {
    title: "The sum, backwards",
    prompt: "$1 + 2 + 3 + \\dots + n = 210$. What is $n$?",
    interaction: { kind: "numeric", answer: "20", slips: [slip(21, "$n(n+1) = 420$ has $n = 20$ and $n + 1 = 21$. The last number added is the smaller of the two.")] },
    hint: "The sum is $n$ terms with average $\\frac{n + 1}{2}$, so $n(n + 1) = 420$.",
    feedback: { correct: "$n(n + 1) = 420 = 20 \\cdot 21$.", incorrect: "The sum is $\\frac{n(n + 1)}{2}$, so $n(n + 1) = 420$. Look for two consecutive numbers near $\\sqrt{420}$." },
    explanation: { summary: "$\\frac{n(n + 1)}{2} = 210$ gives $n(n + 1) = 420$. Since $20^2 = 400$, try $20 \\cdot 21 = 420$. So $n = 20$." },
    takeaway: "1 + 2 + … + n = n(n + 1)/2. When the total is given, look for two consecutive numbers with the right product.",
    whenToUse: "Triangular-number totals: handshakes, stacked rows, running sums.",
    verification: COMPUTED("Adds 1, 2, 3, … until the total reaches 210."),
  }),
];

export const FAMILIES: CardFamily[] = [
  family("alg.factoring", "f-squares", "application", "squares", 2, (r) => {
    const total = r.pick([100, 200, 1000]);
    const b = r.int(3, total / 2 - 10);
    const a = total - b;
    return {
      params: { a, b }, seconds: 40,
      title: "No squaring required",
      prompt: `Find $${a}^2 - ${b}^2$ without squaring either number.`,
      interaction: { kind: "numeric", answer: String((a - b) * total) },
      hint: "A difference of two squares is (difference) × (sum).",
      feedback: { correct: `$(${a} - ${b})(${a} + ${b}) = ${a - b} \\cdot ${total}$.`, incorrect: `Use $A^2 - B^2 = (A - B)(A + B)$: here the sum is ${total} and the difference is ${a - b}.` },
      explanation: { summary: `$${a}^2 - ${b}^2 = (${a} - ${b})(${a} + ${b}) = ${a - b} \\cdot ${total} = ${(a - b) * total}$.` },
      takeaway: "A² − B² = (A − B)(A + B): a difference of two squares is a product in disguise.",
      whenToUse: "Two squares with a minus between them, in algebra or in arithmetic.",
    };
  }),
  family("alg.vieta", "f-squares", "application", "build", 3, (r) => {
    const p = r.int(4, 9);
    const q = r.int(1, Math.floor((p * p) / 4) - 1);
    return {
      params: { p, q }, seconds: 55,
      title: "Squares of the roots",
      prompt: `The roots of $x^2 - ${p}x + ${q} = 0$ are $r$ and $s$. Find $r^2 + s^2$.`,
      interaction: { kind: "numeric", answer: String(p * p - 2 * q), slips: [slip(p * p, "$(r + s)^2$ also contains the cross term $2rs$. Subtract it.")] },
      hint: "Start from $(r + s)^2 = r^2 + 2rs + s^2$.",
      feedback: { correct: "$(r + s)^2 - 2rs$, with both numbers read from the coefficients.", incorrect: `$r + s = ${p}$ and $rs = ${q}$. Then $r^2 + s^2 = (r + s)^2 - 2rs$.` },
      explanation: { summary: `$r + s = ${p}$ and $rs = ${q}$, so $r^2 + s^2 = (r + s)^2 - 2rs = ${p * p} - ${2 * q} = ${p * p - 2 * q}$.` },
      takeaway: "r² + s² = (r + s)² − 2rs. Express what you want through the sum and the product.",
      whenToUse: "Symmetric expressions in the roots.",
    };
  }),
  family("alg.arith-seq", "f-sum", "application", "sum", 3, (r) => {
    const d = r.int(2, 6);
    const first = r.int(1, 9);
    const n = r.int(6, 12) * 2;
    const last = first + (n - 1) * d;
    const sum = (n * (first + last)) / 2;
    return {
      params: { first, d, last }, seconds: 60,
      title: "Count, then sum",
      prompt: `What is $${first} + ${first + d} + ${first + 2 * d} + \\dots + ${last}$?`,
      interaction: { kind: "numeric", answer: String(sum), slips: [slip(((n - 1) * (first + last)) / 2, `There are ${n} terms, not ${n - 1}: one more than the number of steps.`)].filter((s) => Number.isInteger(Number(s.answer))) },
      hint: "First count the terms. Then use (number of terms) × (average of first and last).",
      feedback: { correct: `${n} terms with average $\\frac{${first} + ${last}}{2}$.`, incorrect: `Count first: $(${last} - ${first}) \\div ${d} = ${n - 1}$ steps, so ${n} terms. Then multiply by the average of the first and last terms.` },
      explanation: { summary: `Steps: $(${last} - ${first}) \\div ${d} = ${n - 1}$, so ${n} terms. Half of ${n} is ${n / 2} pairs, each with sum ${first + last}: $${n / 2} \\cdot ${first + last} = ${sum}$.` },
      takeaway: "Summing an evenly spaced list takes two numbers: how many terms, and the average of the ends.",
      whenToUse: "Any sum written with \"…\" between evenly spaced terms.",
    };
  }),
];
