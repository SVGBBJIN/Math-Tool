// Number theory cards: divisibility, prime factorization, remainders, repeating patterns.
import type { Card, CardFamily } from "../cards/types";
import { COMPUTED, REASONED, family, forConcept, opt, slip } from "./author";

const div = forConcept("nt.divisibility");
const pr = forConcept("nt.primes");
const rem = forConcept("nt.remainders");
const cyc = forConcept("nt.cycles");

export const CARDS: Card[] = [
  // ---------------------------------------------------------------- multiples and divisibility
  div("i1", "insight", "consecutive", 1, 30, {
    title: "Three in a row",
    prompt: "Add any three whole numbers in a row: $4 + 5 + 6 = 15$, $10 + 11 + 12 = 33$. Both sums are multiples of 3. Is that a coincidence?",
    interaction: {
      kind: "choice", answer: "always",
      options: [
        opt("always", "It always happens", "Right, and the reason is worth more than the fact."),
        opt("sometimes", "Only for some starting numbers", "Try a few more: $1+2+3$, $7+8+9$, $20+21+22$. It never fails, and there is a reason."),
        opt("first", "Only when the first number is a multiple of 3", "$4+5+6 = 15$ already breaks that rule: 4 is not a multiple of 3."),
      ],
    },
    feedback: { correct: "It always happens.", incorrect: "It always happens, and one line of algebra shows why." },
    explanation: {
      summary: "Call the middle number $n$. The three numbers are $n-1$, $n$ and $n+1$, and the $-1$ and $+1$ cancel: the sum is $3n$, which is 3 times a whole number.",
      steps: ["$(n-1) + n + (n+1) = 3n$", "$3n$ is a multiple of 3 for every whole number $n$."],
    },
    takeaway: "Name consecutive numbers around the middle one: three in a row add up to 3 × the middle.",
    whenToUse: "Any sum of consecutive integers, and any claim that something is \"always divisible by\" a number.",
    verification: COMPUTED("Checks the sum of every run of three consecutive integers up to 500."),
  }),
  div("t1", "technique", "form", 1, 45, {
    title: "Write it as d × something",
    teach: {
      body: "\"Divisible by $d$\" means \"equals $d$ times a whole number\". To show something is always divisible by $d$, rewrite it until a factor of $d$ is standing out in front.",
      steps: [
        "Claim: the sum of two odd numbers is even.",
        "Odd numbers look like $2a+1$ and $2b+1$.",
        "Their sum is $2a + 2b + 2 = 2(a+b+1)$.",
        "That is 2 times a whole number, so it is even. No examples needed.",
      ],
    },
    prompt: "Your turn. Fill in the reasoning for why $n^2 + n$ is never odd.",
    interaction: {
      kind: "blanks",
      text: "$n^2 + n = n(n+1)$, a product of two consecutive numbers. One of them must be even, so the product is a multiple of {{0}}. Check with $n = 7$: $7 \\cdot 8 =$ {{1}}.",
      blanks: [{ answer: "2" }, { answer: "56", slips: [slip(49, "That is $7^2$ alone. The expression is $7^2 + 7$, which is $7 \\cdot 8$.")] }],
    },
    feedback: {
      correct: "Factoring exposed two consecutive numbers, and one of any two consecutive numbers is even.",
      incorrect: "Of two numbers in a row, exactly one is even, so their product is a multiple of 2. With $n = 7$ the product is $7 \\cdot 8 = 56$.",
    },
    explanation: { summary: "Factoring turned a sum into a product, and products show their divisors. $n(n+1)$ always contains an even factor, so it is a multiple of 2; for $n = 7$ it is 56." },
    takeaway: "To prove \"always divisible by d\", rewrite the expression as d × (a whole number).",
    whenToUse: "Questions that say \"for every integer n\" or ask which number must divide an expression.",
    verification: COMPUTED("Checks n² + n is even for n up to 500 and evaluates 7·8."),
  }),
  div("t2", "technique", "digits", 2, 45, {
    title: "The digit-sum test",
    teach: {
      body: "A number and the sum of its digits leave the same remainder when divided by 9 (and by 3). The reason: 10, 100, 1000, … are each 1 more than a multiple of 9.",
      steps: [
        "$372 = 3 \\cdot 100 + 7 \\cdot 10 + 2$",
        "$= 3 \\cdot 99 + 7 \\cdot 9 + (3 + 7 + 2)$",
        "The first two pieces are multiples of 9, so only $3 + 7 + 2 = 12$ matters.",
        "12 is a multiple of 3 but not of 9, and the same is true of 372.",
      ],
    },
    prompt: "The digits of $58,317$ add up to 24. What does that tell you?",
    interaction: {
      kind: "choice", answer: "three",
      options: [
        opt("three", "It is a multiple of 3 but not of 9"),
        opt("both", "It is a multiple of both 3 and 9", "24 is not a multiple of 9, so neither is the number."),
        opt("neither", "It is a multiple of neither", "24 is a multiple of 3, so the number is too."),
      ],
    },
    feedback: { correct: "24 is $3 \\cdot 8$ but not a multiple of 9, and the number behaves exactly like its digit sum.", incorrect: "The number has the same remainders as its digit sum, 24. Test 24 instead of 58,317." },
    explanation: { summary: "Since $24 = 3 \\cdot 8$, the number is a multiple of 3. Since 24 leaves remainder 6 when divided by 9, so does 58,317: it is not a multiple of 9." },
    takeaway: "For divisibility by 3 or 9, test the digit sum instead of the number.",
    whenToUse: "Large numbers, missing-digit puzzles, and any question about multiples of 3 or 9.",
    verification: COMPUTED("Computes 58317 mod 3 and mod 9 directly."),
  }),
  div("r1", "recognition", "consecutive", 2, 40, {
    title: "Always a multiple of 3?",
    prompt: "Which of these are multiples of 3 for **every** whole number $n$?",
    interaction: {
      kind: "multi", answers: ["sum", "product", "spaced"],
      options: [
        opt("sum", "$n + (n+1) + (n+2)$", "This is $3n + 3 = 3(n+1)$: always a multiple of 3."),
        opt("product", "$n(n+1)(n+2)$", "Three numbers in a row always include a multiple of 3, so their product is one too."),
        opt("spaced", "$n + (n+2) + (n+4)$", "This is $3n + 6 = 3(n+2)$: always a multiple of 3."),
        opt("pair", "$n(n+2)$", "Try $n = 2$: $2 \\cdot 4 = 8$, not a multiple of 3."),
      ],
    },
    hint: "Three numbers in a row always contain exactly one multiple of 3. Which expressions are built from three in a row, or simplify to 3 × something?",
    feedback: {
      correct: "Two of them simplify to 3 × something, and the product contains a multiple of 3 among three consecutive numbers.",
      incorrect: "Check each one: does it simplify to 3 × something, or contain three numbers in a row? One counterexample is enough to reject an expression.",
    },
    explanation: {
      summary: "The two sums simplify to $3(n+1)$ and $3(n+2)$. The product of three consecutive numbers contains a multiple of 3. But $n(n+2)$ fails at $n = 2$.",
    },
    takeaway: "Any three consecutive integers contain exactly one multiple of 3, so their product is always divisible by 3.",
    whenToUse: "When an expression contains several consecutive integers multiplied or added together.",
    verification: COMPUTED("Tests each expression for n up to 300."),
  }),
  div("a1", "application", "count", 2, 30, {
    title: "Counting multiples",
    prompt: "How many multiples of 7 are there among the whole numbers from 1 to 200?",
    interaction: { kind: "numeric", answer: "28", slips: [slip(29, "$7 \\cdot 29 = 203$ is past 200. When counting multiples, the division rounds down.")] },
    hint: "The multiples are $7 \\cdot 1, 7 \\cdot 2, 7 \\cdot 3, \\dots$ What is the largest $k$ with $7k \\le 200$?",
    feedback: { correct: "The multiples are $7 \\cdot 1$ through $7 \\cdot 28$, so counting them is counting $k$ from 1 to 28.", incorrect: "List them as $7 \\cdot 1, 7 \\cdot 2, \\dots$ and find the last one that fits under 200." },
    explanation: { summary: "$200 \\div 7 = 28$ remainder 4, so the multiples are $7 \\cdot 1, \\dots, 7 \\cdot 28 = 196$. There are 28." },
    takeaway: "The number of multiples of d from 1 to N is N ÷ d, rounded down.",
    whenToUse: "Counting numbers in a range with a divisibility property.",
    verification: COMPUTED("Counts by looping over 1..200."),
  }),
  div("a2", "application", "count", 3, 45, {
    title: "A range that doesn't start at 1",
    prompt: "How many whole numbers from 100 to 300, inclusive, are multiples of 6?",
    interaction: {
      kind: "numeric", answer: "34",
      slips: [
        slip(33, "Dividing the width of the range by 6 can be off by one. Count the multiples up to 300, then remove the ones below 100."),
        slip(50, "That counts every multiple of 6 up to 300. The ones below 100 have to come out."),
      ],
    },
    hint: "Count the multiples of 6 up to 300, then subtract the multiples of 6 up to 99.",
    feedback: { correct: "Counting up to the top and removing what lies below the bottom avoids any off-by-one worry.", incorrect: "Use two counts that both start at 1: multiples up to 300, minus multiples up to 99." },
    explanation: { summary: "Up to 300 there are $300 \\div 6 = 50$ multiples. Up to 99 there are 16 (since $6 \\cdot 16 = 96$). So $50 - 16 = 34$.", steps: ["Multiples of 6 from 1 to 300: 50", "Multiples of 6 from 1 to 99: 16", "$50 - 16 = 34$"] },
    takeaway: "To count in a range from A to B, count up to B and subtract the count up to A − 1.",
    whenToUse: "Any count over a range that does not start at 1.",
    verification: COMPUTED("Counts by looping over 100..300."),
  }),
  div("v1", "variation", "consecutive", 3, 45, {
    title: "Does the pattern survive?",
    prompt: "Three numbers in a row always add up to a multiple of 3. Now take **four** in a row: $n + (n+1) + (n+2) + (n+3)$. What remainder does this sum leave when divided by 4?",
    interaction: { kind: "numeric", answer: "2", slips: [slip(0, "The pattern does not carry over. Simplify the sum and look at what is left after the multiple of 4.")] },
    hint: "Simplify the sum to the form $4n + \\text{something}$.",
    feedback: { correct: "The sum is $4n + 6$, and 6 leaves remainder 2: the sum of four in a row is never a multiple of 4.", incorrect: "The sum simplifies to $4n + 6$. The $4n$ part is a multiple of 4, so only the 6 matters." },
    explanation: { summary: "$n + (n+1) + (n+2) + (n+3) = 4n + 6 = 4(n+1) + 2$. The remainder is always 2, so four consecutive numbers never add to a multiple of 4." },
    takeaway: "Don't extend a pattern by analogy. Redo the algebra: an even count of consecutive numbers has no middle term.",
    whenToUse: "Whenever a familiar fact is being stretched to a new case.",
    verification: COMPUTED("Checks the remainder for every start up to 400."),
  }),

  // ---------------------------------------------------------------- prime factorization
  pr("i1", "insight", "squares", 2, 40, {
    title: "An odd number of divisors",
    prompt: "Divisors come in pairs. For 12: $1 \\times 12$, $2 \\times 6$, $3 \\times 4$, giving six divisors. Pair up the divisors of 36 the same way. How many divisors does 36 have?",
    interaction: { kind: "numeric", answer: "9", slips: [slip(10, "One of the pairs is $6 \\times 6$. That is a single divisor, not two."), slip(8, "Don't forget the pair $6 \\times 6$: 6 is a divisor too.")] },
    feedback: { correct: "Four ordinary pairs, plus 6 paired with itself.", incorrect: "The pairs are $1 \\times 36$, $2 \\times 18$, $3 \\times 12$, $4 \\times 9$ and $6 \\times 6$. The last one gives only one divisor." },
    explanation: { summary: "The pairs $1 \\times 36$, $2 \\times 18$, $3 \\times 12$, $4 \\times 9$ give eight divisors, and $6 \\times 6$ adds just one more: 9 in total. A divisor can only pair with itself when the number is a perfect square." },
    takeaway: "Divisors pair up, except a square root, which pairs with itself. Only perfect squares have an odd number of divisors.",
    whenToUse: "Questions about how many divisors a number has, or about numbers with an odd number of divisors.",
    verification: COMPUTED("Counts the divisors of 36 by trial division."),
  }),
  pr("t1", "technique", "divisors", 2, 60, {
    title: "Counting divisors without listing them",
    teach: {
      body: "Factor the number into primes. Every divisor is built by choosing how many copies of each prime to use. A prime with exponent $a$ offers $a + 1$ choices (use 0, 1, …, or $a$ copies). Multiply the choices.",
      steps: [
        "$72 = 2^3 \\cdot 3^2$",
        "Copies of 2 to use: 0, 1, 2 or 3. That is 4 choices.",
        "Copies of 3 to use: 0, 1 or 2. That is 3 choices.",
        "$4 \\cdot 3 = 12$ divisors.",
      ],
    },
    prompt: "Your turn, with 200.",
    interaction: {
      kind: "blanks",
      text: "$200 = 2^a \\cdot 5^b$ with $a =$ {{0}} and $b =$ {{1}}. So 200 has {{2}} divisors.",
      blanks: [{ answer: "3" }, { answer: "2" }, { answer: "12", slips: [slip(6, "Multiplying the exponents misses the option of leaving a prime out. Add 1 to each exponent first."), slip(5, "The choices for each prime are independent, so multiply them rather than add.")] }],
    },
    feedback: { correct: "$(3+1)(2+1) = 12$: each divisor is one choice of how many 2s and how many 5s to use.", incorrect: "$200 = 8 \\cdot 25 = 2^3 \\cdot 5^2$. Then add 1 to each exponent and multiply: $(3+1)(2+1)$." },
    explanation: { summary: "$200 = 2^3 \\cdot 5^2$. A divisor uses 0 to 3 twos (4 choices) and 0 to 2 fives (3 choices): $4 \\cdot 3 = 12$ divisors." },
    takeaway: "Number of divisors: add 1 to each exponent in the prime factorization, then multiply.",
    whenToUse: "Whenever a problem asks how many divisors (or factors) a number has.",
    verification: COMPUTED("Finds the exponents and the divisor count of 200 by trial division."),
  }),
  pr("r1", "recognition", "squares", 2, 35, {
    title: "Squares, read from the exponents",
    prompt: "Without multiplying anything out, which of these are perfect squares?",
    interaction: {
      kind: "multi", answers: ["a", "c"],
      options: [
        opt("a", "$2^4 \\cdot 3^2$", "Every exponent is even: it is $(2^2 \\cdot 3)^2$."),
        opt("b", "$2^3 \\cdot 5^2$", "The exponent of 2 is odd, so the 2s cannot be split into two equal groups."),
        opt("c", "$3^6 \\cdot 7^2$", "Every exponent is even: it is $(3^3 \\cdot 7)^2$."),
        opt("d", "$2^2 \\cdot 3^2 \\cdot 5$", "The lone 5 has exponent 1, which is odd."),
      ],
    },
    feedback: { correct: "A square is something times itself, so every prime has to appear an even number of times.", incorrect: "Squaring doubles every exponent, so a perfect square has only even exponents. Check each exponent, including a hidden exponent of 1." },
    explanation: { summary: "$2^4 \\cdot 3^2 = (2^2 \\cdot 3)^2$ and $3^6 \\cdot 7^2 = (3^3 \\cdot 7)^2$. The other two each contain a prime with an odd exponent." },
    takeaway: "A number is a perfect square exactly when every exponent in its prime factorization is even.",
    whenToUse: "Deciding whether a product is a square, or what is missing for it to become one.",
    verification: COMPUTED("Evaluates each product and tests whether its integer square root is exact."),
  }),
  pr("a3", "application", "factor", 2, 45, {
    title: "Down to primes",
    prompt: "What is the sum of the distinct prime factors of 420?",
    interaction: { kind: "numeric", answer: "17", slips: [slip(19, "The prime 2 appears twice in 420, but \"distinct\" means each prime is counted once."), slip(10, "There is one more prime: $420 = 2^2 \\cdot 3 \\cdot 5 \\cdot 7$.")] },
    hint: "Peel off small primes one at a time: $420 = 2 \\cdot 210 = \\dots$",
    feedback: { correct: "$420 = 2^2 \\cdot 3 \\cdot 5 \\cdot 7$, and each prime counts once.", incorrect: "Break 420 down completely: $420 = 42 \\cdot 10 = (2 \\cdot 3 \\cdot 7)(2 \\cdot 5)$." },
    explanation: { summary: "$420 = 42 \\cdot 10 = 2^2 \\cdot 3 \\cdot 5 \\cdot 7$. The distinct primes are 2, 3, 5 and 7, with sum 17." },
    takeaway: "Factor in convenient chunks (42 × 10), then break each chunk into primes.",
    whenToUse: "Any time a problem mentions factors, divisors, squares or common multiples of a specific number.",
    verification: COMPUTED("Factors 420 by trial division and adds the distinct primes."),
  }),
  pr("a1", "application", "divisors", 3, 45, {
    title: "How many divisors?",
    prompt: "How many positive divisors does 360 have?",
    interaction: { kind: "numeric", answer: "24", slips: [slip(6, "Multiplying the exponents leaves out the choice of using none of a prime. Add 1 to each exponent first."), slip(12, "Check the factorization: $360 = 2^3 \\cdot 3^2 \\cdot 5$, and the 5 contributes a factor of 2 to the count.")] },
    hint: "Start from $360 = 36 \\cdot 10$ and factor each part.",
    feedback: { correct: "$360 = 2^3 \\cdot 3^2 \\cdot 5$, giving $4 \\cdot 3 \\cdot 2$ ways to build a divisor.", incorrect: "Factor first: $360 = 2^3 \\cdot 3^2 \\cdot 5$. Then each prime offers (exponent + 1) choices." },
    explanation: { summary: "$360 = 2^3 \\cdot 3^2 \\cdot 5^1$, so the number of divisors is $(3+1)(2+1)(1+1) = 24$." },
    takeaway: "A prime that appears once still doubles the number of divisors: its choices are \"use it\" or \"don't\".",
    whenToUse: "Divisor counts for numbers too large to list by hand.",
    verification: COMPUTED("Counts the divisors of 360 by trial division."),
  }),
  pr("t2", "technique", "build", 3, 50, {
    title: "Completing a square",
    teach: {
      body: "To turn a number into a perfect square by multiplying, fix the exponents: every prime needs an even exponent, so each prime with an odd exponent needs exactly one more copy.",
    },
    prompt: "Put the steps in order to find the smallest $k$ that makes $60k$ a perfect square.",
    interaction: {
      kind: "order",
      items: [
        opt("factor", "Factor: $60 = 2^2 \\cdot 3 \\cdot 5$", "Nothing can be decided before the number is in prime factors."),
        opt("odd", "Spot the odd exponents: 3 and 5 each appear once", "Once it is factored, look for the primes whose exponents are odd."),
        opt("fix", "Supply one more of each: $k = 3 \\cdot 5 = 15$", "Each odd exponent needs one more copy of that prime."),
        opt("check", "Check: $60 \\cdot 15 = 900 = 30^2$", "The check comes last."),
      ],
    },
    feedback: { correct: "Factor, find what is unbalanced, supply exactly what is missing, check.", incorrect: "The order is: factor, spot the odd exponents, supply one more of each, then check." },
    explanation: { summary: "$60 = 2^2 \\cdot 3 \\cdot 5$. The exponents of 3 and 5 are odd, so $k$ must contribute one 3 and one 5: $k = 15$, and $60 \\cdot 15 = 900 = 30^2$." },
    takeaway: "To reach a perfect square, multiply by each prime that has an odd exponent, once.",
    whenToUse: "\"Smallest number to multiply by so that the result is a perfect square (or cube)\".",
    verification: REASONED("The order is the logical dependency of the steps; the arithmetic (60 = 2²·3·5, 60·15 = 900 = 30²) is rechecked by the verifier for nt.primes.a2."),
  }),
  pr("a2", "application", "build", 3, 45, {
    title: "The smallest multiplier",
    prompt: "What is the smallest positive integer $k$ for which $84k$ is a perfect square?",
    interaction: { kind: "numeric", answer: "21", slips: [slip(84, "$84 \\cdot 84$ is a square, but a smaller $k$ works. Only the primes with odd exponents need help.")] },
    hint: "$84 = 2^2 \\cdot 3 \\cdot 7$. Which exponents are odd?",
    feedback: { correct: "Only 3 and 7 had odd exponents, so $k$ supplies one of each.", incorrect: "$84 = 2^2 \\cdot 3 \\cdot 7$. The 2s are already paired; 3 and 7 each need one partner." },
    explanation: { summary: "$84 = 2^2 \\cdot 3 \\cdot 7$. Multiplying by $3 \\cdot 7 = 21$ gives $2^2 \\cdot 3^2 \\cdot 7^2 = 42^2 = 1764$." },
    takeaway: "Only the primes with odd exponents need fixing; leave the rest alone.",
    whenToUse: "Making a product into a perfect square with the least effort.",
    verification: COMPUTED("Searches k = 1, 2, 3, … for the first k with 84k a perfect square."),
  }),
  pr("v1", "variation", "build", 4, 50, {
    title: "From squares to cubes",
    prompt: "What is the smallest positive integer $k$ for which $72k$ is a perfect **cube**?",
    interaction: { kind: "numeric", answer: "3", slips: [slip(2, "$72 \\cdot 2 = 144$ is a perfect square. A cube needs every exponent to be a multiple of 3."), slip(9, "$72 \\cdot 9 = 648 = 2^3 \\cdot 3^4$, and 4 is not a multiple of 3.")] },
    hint: "For a cube, what must be true of every exponent in the prime factorization?",
    feedback: { correct: "For a cube, exponents must be multiples of 3: $2^3$ is fine, and $3^2$ needs one more 3.", incorrect: "Cubing triples every exponent, so a cube has exponents that are multiples of 3. Here $72 = 2^3 \\cdot 3^2$." },
    explanation: { summary: "$72 = 2^3 \\cdot 3^2$. The exponent of 2 is already a multiple of 3. The exponent of 3 must rise from 2 to 3, so $k = 3$ and $72 \\cdot 3 = 216 = 6^3$." },
    takeaway: "Squares need even exponents; cubes need exponents that are multiples of 3. The method is the same.",
    whenToUse: "Perfect-power conditions of any kind.",
    verification: COMPUTED("Searches k = 1, 2, 3, … for the first k with 72k a perfect cube."),
  }),

  // ---------------------------------------------------------------- remainders
  rem("i1", "insight", "combine", 1, 35, {
    title: "Adding numbers you can't see",
    prompt: "One mystery number leaves remainder 3 when divided by 5. Another leaves remainder 4. You are not told the numbers. What remainder does their **sum** leave when divided by 5?",
    interaction: { kind: "numeric", answer: "2", slips: [slip(7, "$3 + 4 = 7$ is the right start, but a remainder on division by 5 has to be less than 5. Take one more 5 out of 7.")] },
    feedback: { correct: "$3 + 4 = 7$, and 7 leaves remainder 2. The numbers themselves never mattered.", incorrect: "Add the remainders: $3 + 4 = 7$. Then remove one more group of 5." },
    explanation: {
      summary: "The numbers are $5a + 3$ and $5b + 4$. Their sum is $5a + 5b + 7 = 5(a + b + 1) + 2$, so the remainder is 2 whatever $a$ and $b$ are.",
      steps: ["Try it: $8 + 9 = 17 = 15 + 2$", "Or: $13 + 24 = 37 = 35 + 2$"],
    },
    takeaway: "Remainders can be added (and multiplied) on their own. The full numbers are not needed.",
    whenToUse: "Any remainder question about a sum or product of large or unknown numbers.",
    verification: COMPUTED("Checks every pair of numbers below 200 with those remainders."),
  }),
  rem("t1", "technique", "combine", 2, 50, {
    title: "Reduce first, then compute",
    teach: {
      body: "To find the remainder of a product, replace each factor by its own remainder before multiplying. The numbers stay small the whole way.",
      steps: [
        "Remainder of $47 \\times 62$ on division by 5?",
        "$47 = 45 + 2$, so 47 behaves like 2.",
        "$62 = 60 + 2$, so 62 behaves like 2.",
        "$2 \\times 2 = 4$. The remainder is 4. (Check: $47 \\times 62 = 2914 = 2910 + 4$.)",
      ],
    },
    prompt: "What is the remainder when $103 \\times 58$ is divided by 7?",
    interaction: { kind: "numeric", answer: "3", slips: [slip(10, "$5 \\times 2 = 10$ is right so far. Now reduce once more: what remainder does 10 leave on division by 7?")] },
    hint: "$103 = 98 + 5$ and $58 = 56 + 2$.",
    feedback: { correct: "103 behaves like 5, 58 behaves like 2, and $5 \\times 2 = 10$ leaves 3.", incorrect: "Reduce each factor first: $103 = 98 + 5$ and $58 = 56 + 2$. Multiply the remainders, then reduce again." },
    explanation: { summary: "$103 = 7 \\cdot 14 + 5$ and $58 = 7 \\cdot 8 + 2$. The product behaves like $5 \\times 2 = 10$, which leaves remainder 3." },
    takeaway: "In remainder problems, shrink every number to its remainder before you add or multiply.",
    whenToUse: "Remainders of big products, sums and powers.",
    verification: COMPUTED("Computes 103·58 mod 7 directly."),
  }),
  rem("r1", "recognition", "eliminate", 3, 50, {
    title: "Impossible squares",
    prompt: "Squares $1, 4, 9, 16, 25, \\dots$ leave remainders $1, 0, 1, 0, 1, \\dots$ when divided by 4: only ever 0 or 1. Which of these numbers can be **ruled out** as perfect squares by that fact alone?",
    interaction: {
      kind: "multi", answers: ["a", "b"],
      options: [
        opt("a", "1,000,003", "It ends in 03, so its remainder on division by 4 is 3. No square does that."),
        opt("b", "2,222,222", "It ends in 22, so its remainder on division by 4 is 2. No square does that."),
        opt("c", "4,000,001", "Its remainder is 1, which squares are allowed to have. This test cannot rule it out."),
        opt("d", "1,000,000", "Its remainder is 0, which squares are allowed to have. (It is $1000^2$.)"),
      ],
    },
    hint: "The remainder on division by 4 depends only on the last two digits, because 100 is a multiple of 4.",
    feedback: { correct: "Remainders 2 and 3 never occur for squares, so those two are impossible. A remainder of 0 or 1 proves nothing either way.", incorrect: "Find each number's remainder on division by 4 from its last two digits. Only remainders 2 and 3 rule a number out; 0 and 1 leave the question open." },
    explanation: { summary: "An even number squared is a multiple of 4; an odd number $2k+1$ squared is $4k^2 + 4k + 1$. So squares leave 0 or 1. The remainders here are 3, 2, 1 and 0: only the first two are impossible." },
    takeaway: "A remainder can prove something is impossible. It cannot prove that it is possible.",
    whenToUse: "\"Can this be a perfect square?\", \"is there a solution?\": test with a small divisor to rule cases out.",
    verification: COMPUTED("Computes each number mod 4 and confirms squares mod 4 are only 0 or 1."),
  }),
  rem("a1", "application", "combine", 2, 40, {
    title: "A product of big numbers",
    prompt: "What is the remainder when $91 \\times 92 \\times 93$ is divided by 9?",
    interaction: { kind: "numeric", answer: "6" },
    hint: "90 is a multiple of 9. What do 91, 92 and 93 each leave?",
    feedback: { correct: "The three factors behave like 1, 2 and 3, and $1 \\cdot 2 \\cdot 3 = 6$.", incorrect: "Since $90 = 9 \\cdot 10$, the factors leave remainders 1, 2 and 3. Multiply those instead." },
    explanation: { summary: "$91 = 90 + 1$, $92 = 90 + 2$, $93 = 90 + 3$. The product behaves like $1 \\cdot 2 \\cdot 3 = 6$." },
    takeaway: "Look for a nearby multiple of the divisor: it makes the remainders obvious.",
    whenToUse: "Products or sums of numbers that sit just above a round multiple.",
    verification: COMPUTED("Computes 91·92·93 mod 9 directly."),
  }),
  rem("a2", "application", "meaning", 3, 45, {
    title: "Changing the divisor",
    prompt: "When a whole number $N$ is divided by 12, the remainder is 7. What is the remainder when $N$ is divided by 4?",
    interaction: { kind: "numeric", answer: "3", slips: [slip(7, "A remainder on division by 4 must be smaller than 4. Take the groups of 4 out of the 7 as well.")] },
    hint: "Write $N = 12q + 7$. Which part of that is already a multiple of 4?",
    feedback: { correct: "$12q$ is a multiple of 4, so only the 7 matters, and $7 = 4 + 3$.", incorrect: "Write $N = 12q + 7$. The $12q$ disappears on division by 4, leaving the remainder of 7." },
    explanation: { summary: "$N = 12q + 7 = 4(3q + 1) + 3$. The remainder is 3." },
    takeaway: "\"Remainder r on division by d\" means N = d·q + r. Write it down and the rest is algebra.",
    whenToUse: "When a remainder condition is given and a different divisor is asked about.",
    verification: COMPUTED("Checks every N below 1000 with N mod 12 = 7."),
  }),
  rem("v1", "variation", "negative", 4, 50, {
    title: "One short of a multiple",
    prompt: "What is the remainder when $14^{9}$ is divided by 15?",
    interaction: { kind: "numeric", answer: "14", slips: [slip(1, "$(-1)^9$ is $-1$, not 1, because 9 is odd. And a remainder of $-1$ means one short of a multiple of 15."), slip(-1, "Right idea. Now express \"one short of a multiple of 15\" as a remainder between 0 and 14.")] },
    hint: "14 is one less than 15, so it behaves like $-1$.",
    feedback: { correct: "14 behaves like $-1$, and $(-1)^9 = -1$, which is the same as remainder 14.", incorrect: "Treat 14 as $-1$. Then $14^9$ behaves like $(-1)^9 = -1$: one short of a multiple of 15." },
    explanation: { summary: "$14 = 15 - 1$, so $14$ behaves like $-1$ and $14^9$ behaves like $(-1)^9 = -1$. One less than a multiple of 15 leaves remainder 14." },
    takeaway: "A number one below the divisor acts like −1, and powers of −1 are easy.",
    whenToUse: "Powers of a number that is just below (or above) a multiple of the divisor.",
    verification: COMPUTED("Computes 14⁹ mod 15 by repeated multiplication."),
  }),

  // ---------------------------------------------------------------- repeating patterns
  cyc("i1", "insight", "find", 1, 35, {
    title: "It has to come back",
    prompt: "The powers of 3 are $3, 9, 27, 81, \\dots$ Their last digits are $3, 9, 7, 1$. What is the last digit of the next power, $3^5$?",
    interaction: { kind: "numeric", answer: "3" },
    feedback: { correct: "81 × 3 ends in 3, and from there the last digits must repeat: 3, 9, 7, 1, 3, 9, 7, 1, …", incorrect: "Only the last digit matters: $81 \\times 3$ ends in the same digit as $1 \\times 3$." },
    explanation: { summary: "The last digit of the next power depends only on the last digit of the current one. Since $3^5 = 243$ ends in 3 again, everything after it repeats: the last digits cycle through 3, 9, 7, 1 forever." },
    takeaway: "If the next step depends only on the current state, and there are finitely many states, the process must cycle.",
    whenToUse: "Last digits of powers, remainders of powers, and any process that repeats a rule.",
    verification: COMPUTED("Computes 3⁵ mod 10."),
  }),
  cyc("t1", "technique", "position", 2, 55, {
    title: "Where do you land in the cycle?",
    teach: {
      body: "Find the cycle, then divide the position by the cycle length. The remainder tells you where in the cycle you land.",
      steps: [
        "Last digit of $7^{50}$?",
        "Last digits of powers of 7: $7, 9, 3, 1$, then repeat. Cycle length 4.",
        "$50 = 4 \\cdot 12 + 2$: twelve full cycles, then 2 more steps.",
        "The 2nd entry of the cycle is 9. So $7^{50}$ ends in 9.",
      ],
    },
    prompt: "What is the last digit of $3^{22}$? (The cycle for 3 is $3, 9, 7, 1$.)",
    interaction: { kind: "numeric", answer: "9", slips: [slip(7, "$22 = 4 \\cdot 5 + 2$, so you land on the 2nd entry of the cycle, not the 3rd.")] },
    feedback: { correct: "$22 = 4 \\cdot 5 + 2$: five full cycles, then two steps to the 2nd entry.", incorrect: "Divide 22 by the cycle length 4. The remainder, 2, is your position in $3, 9, 7, 1$." },
    explanation: { summary: "$22 = 4 \\cdot 5 + 2$, so $3^{22}$ ends in the same digit as $3^2$: the 2nd entry of the cycle, 9." },
    takeaway: "Far-off term of a repeating pattern: divide the position by the cycle length and use the remainder.",
    whenToUse: "\"What is the last digit of a huge power?\" and \"what is the 1000th term?\"",
    verification: COMPUTED("Computes 3²² mod 10 by repeated multiplication."),
  }),
  cyc("r1", "recognition", "transfer", 2, 40, {
    title: "Is this a cycle problem?",
    prompt: "Which of these questions can be answered by finding a repeating cycle?",
    interaction: {
      kind: "multi", answers: ["a", "b", "c"],
      options: [
        opt("a", "The 100th digit after the decimal point of $\\frac{1}{7}$", "The decimal of $\\frac{1}{7}$ repeats every 6 digits, so this is a cycle question."),
        opt("b", "The day of the week 1000 days from today", "Days of the week repeat every 7, so this is a cycle question."),
        opt("c", "The last digit of $9^{77}$", "Last digits of powers repeat, so this is a cycle question."),
        opt("d", "The number of divisors of 1000", "Nothing repeats here: this is read from the prime factorization."),
      ],
    },
    feedback: { correct: "Each of those has a rule that repeats with a fixed period. The divisor count is a different kind of question.", incorrect: "Ask of each one: is something repeating with a fixed period? Decimals of fractions, weekdays and last digits of powers all do." },
    explanation: { summary: "The decimal of $\\frac{1}{7}$ has period 6, weekdays have period 7, and the last digits of powers of 9 have period 2. Counting divisors involves no repetition." },
    takeaway: "\"A far-off position in something that repeats\" is always the same problem, whatever it is dressed as.",
    whenToUse: "Calendars, clocks, repeating decimals, last digits, patterns of colours or letters.",
    verification: REASONED("Each option was classified by whether the quantity is periodic: 1/7 has period 6, weekdays 7, last digits of 9ⁿ period 2; a divisor count has no period."),
  }),
  cyc("a1", "application", "position", 2, 45, {
    title: "A far-off power",
    prompt: "What is the last digit of $7^{123}$?",
    interaction: { kind: "numeric", answer: "3", slips: [slip(7, "$123 = 4 \\cdot 30 + 3$, so you land on the 3rd entry of the cycle, not the 1st."), slip(1, "$123$ is not a multiple of 4. Find its remainder on division by 4.")] },
    hint: "The last digits of the powers of 7 go $7, 9, 3, 1$ and repeat.",
    feedback: { correct: "$123 = 4 \\cdot 30 + 3$, so it matches $7^3 = 343$.", incorrect: "The cycle $7, 9, 3, 1$ has length 4, and $123 = 4 \\cdot 30 + 3$. Take the 3rd entry." },
    explanation: { summary: "The cycle is $7, 9, 3, 1$ (length 4). Since $123 = 4 \\cdot 30 + 3$, the last digit is the 3rd entry: 3." },
    takeaway: "Build the cycle by multiplying last digits only, then use the remainder of the exponent.",
    whenToUse: "Last digit of any large power.",
    verification: COMPUTED("Computes 7¹²³ mod 10 by repeated multiplication."),
  }),
  cyc("a2", "application", "position", 3, 45, {
    title: "Landing exactly on the end",
    prompt: "What is the last digit of $2^{100}$?",
    interaction: { kind: "numeric", answer: "6", slips: [slip(2, "A remainder of 0 means you have just finished a full cycle, so you are on its last entry, not its first."), slip(1, "No power of 2 above $2^0$ is odd. The cycle of last digits is $2, 4, 8, 6$.")] },
    hint: "The cycle is $2, 4, 8, 6$. What does a remainder of 0 mean?",
    feedback: { correct: "100 is a multiple of 4, so $2^{100}$ sits at the end of a cycle, like $2^4 = 16$.", incorrect: "The cycle $2, 4, 8, 6$ has length 4 and $100 = 4 \\cdot 25$. Exactly 25 full cycles means you are on the last entry." },
    explanation: { summary: "The last digits cycle $2, 4, 8, 6$. Since 100 is a multiple of 4, $2^{100}$ ends like $2^4 = 16$: in 6." },
    takeaway: "Remainder 0 means the last entry of the cycle, not the first.",
    whenToUse: "Every cycle problem: check the exact-multiple case separately.",
    verification: COMPUTED("Computes 2¹⁰⁰ mod 10 by repeated multiplication."),
  }),
  cyc("v1", "variation", "transfer", 3, 50, {
    title: "A cycle with no powers in it",
    prompt: "The decimal $\\frac{1}{7} = 0.142857142857\\dots$ repeats every 6 digits. What is the 100th digit after the decimal point?",
    interaction: { kind: "numeric", answer: "8", slips: [slip(2, "$100 = 6 \\cdot 16 + 4$, so take the 4th digit of the block, not the 3rd."), slip(1, "$100 = 6 \\cdot 16 + 4$: after 16 full blocks you go 4 digits further, to the 4th digit of $142857$.")] },
    hint: "How many full blocks of 6 fit into 100, and how many digits are left over?",
    feedback: { correct: "$100 = 6 \\cdot 16 + 4$, so it is the 4th digit of the block $142857$.", incorrect: "Same method as with powers: $100 = 6 \\cdot 16 + 4$, so read the 4th digit of $142857$." },
    explanation: { summary: "The block $142857$ has length 6 and $100 = 6 \\cdot 16 + 4$. The 100th digit equals the 4th digit of the block, which is 8." },
    takeaway: "The cycle method does not care what is cycling: digits, days or remainders.",
    whenToUse: "Repeating decimals, calendars, seating around a table, repeating colour patterns.",
    verification: COMPUTED("Generates the decimal expansion of 1/7 by long division and reads the 100th digit."),
  }),
  cyc("v2", "variation", "position", 4, 60, {
    title: "Two cycles at once",
    prompt: "What is the last digit of $3^{50} + 7^{50}$?",
    interaction: { kind: "numeric", answer: "8", slips: [slip(18, "9 + 9 = 18 is right. The question asks for the last digit of that."), slip(0, "Check the position: $50 = 4 \\cdot 12 + 2$, so each power sits on the 2nd entry of its cycle.")] },
    hint: "Handle each power separately. Both cycles have length 4.",
    feedback: { correct: "Each power lands on the 2nd entry of its cycle, which is 9 both times, and $9 + 9$ ends in 8.", incorrect: "Both cycles ($3, 9, 7, 1$ and $7, 9, 3, 1$) have length 4, and $50 = 4 \\cdot 12 + 2$. Take the 2nd entry of each, then add." },
    explanation: { summary: "$50 = 4 \\cdot 12 + 2$. So $3^{50}$ ends like $3^2 = 9$ and $7^{50}$ ends like $7^2 = 49$, in 9. The sum ends like $9 + 9 = 18$: in 8." },
    takeaway: "Last digits of a sum come from the last digits of the parts: solve each cycle, then combine.",
    whenToUse: "Sums or products of several large powers.",
    verification: COMPUTED("Computes (3⁵⁰ + 7⁵⁰) mod 10 by repeated multiplication."),
  }),
];

export const FAMILIES: CardFamily[] = [
  family("nt.divisibility", "f-range", "application", "count", 3, (r) => {
    const d = r.pick([4, 6, 7, 8, 9, 11, 12]);
    const lo = r.int(3, 12) * 10;
    const hi = lo + r.int(12, 30) * 10;
    const count = Math.floor(hi / d) - Math.floor((lo - 1) / d);
    return {
      params: { d, lo, hi }, seconds: 45,
      title: "Multiples in a range",
      prompt: `How many whole numbers from ${lo} to ${hi}, inclusive, are multiples of ${d}?`,
      interaction: { kind: "numeric", answer: String(count), slips: Math.floor(hi / d) !== count ? [slip(Math.floor(hi / d), `That counts every multiple of ${d} up to ${hi}. The ones below ${lo} have to come out.`)] : [] },
      hint: `Count the multiples of ${d} up to ${hi}, then subtract the multiples of ${d} up to ${lo - 1}.`,
      feedback: { correct: "Two counts that both start at 1, subtracted: no off-by-one to worry about.", incorrect: `Use two counts that both start at 1: multiples of ${d} up to ${hi}, minus multiples of ${d} up to ${lo - 1}.` },
      explanation: { summary: `Up to ${hi} there are ${Math.floor(hi / d)} multiples of ${d}; up to ${lo - 1} there are ${Math.floor((lo - 1) / d)}. The difference is ${count}.` },
      takeaway: "To count in a range from A to B, count up to B and subtract the count up to A − 1.",
      whenToUse: "Any count over a range that does not start at 1.",
    };
  }),
  family("nt.primes", "f-divisors", "application", "divisors", 3, (r) => {
    const [p, q] = r.pick([[2, 3], [2, 5], [3, 5], [2, 7], [3, 7]] as const);
    const a = r.int(2, 4);
    const b = r.int(1, 3);
    const n = p ** a * q ** b;
    return {
      params: { n }, seconds: 45,
      title: "How many divisors?",
      prompt: `How many positive divisors does ${n} have?`,
      interaction: { kind: "numeric", answer: String((a + 1) * (b + 1)), slips: a * b !== (a + 1) * (b + 1) ? [slip(a * b, "Multiplying the exponents leaves out the choice of using none of a prime. Add 1 to each exponent first.")] : [] },
      hint: `Factor ${n} into primes first.`,
      feedback: { correct: "Each divisor is one choice of how many copies of each prime to use.", incorrect: `Factor first: $${n} = ${p}^{${a}} \\cdot ${q}^{${b}}$. Then each prime offers (exponent + 1) choices.` },
      explanation: { summary: `$${n} = ${p}^{${a}} \\cdot ${q}^{${b}}$, so the number of divisors is $(${a}+1)(${b}+1) = ${(a + 1) * (b + 1)}$.` },
      takeaway: "Number of divisors: add 1 to each exponent in the prime factorization, then multiply.",
      whenToUse: "Whenever a problem asks how many divisors a number has.",
    };
  }),
  family("nt.remainders", "f-product", "application", "combine", 2, (r) => {
    const m = r.pick([5, 6, 7, 8, 9, 11]);
    const [ra, rb] = [r.int(1, m - 1), r.int(1, m - 1)];
    const [a, b] = [m * r.int(6, 14) + ra, m * r.int(6, 14) + rb];
    const ans = (ra * rb) % m;
    return {
      params: { a, b, m }, seconds: 45,
      title: "Reduce, then multiply",
      prompt: `What is the remainder when $${a} \\times ${b}$ is divided by ${m}?`,
      interaction: { kind: "numeric", answer: String(ans), slips: ra * rb !== ans ? [slip(ra * rb, `$${ra} \\times ${rb} = ${ra * rb}$ is right so far. Now reduce once more: a remainder on division by ${m} is less than ${m}.`)] : [] },
      hint: `Find the remainder of each factor on division by ${m} before multiplying.`,
      feedback: { correct: `The factors behave like ${ra} and ${rb}.`, incorrect: `Reduce each factor first: ${a} leaves ${ra} and ${b} leaves ${rb}. Multiply those, then reduce again.` },
      explanation: { summary: `${a} leaves remainder ${ra} and ${b} leaves remainder ${rb} on division by ${m}. Their product behaves like $${ra} \\times ${rb} = ${ra * rb}$, which leaves ${ans}.` },
      takeaway: "In remainder problems, shrink every number to its remainder before you add or multiply.",
      whenToUse: "Remainders of big products, sums and powers.",
    };
  }),
  family("nt.cycles", "f-power", "application", "position", 3, (r) => {
    const base = r.pick([2, 3, 7, 8, 12, 13, 17, 18]);
    const n = r.int(21, 99);
    const cycle = [1, 2, 3, 4].map((k) => base ** k % 10);
    const pos = n % 4 === 0 ? 4 : n % 4;
    return {
      params: { base, n }, seconds: 50,
      title: "A far-off power",
      prompt: `What is the last digit of $${base}^{${n}}$?`,
      interaction: { kind: "numeric", answer: String(cycle[pos - 1]) },
      hint: `Only the last digit of ${base} matters. List the last digits of its first few powers until they repeat.`,
      feedback: { correct: `The cycle has length 4 and ${n} lands on entry ${pos}.`, incorrect: `The last digits cycle $${cycle.join(", ")}$ (length 4). Divide ${n} by 4 and use the remainder to find your place; remainder 0 means the last entry.` },
      explanation: { summary: `The last digits of the powers of ${base} cycle $${cycle.join(", ")}$. Since $${n} = 4 \\cdot ${Math.floor(n / 4)} + ${n % 4}$, the answer is entry ${pos} of the cycle: ${cycle[pos - 1]}.` },
      takeaway: "Far-off term of a repeating pattern: divide the position by the cycle length and use the remainder.",
      whenToUse: "Last digit of any large power.",
    };
  }),
];
