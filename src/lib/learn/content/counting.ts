// Counting cards: counting in stages, when order does not matter, counting the opposite.
// Several problems are adapted from the earlier move-based counting pack.
import type { Card, CardFamily } from "../cards/types";
import { COMPUTED, REASONED, adaptedFrom, family, forConcept, opt, slip } from "./author";

const mul = forConcept("cp.multiplication");
const over = forConcept("cp.overcounting");
const comp = forConcept("cp.complement");

export const CARDS: Card[] = [
  // ---------------------------------------------------------------- counting in stages
  mul("i1", "insight", "stages", 1, 30, {
    title: "And then",
    prompt: "A café offers 3 kinds of bread and 4 fillings. A sandwich is one bread **and** one filling. How many different sandwiches can it make?",
    interaction: { kind: "numeric", answer: "12", slips: [slip(7, "Adding counts the breads and fillings as separate items. Each bread can be paired with every filling.")] },
    feedback: { correct: "Each of the 3 breads can go with each of the 4 fillings.", incorrect: "Picture a grid: 3 rows for the breads, 4 columns for the fillings. Every cell is a sandwich." },
    explanation: { summary: "Each of the 3 breads can be combined with any of the 4 fillings: 3 rows of 4, so $3 \\cdot 4 = 12$ sandwiches. You would add only if you were choosing a bread **or** a filling." },
    takeaway: "\"And then\" multiplies. \"Or\" adds.",
    whenToUse: "Any outcome that is built by making one decision after another.",
    verification: COMPUTED("Enumerates every bread–filling pair."),
  }),
  mul("t1", "technique", "repeat", 2, 55, {
    title: "One slot per decision",
    source: adaptedFrom("count.arrange.w"),
    teach: {
      body: "Draw one blank for each decision. Fill each blank with the number of options available at that moment, then multiply. The key question at every blank: did an earlier choice use up an option?",
      steps: [
        "Five runners; in how many ways can gold, silver and bronze be awarded?",
        "Gold: 5 runners could win it.",
        "Silver: the gold medallist is used up, so 4.",
        "Bronze: 3. Total: $5 \\cdot 4 \\cdot 3 = 60$.",
      ],
    },
    prompt: "A locker code is 3 digits long. Each digit is from 1 to 5, and digits **may repeat**. How many codes are possible?",
    interaction: { kind: "numeric", answer: "125", slips: [slip(60, "That is the count when a digit cannot be reused. Here repeats are allowed, so every slot still has all 5 options."), slip(15, "The three choices are made one after another, so multiply: $5 \\cdot 5 \\cdot 5$.")] },
    feedback: { correct: "Nothing is used up, so every slot has 5 options.", incorrect: "Three slots. Because digits may repeat, choosing one does not remove it: each slot has 5 options." },
    explanation: { summary: "Each of the 3 slots can be any of 5 digits, and choosing a digit does not use it up: $5 \\cdot 5 \\cdot 5 = 125$." },
    takeaway: "At each slot, check whether the previous choice used up an option or left it available.",
    whenToUse: "Codes, passwords, arrangements, rankings, outfits.",
    verification: COMPUTED("Enumerates all 3-digit codes over the digits 1 to 5."),
  }),
  mul("r1", "recognition", "repeat", 2, 40, {
    title: "Used up, or still available?",
    prompt: "In which of these does making a choice **use up** an option, so that the next slot has one fewer?",
    interaction: {
      kind: "multi", answers: ["a", "c"],
      options: [
        opt("a", "Seating 4 people in 4 chairs", "A person who is seated cannot also sit in the next chair."),
        opt("b", "Choosing a 4-digit PIN", "A PIN may reuse a digit, so every position has all 10 options."),
        opt("c", "Awarding 1st, 2nd and 3rd prize among 8 entries", "An entry cannot win two of the prizes."),
        opt("d", "Rolling a die three times", "The die can show the same face again; nothing is used up."),
      ],
    },
    feedback: { correct: "People and prize-winners are used up. Digits and die faces are not.", incorrect: "Ask of each: after one choice is made, can the same thing be chosen again?" },
    explanation: { summary: "A person fills only one chair and an entry wins only one prize, so those options shrink: $4 \\cdot 3 \\cdot 2 \\cdot 1$ and $8 \\cdot 7 \\cdot 6$. PIN digits and die faces can repeat: $10^4$ and $6^3$." },
    takeaway: "Before multiplying, decide whether the slots shrink (no reuse) or stay the same (reuse allowed).",
    whenToUse: "The first decision in any slot-by-slot count.",
    verification: REASONED("Classification of four everyday scenarios by whether repetition is possible; no computed key."),
  }),
  mul("a2", "application", "stages", 2, 45, {
    title: "A digit to avoid",
    prompt: "How many three-digit whole numbers have no digit equal to 7?",
    interaction: { kind: "numeric", answer: "648", slips: [slip(729, "The first digit of a three-digit number cannot be 0, so it has only 8 options."), slip(504, "Digits may repeat here (as in 112), so the later slots do not shrink.")] },
    hint: "Three slots. Which digits are allowed in the hundreds place?",
    feedback: { correct: "Hundreds: 8 options (not 0, not 7). Tens and units: 9 options each.", incorrect: "Hundreds digit: 1–9 except 7, so 8 options. Tens and units: 0–9 except 7, so 9 options each." },
    explanation: { summary: "Hundreds digit: 8 choices (1–9 without 7). Tens digit: 9 choices (0–9 without 7). Units digit: 9 choices. $8 \\cdot 9 \\cdot 9 = 648$." },
    takeaway: "Give each slot its own count: the leading digit of a number has one option fewer (no zero).",
    whenToUse: "Counting numbers by their digits.",
    verification: COMPUTED("Loops over 100..999 and tests the digits."),
  }),
  mul("a1", "application", "restrict", 3, 55, {
    title: "The fussy slot goes first",
    prompt: "How many **even** three-digit numbers can be made from the digits 1, 2, 3, 4, 5 if no digit is used twice?",
    interaction: { kind: "numeric", answer: "24", slips: [slip(60, "That counts every three-digit arrangement. The last digit has to be even, so it has only 2 options."), slip(50, "No digit may be used twice, so after the last digit is fixed the other slots have 4 and then 3 options.")] },
    hint: "Which position has the restriction? Fill that one first.",
    feedback: { correct: "Units digit first (2 options), then the remaining slots have 4 and 3.", incorrect: "Start with the restricted slot: the units digit must be 2 or 4. Then fill the other two slots from the 4 digits that remain." },
    explanation: { summary: "The units digit must be 2 or 4: 2 choices. Then the hundreds digit has 4 remaining choices and the tens digit 3. $2 \\cdot 4 \\cdot 3 = 24$." },
    takeaway: "Fill the most restricted slot first, while its options are still easy to count.",
    whenToUse: "Arrangements where one position has a special condition.",
    verification: COMPUTED("Enumerates all arrangements of three distinct digits from 1 to 5 and counts the even ones."),
  }),
  mul("v1", "variation", "restrict", 4, 60, {
    title: "Two who stick together",
    source: adaptedFrom("count.arrange.t"),
    prompt: "Five students A, B, C, D and E line up for lunch. A and B insist on standing next to each other. How many line-ups are possible?",
    interaction: { kind: "numeric", answer: "48", slips: [slip(24, "That arranges the block and the other three, but A and B can stand in two orders inside the block."), slip(120, "That is every line-up of five. In most of them A and B are apart.")] },
    hint: "Treat A and B as a single block. How many things are you arranging now?",
    feedback: { correct: "Four units (the AB block, C, D, E) in $4!$ orders, times 2 orders inside the block.", incorrect: "Glue A and B into one block. Arrange the 4 units, then decide the order inside the block." },
    explanation: { summary: "Treat A and B as one block: 4 units can be arranged in $4 \\cdot 3 \\cdot 2 \\cdot 1 = 24$ ways. Inside the block, AB or BA: 2 ways. $24 \\cdot 2 = 48$." },
    takeaway: "Things that must stay together act as one unit: arrange the units, then arrange inside the unit.",
    whenToUse: "\"Must sit together\", \"must be adjacent\", \"books of a set stay together\".",
    verification: COMPUTED("Enumerates all 120 line-ups and counts those with A next to B."),
  }),

  // ---------------------------------------------------------------- when order does not matter
  over("i1", "insight", "divide", 1, 35, {
    title: "Counted twice",
    prompt: "There are $5 \\cdot 4 = 20$ ways to pick two of five students **in order** (first pick, second pick). In that list of 20, how many times does the pair Ana and Ben appear?",
    interaction: { kind: "numeric", answer: "2", slips: [slip(1, "\"Ana then Ben\" and \"Ben then Ana\" are different ordered picks, but they are the same pair.")] },
    feedback: { correct: "Once as Ana-then-Ben and once as Ben-then-Ana.", incorrect: "The ordered list contains \"Ana, then Ben\" and also \"Ben, then Ana\"." },
    explanation: { summary: "Every pair shows up twice in the ordered list, once in each order. So the 20 ordered picks represent only $20 \\div 2 = 10$ different pairs." },
    takeaway: "If every outcome was counted k times, divide by k.",
    whenToUse: "Any count where the same outcome can be reached by several orders of choosing.",
    verification: COMPUTED("Enumerates ordered picks of two from five and counts those forming one fixed pair."),
  }),
  over("t1", "technique", "divide", 2, 55, {
    title: "Count ordered, then divide",
    source: adaptedFrom("count.committee.w"),
    teach: {
      body: "When order does not matter, count as if it did, then divide by the number of orders in which the same group could have been picked.",
      steps: [
        "Choose a 3-person committee from 6 people.",
        "Ordered picks: $6 \\cdot 5 \\cdot 4 = 120$.",
        "One committee of 3 can be picked in $3 \\cdot 2 \\cdot 1 = 6$ orders.",
        "Committees: $120 \\div 6 = 20$.",
      ],
    },
    prompt: "A pizza place has 7 toppings. In how many ways can you choose 2 different toppings?",
    interaction: { kind: "numeric", answer: "21", slips: [slip(42, "That counts \"ham, then olives\" and \"olives, then ham\" as different pizzas. Divide by the 2 orders."), slip(49, "The two toppings must be different, so the second pick has 6 options, and then each pair has been counted twice.")] },
    feedback: { correct: "$7 \\cdot 6 = 42$ ordered picks, and each pair of toppings appears twice.", incorrect: "Ordered picks: $7 \\cdot 6 = 42$. The same two toppings in the other order is the same pizza, so divide by 2." },
    explanation: { summary: "Ordered picks: $7 \\cdot 6 = 42$. Each pair of toppings was counted in 2 orders, so there are $42 \\div 2 = 21$ choices." },
    takeaway: "Unordered selections = ordered picks ÷ (number of orders of one selection).",
    whenToUse: "Committees, teams, handshakes, toppings, pairs of points: anything where a group is chosen.",
    verification: COMPUTED("Enumerates unordered pairs from 7 items."),
  }),
  over("r1", "recognition", "decide", 2, 40, {
    title: "Does order matter?",
    prompt: "In which of these does order **not** matter, so that an ordered count has to be divided?",
    interaction: {
      kind: "multi", answers: ["a", "c"],
      options: [
        opt("a", "Choosing 3 books to pack from a shelf of 10", "The same three books in a different order is the same packing."),
        opt("b", "Awarding gold, silver and bronze", "Swapping gold and silver gives a different result, so order matters."),
        opt("c", "A handshake between two people", "Ana shaking Ben's hand is the same handshake as Ben shaking Ana's."),
        opt("d", "A 3-letter password", "CAT and ACT are different passwords, so order matters."),
      ],
    },
    feedback: { correct: "A test that always works: swap two of the chosen things. If nothing changed, order does not matter.", incorrect: "For each one, swap two of the chosen things. If the outcome is the same, order does not matter." },
    explanation: { summary: "Packed books and handshakes are the same after a swap, so order does not matter. Medals and passwords change when two entries swap, so order matters." },
    takeaway: "The swap test: exchange two chosen items. Same outcome means order does not matter, so divide.",
    whenToUse: "Before any count that involves choosing several things.",
    verification: REASONED("Classification of four scenarios by the swap test; no computed key."),
  }),
  over("a1", "application", "divide", 2, 40, {
    title: "Handshakes",
    source: adaptedFrom("count.committee.r1"),
    prompt: "Six people meet, and every two of them shake hands exactly once. How many handshakes take place?",
    interaction: { kind: "numeric", answer: "15", slips: [slip(30, "Each person shakes 5 hands, giving 30, but every handshake was counted from both sides."), slip(36, "Nobody shakes their own hand: each person shakes 5 hands, not 6.")] },
    hint: "How many hands does each person shake? Then think about what you have counted twice.",
    feedback: { correct: "$6 \\cdot 5 = 30$ counts each handshake from both ends, so halve it.", incorrect: "Each of 6 people shakes 5 hands: 30. But a handshake involves two people, so each was counted twice." },
    explanation: { summary: "Each of the 6 people shakes 5 hands: $6 \\cdot 5 = 30$. Every handshake was counted once from each side, so there are $30 \\div 2 = 15$." },
    takeaway: "A handshake is a pair: count pairs with n(n − 1) ÷ 2.",
    whenToUse: "Handshakes, games in a round-robin, segments between points.",
    verification: COMPUTED("Enumerates unordered pairs from 6 people."),
  }),
  over("a2", "application", "divide", 3, 50, {
    title: "Picking a team",
    prompt: "A team of 4 is chosen from 8 players. How many different teams are possible?",
    interaction: { kind: "numeric", answer: "70", slips: [slip(1680, "That is the number of ordered picks. The same four players can be picked in $4 \\cdot 3 \\cdot 2 \\cdot 1 = 24$ orders."), slip(420, "Four players can be ordered in 24 ways, not 4.")] },
    hint: "Count ordered picks first. In how many orders can the same four players be picked?",
    feedback: { correct: "$8 \\cdot 7 \\cdot 6 \\cdot 5 = 1680$ ordered picks, divided by the 24 orders of each team.", incorrect: "Ordered picks: $8 \\cdot 7 \\cdot 6 \\cdot 5 = 1680$. Each team of 4 appears in $4! = 24$ orders, so divide by 24." },
    explanation: { summary: "Ordered: $8 \\cdot 7 \\cdot 6 \\cdot 5 = 1680$. Orders of one team: $4 \\cdot 3 \\cdot 2 \\cdot 1 = 24$. Teams: $1680 \\div 24 = 70$." },
    takeaway: "Choosing k from n: multiply k descending numbers starting at n, then divide by k!.",
    whenToUse: "Any \"how many groups of k\" question.",
    verification: COMPUTED("Enumerates 4-element subsets of 8 players."),
  }),
  over("v1", "variation", "partial", 4, 60, {
    title: "One role is special",
    source: adaptedFrom("count.committee.t"),
    prompt: "From 6 students, a captain is chosen, and then 2 assistants. The two assistants have identical jobs. In how many ways can this be done?",
    interaction: { kind: "numeric", answer: "60", slips: [slip(120, "The two assistants are interchangeable, so each choice of assistants was counted twice. Divide that part by 2."), slip(20, "That treats all three as interchangeable. The captain is a different role, so do not divide by the orders that involve the captain.")] },
    hint: "Choose the captain first. Then the assistants are a group of 2 from the remaining 5.",
    feedback: { correct: "6 captains, then $\\frac{5 \\cdot 4}{2} = 10$ pairs of assistants.", incorrect: "Captain: 6 ways. Assistants: an unordered pair from the other 5, which is $5 \\cdot 4 \\div 2 = 10$. Multiply." },
    explanation: { summary: "Captain: 6 choices. Assistants: $5 \\cdot 4 = 20$ ordered picks, but the two are interchangeable, so 10 pairs. $6 \\cdot 10 = 60$." },
    takeaway: "Divide only by the orderings of the part that is truly interchangeable.",
    whenToUse: "Selections with a mix of distinct roles and identical roles.",
    verification: COMPUTED("Enumerates every captain with every unordered pair of assistants."),
  }),
  over("v2", "variation", "divide", 4, 60, {
    title: "Not every pair counts",
    prompt: "How many diagonals does a convex octagon (8 sides) have? A diagonal joins two corners that are not next to each other.",
    interaction: { kind: "numeric", answer: "20", slips: [slip(28, "That counts every pair of corners, including the 8 pairs that are joined by a side."), slip(40, "Each corner starts 5 diagonals, giving 40, but every diagonal has two ends and was counted twice.")] },
    hint: "From one corner, how many other corners can a diagonal go to?",
    feedback: { correct: "Each corner reaches 5 others (not itself, not its 2 neighbours), and each diagonal is counted from both ends.", incorrect: "From each corner a diagonal can go to $8 - 3 = 5$ corners. That gives $8 \\cdot 5$, and each diagonal was counted twice." },
    explanation: { summary: "From each of the 8 corners, a diagonal can reach 5 others. $8 \\cdot 5 = 40$ counts each diagonal from both ends, so there are 20. (Or: 28 pairs of corners minus 8 sides.)" },
    takeaway: "Restrict the choices first, then divide out the double count.",
    whenToUse: "Pair counts where some pairs are excluded.",
    verification: COMPUTED("Enumerates pairs of non-adjacent vertices of an octagon."),
  }),

  // ---------------------------------------------------------------- counting the opposite
  comp("i1", "insight", "subtract", 1, 35, {
    title: "Everything minus none",
    prompt: "There are 100 two-digit strings, from 00 to 99. Exactly 81 of them contain no 7 at all. How many contain **at least one** 7?",
    interaction: { kind: "numeric", answer: "19", slips: [slip(20, "Ten have a 7 first and ten have a 7 second, but 77 is in both lists. Subtracting from 100 avoids that trap.")] },
    feedback: { correct: "Every string either has a 7 somewhere or has none, so $100 - 81$.", incorrect: "Each string either contains a 7 or it does not. So the two groups add up to 100." },
    explanation: { summary: "\"At least one 7\" and \"no 7\" split the 100 strings into two groups with nothing left over. So the answer is $100 - 81 = 19$, with no need to sort out one 7 versus two." },
    takeaway: "\"At least one\" = everything − \"none\".",
    whenToUse: "The words \"at least one\" in a counting or probability question.",
    verification: COMPUTED("Enumerates the 100 two-digit strings."),
  }),
  comp("t1", "technique", "subtract", 2, 55, {
    title: "Total minus none",
    source: adaptedFrom("count.complement.w"),
    teach: {
      body: "Counting \"at least one\" directly means separate cases for exactly one, exactly two, and so on. The opposite, \"none\", is a single easy count. Count everything, count none, subtract.",
      steps: [
        "Three-letter strings from A, B, C, D, E with at least one A?",
        "All strings: $5 \\cdot 5 \\cdot 5 = 125$.",
        "Strings with no A: $4 \\cdot 4 \\cdot 4 = 64$.",
        "At least one A: $125 - 64 = 61$.",
      ],
    },
    prompt: "A 3-digit code uses the digits 1 to 6, and digits may repeat. How many codes contain **at least one** 6?",
    interaction: { kind: "numeric", answer: "91", slips: [slip(125, "125 is the number of codes with no 6. Subtract it from the total."), slip(108, "$3 \\cdot 36$ counts codes with two or three 6s more than once. Total minus none avoids that.")] },
    feedback: { correct: "$6^3 = 216$ codes in all, $5^3 = 125$ with no 6.", incorrect: "All codes: $6 \\cdot 6 \\cdot 6 = 216$. Codes with no 6: $5 \\cdot 5 \\cdot 5 = 125$. Subtract." },
    explanation: { summary: "All codes: $6^3 = 216$. Codes with no 6: $5^3 = 125$. At least one 6: $216 - 125 = 91$." },
    takeaway: "For \"at least one\": count all, count none, subtract.",
    whenToUse: "\"At least one\" conditions on codes, dice, coins or selections.",
    verification: COMPUTED("Enumerates all 3-digit codes over 1 to 6."),
  }),
  comp("r1", "recognition", "spot", 2, 40, {
    title: "When is the opposite easier?",
    prompt: "For which of these is counting the **opposite** clearly the easier route?",
    interaction: {
      kind: "multi", answers: ["a", "c"],
      options: [
        opt("a", "At least one head in 10 coin flips", "The opposite is a single outcome: all tails."),
        opt("b", "Exactly one head in 10 coin flips", "The opposite (zero heads, or two or more) is messier than counting directly: there are just 10 places for the one head."),
        opt("c", "5-letter strings with at least one vowel", "The opposite, no vowels at all, is one simple product."),
        opt("d", "Two dice with a sum of 12", "This is a single outcome, (6, 6). Counting it directly is immediate."),
      ],
    },
    feedback: { correct: "\"At least one\" has a simple opposite, \"none\". \"Exactly\" conditions and single outcomes are easier head-on.", incorrect: "Ask what the opposite is. If the opposite is one simple case (like \"none\"), use it. If the opposite is messier than the original, don't." },
    explanation: { summary: "The opposite of \"at least one\" is \"none\", a single easy case. For \"exactly one\" and for a single outcome, the direct count is already short." },
    takeaway: "Use the complement when the opposite is a single simple case, typically \"none\".",
    whenToUse: "Choosing a strategy before starting a count.",
    verification: REASONED("Strategy comparison across four scenarios; no computed key."),
  }),
  comp("r2", "recognition", "opposite", 3, 40, {
    title: "Say the opposite exactly",
    prompt: "Three dice are rolled. What is the exact opposite of \"at least two of the dice show a 6\"?",
    interaction: {
      kind: "choice", answer: "most-one",
      options: [
        opt("most-one", "At most one die shows a 6", "\"At least two\" covers 2 or 3 sixes; what is left is 0 or 1."),
        opt("none", "No die shows a 6", "That leaves out the rolls with exactly one 6, which also fail \"at least two\"."),
        opt("most-two", "At most two dice show a 6", "That overlaps with the original: a roll with exactly two 6s satisfies both."),
      ],
    },
    feedback: { correct: "The number of sixes is 0, 1, 2 or 3. \"At least two\" takes 2 and 3; the opposite takes 0 and 1.", incorrect: "List the possible numbers of sixes: 0, 1, 2, 3. \"At least two\" means 2 or 3. The opposite is everything else." },
    explanation: { summary: "The number of sixes can be 0, 1, 2 or 3. \"At least two\" means 2 or 3, so its opposite is 0 or 1: at most one 6." },
    takeaway: "To state an opposite, list every possibility and cross off the ones the original covers.",
    whenToUse: "Before subtracting: make sure the two groups together cover everything and do not overlap.",
    verification: COMPUTED("Enumerates all 216 rolls and tests which statement is the exact complement."),
  }),
  comp("a2", "application", "subtract", 2, 45, {
    title: "An even product",
    prompt: "Two dice are rolled, giving 36 equally likely outcomes. In how many of them is the **product** of the two numbers even?",
    interaction: { kind: "numeric", answer: "27", slips: [slip(18, "The product is even as soon as either die is even, which is more than half of the outcomes."), slip(9, "9 is the number of outcomes where the product is odd. Subtract it from 36.")] },
    hint: "When is a product odd?",
    feedback: { correct: "A product is odd only when both numbers are odd: $3 \\cdot 3 = 9$ outcomes. The other 27 are even.", incorrect: "A product is odd only if both numbers are odd. Count those outcomes and subtract from 36." },
    explanation: { summary: "The product is odd only when both dice are odd: $3 \\cdot 3 = 9$ outcomes. So it is even in $36 - 9 = 27$ outcomes." },
    takeaway: "\"Even product\" means \"at least one even factor\", so count the all-odd cases and subtract.",
    whenToUse: "Conditions that secretly mean \"at least one\".",
    verification: COMPUTED("Enumerates all 36 outcomes."),
  }),
  comp("a1", "application", "subtract", 3, 55, {
    title: "At least one 5",
    prompt: "How many three-digit whole numbers have at least one digit equal to 5?",
    interaction: { kind: "numeric", answer: "252", slips: [slip(648, "648 is the number with no 5 at all. Subtract it from the 900 three-digit numbers."), slip(271, "There are 900 three-digit numbers (100 to 999), and the leading digit cannot be 0: the count with no 5 is $8 \\cdot 9 \\cdot 9$.")] },
    hint: "How many three-digit numbers are there in all? How many have no 5 anywhere?",
    feedback: { correct: "900 three-digit numbers, of which $8 \\cdot 9 \\cdot 9 = 648$ have no 5.", incorrect: "Total: 900 three-digit numbers. With no 5: $8 \\cdot 9 \\cdot 9 = 648$. Subtract." },
    explanation: { summary: "There are 900 three-digit numbers. Those with no 5: hundreds digit 8 choices, tens 9, units 9, so 648. At least one 5: $900 - 648 = 252$." },
    takeaway: "Total minus none still works when the slots have different sizes. Count each slot carefully.",
    whenToUse: "\"At least one\" with digits of a number.",
    verification: COMPUTED("Loops over 100..999 and tests the digits."),
  }),
  comp("v1", "variation", "opposite", 4, 60, {
    title: "A complement in disguise",
    source: adaptedFrom("count.complement.t"),
    prompt: "A 3-letter code uses the letters A, B, C, D, and letters may repeat. How many codes have **at least one repeated letter** (such as ABA or CCC)?",
    interaction: { kind: "numeric", answer: "40", slips: [slip(24, "24 is the number of codes with all letters different. Subtract it from the total."), slip(4, "That counts only codes like AAA. Codes such as ABA also have a repeated letter.")] },
    hint: "What is the opposite of \"some letter appears more than once\"?",
    feedback: { correct: "The opposite is \"all three letters different\": $4 \\cdot 3 \\cdot 2 = 24$ of the 64 codes.", incorrect: "The opposite of \"at least one repeat\" is \"all different\". All codes: $4^3 = 64$. All different: $4 \\cdot 3 \\cdot 2 = 24$." },
    explanation: { summary: "All codes: $4^3 = 64$. Codes with all letters different: $4 \\cdot 3 \\cdot 2 = 24$. At least one repeat: $64 - 24 = 40$." },
    takeaway: "\"At least one repeat\" is the opposite of \"all different\".",
    whenToUse: "Shared birthdays, repeated digits, matching socks: any \"some two are the same\" question.",
    verification: COMPUTED("Enumerates all 64 codes."),
  }),
];

export const FAMILIES: CardFamily[] = [
  family("cp.multiplication", "f-arrange", "application", "repeat", 2, (r) => {
    const n = r.int(5, 9);
    const k = r.int(2, 3);
    const reuse = r.int(0, 1) === 1;
    const ans = reuse ? n ** k : Array.from({ length: k }, (_, i) => n - i).reduce((a, b) => a * b, 1);
    const other = reuse ? Array.from({ length: k }, (_, i) => n - i).reduce((a, b) => a * b, 1) : n ** k;
    return {
      params: { n, k, reuse: reuse ? 1 : 0 }, seconds: 45,
      title: "One slot per decision",
      prompt: reuse
        ? `A code is ${k} symbols long. Each symbol is one of ${n} shapes, and a shape may be used more than once. How many codes are possible?`
        : `${n} runners enter a race with no ties. In how many ways can the first ${k} places be filled?`,
      interaction: { kind: "numeric", answer: String(ans), slips: [slip(other, reuse ? "That is the count when a shape cannot be reused. Here every slot keeps all its options." : "A runner cannot finish in two places, so each slot has one option fewer than the last.")] },
      hint: "Draw one slot per decision. Does a choice use up an option?",
      feedback: { correct: reuse ? "Nothing is used up, so every slot has the same number of options." : "Each place uses up a runner, so the slots shrink by one.", incorrect: reuse ? `${k} slots, each with ${n} options, because shapes may repeat.` : `${k} slots: the first has ${n} options and each later one has one fewer.` },
      explanation: { summary: reuse ? `Each of the ${k} slots has ${n} options: $${Array(k).fill(n).join(" \\cdot ")} = ${ans}$.` : `The slots have $${Array.from({ length: k }, (_, i) => n - i).join(" \\cdot ")} = ${ans}$ options in turn.` },
      takeaway: "At each slot, check whether the previous choice used up an option or left it available.",
      whenToUse: "Codes, passwords, arrangements, rankings.",
    };
  }),
  family("cp.overcounting", "f-choose", "application", "divide", 3, (r) => {
    const n = r.int(6, 10);
    const k = r.int(2, 3);
    const ordered = k === 2 ? n * (n - 1) : n * (n - 1) * (n - 2);
    const orders = k === 2 ? 2 : 6;
    const what = r.pick(["books to take on a trip", "players for a doubles match", "flavours for a sundae"]);
    return {
      params: { n, k }, seconds: 50,
      title: "Count ordered, then divide",
      prompt: `In how many ways can ${k} ${what} be chosen from ${n}?`.replace("2 players for a doubles match", "2 players for a doubles pair").replace("3 players for a doubles match", "3 players for a relay squad"),
      interaction: { kind: "numeric", answer: String(ordered / orders), slips: [slip(ordered, `That counts ordered picks. The same ${k} can be picked in ${orders} orders, so divide by ${orders}.`)] },
      hint: "Count ordered picks first. In how many orders could the same group be picked?",
      feedback: { correct: `${ordered} ordered picks, each group counted ${orders} times.`, incorrect: `Ordered picks: ${ordered}. Each group of ${k} was counted in ${orders} orders, so divide.` },
      explanation: { summary: `Ordered picks: $${k === 2 ? `${n} \\cdot ${n - 1}` : `${n} \\cdot ${n - 1} \\cdot ${n - 2}`} = ${ordered}$. Each group appears in ${orders} orders, so there are $${ordered} \\div ${orders} = ${ordered / orders}$ choices.` },
      takeaway: "Unordered selections = ordered picks ÷ (number of orders of one selection).",
      whenToUse: "Any \"how many groups of k\" question.",
    };
  }),
  family("cp.complement", "f-atleast", "application", "subtract", 3, (r) => {
    const n = r.int(4, 7);
    const k = r.int(2, 3);
    return {
      params: { n, k }, seconds: 55,
      title: "Total minus none",
      prompt: `A code is ${k} digits long, using the digits 1 to ${n}, and digits may repeat. How many codes contain at least one 1?`,
      interaction: { kind: "numeric", answer: String(n ** k - (n - 1) ** k), slips: [slip((n - 1) ** k, "That is the number of codes with no 1. Subtract it from the total.")] },
      hint: "Count all the codes, then the codes with no 1 at all.",
      feedback: { correct: `$${n}^{${k}}$ codes in all, $${n - 1}^{${k}}$ with no 1.`, incorrect: `All codes: $${n}^{${k}} = ${n ** k}$. Codes with no 1: $${n - 1}^{${k}} = ${(n - 1) ** k}$. Subtract.` },
      explanation: { summary: `All codes: $${n}^{${k}} = ${n ** k}$. Codes with no 1: $${n - 1}^{${k}} = ${(n - 1) ** k}$. At least one 1: $${n ** k} - ${(n - 1) ** k} = ${n ** k - (n - 1) ** k}$.` },
      takeaway: "For \"at least one\": count all, count none, subtract.",
      whenToUse: "\"At least one\" conditions on codes, dice, coins or selections.",
    };
  }),
];
