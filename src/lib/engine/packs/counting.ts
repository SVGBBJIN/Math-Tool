// Topic pack: basic counting (Module B). 3 skills × (worked + 3 reps + twist) = 15 cards.
// Each template defines the slots a student can use, how each slot really behaves
// (which choices it offers after earlier ones), and an independent brute-force list of
// the valid outcomes. Scaling down = same template, same slots, smaller pool.
import { registerTemplate, type P, type StructCard, type StructTemplate } from "../struct/module";
import type { CardType, MoveInput, Skill, TopicPack } from "../types";
import { rng } from "./quadratics";

// ---- brute-force helpers ---------------------------------------------------------
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const pool = (p: P) => String(p.items).split("");
const n = (p: P) => pool(p).length;
const k = (p: P) => Number(p.k);
function perms<T>(xs: T[], len: number): T[][] {
  if (len === 0) return [[]];
  return xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)], len - 1).map((rest) => [x, ...rest]));
}
function tuples<T>(xs: T[], len: number): T[][] {
  if (len === 0) return [[]];
  return xs.flatMap((x) => tuples(xs, len - 1).map((rest) => [x, ...rest]));
}
function combos<T>(xs: T[], len: number): T[][] {
  if (len === 0) return [[]];
  return xs.flatMap((x, i) => combos(xs.slice(i + 1), len - 1).map((rest) => [x, ...rest]));
}
const values = (facts: string[]) => facts.map((f) => f.slice(f.indexOf(":") + 1));

// ---- template: ordered sequences ---------------------------------------------------
// kind 0: no repeats · 1: repeats allowed · 2: at least one `special` · 3: at least one repeated symbol
const seqKey = (row: string[]) => row.map((x, i) => `${i + 1}:${x}`).sort().join(" ");
const at = (facts: string[], x: string) => [[`${facts.length + 1}:${x}`]];
const seq: StructTemplate = {
  id: "seq",
  slots: [
    { id: "fresh", label: (p) => `any ${p.item} not used yet`, count: (p, placed) => Math.max(0, n(p) - placed), options: (facts, p) => pool(p).filter((x) => !values(facts).includes(x)).flatMap((x) => at(facts, x)) },
    { id: "any", label: (p) => `any of the ${n(p)} ${p.plural}`, count: (p) => n(p), options: (facts, p) => pool(p).flatMap((x) => at(facts, x)) },
    { id: "notSpecial", label: (p) => `any ${p.item} except ${p.special}`, count: (p) => n(p) - 1, options: (facts, p) => pool(p).filter((x) => x !== p.special).flatMap((x) => at(facts, x)) },
    { id: "special", label: (p) => `exactly ${p.special}`, count: () => 1, options: (facts, p) => at(facts, String(p.special)) },
  ],
  divisors: [
    { id: "kfact", label: (p) => `the ${k(p)}! orders of the same ${p.plural}`, value: (p) => fact(k(p)) },
    { id: "two", label: () => "2 (each one seen twice)", value: () => 2 },
  ],
  universe(p) {
    const kind = Number(p.kind);
    const rows = kind === 0 ? perms(pool(p), k(p)) : tuples(pool(p), k(p));
    return rows
      .filter((row) => (kind === 2 ? row.includes(String(p.special)) : kind === 3 ? new Set(row).size < row.length : true))
      .map(seqKey);
  },
  show: (key, p) => (key ? `"${values(key.split(" ")).join(String(p.sep ?? ""))}"` : "(nothing)"),
};

// ---- template: unordered groups, optionally with one leader ---------------------------
const picked = (facts: string[]) => values(facts);
const group: StructTemplate = {
  id: "group",
  slots: [
    { id: "fresh", label: (p) => `any ${p.item} not picked yet`, count: (p, placed) => Math.max(0, n(p) - placed), options: (facts, p) => pool(p).filter((x) => !picked(facts).includes(x)).map((x) => [`m:${x}`]) },
    { id: "any", label: (p) => `any of the ${n(p)} ${p.plural}`, count: (p) => n(p), options: (_f, p) => pool(p).map((x) => [`m:${x}`]) },
    { id: "leader", label: (p) => `the ${p.leader}: any ${p.item} not picked yet`, count: (p, placed) => Math.max(0, n(p) - placed), options: (facts, p) => pool(p).filter((x) => !picked(facts).includes(x)).map((x) => [`L:${x}`]) },
  ],
  divisors: [
    { id: "kfact", label: (p) => `the ${k(p)}! orders the ${k(p)} ${p.members ?? p.plural} can be picked in`, value: (p) => fact(k(p)) },
    { id: "allfact", label: (p) => `the ${k(p) + 1}! orders of everyone picked`, value: (p) => fact(k(p) + 1) },
    { id: "kk", label: (p) => `${k(p)} (one for each ${p.item} picked)`, value: (p) => k(p) },
    { id: "two", label: () => "2 (each one seen twice)", value: () => 2 },
  ],
  universe(p) {
    if (!p.leader) return combos(pool(p), k(p)).map((g) => g.map((x) => `m:${x}`).sort().join(" "));
    return pool(p).flatMap((lead) =>
      combos(pool(p).filter((x) => x !== lead), k(p)).map((g) => [`L:${lead}`, ...g.map((x) => `m:${x}`)].sort().join(" ")),
    );
  },
  show(key, p) {
    const facts = key ? key.split(" ") : [];
    const leads = values(facts.filter((f) => f.startsWith("L:")));
    const members = `{${values(facts.filter((f) => f.startsWith("m:"))).join(", ")}}`;
    return p.leader ? `${p.leader} ${leads.join(" & ") || "?"} with ${members}` : members;
  },
};

// ---- template: a row where two particular items must be neighbours ------------------------
const glue: StructTemplate = {
  id: "glue",
  slots: [
    { id: "block", label: (p) => `line up ${n(p) - 1} units: the pair ${pool(p)[0]}${pool(p)[1]} glued as one, plus the others`, count: (p) => fact(n(p) - 1), options: (_f, p) => perms(["*", ...pool(p).slice(2)], n(p) - 1).map((row) => [`u:${row.join("")}`]) },
    { id: "inner", label: (p) => `order inside the glued pair (${pool(p)[0]}${pool(p)[1]} or ${pool(p)[1]}${pool(p)[0]})`, count: () => 2, options: (_f, p) => [[`i:${pool(p)[0]}${pool(p)[1]}`], [`i:${pool(p)[1]}${pool(p)[0]}`]] },
    { id: "all", label: (p) => `line up all ${n(p)} ${p.plural} freely`, count: (p) => fact(n(p)), options: (_f, p) => perms(pool(p), n(p)).map((row) => [`r:${row.join("")}`]) },
  ],
  divisors: [
    { id: "two", label: () => "2 (each one seen twice)", value: () => 2 },
    { id: "nn", label: (p) => `${n(p)} (one for each ${p.item})`, value: (p) => n(p) },
  ],
  canon(facts) {
    const get = (tag: string) => facts.filter((f) => f.startsWith(tag)).map((f) => f.slice(2));
    const [rows, units, inner] = [get("r:"), get("u:"), get("i:")];
    if (rows.length === 1 && !units.length && !inner.length) return rows[0];
    if (!rows.length && units.length === 1 && inner.length === 1) return units[0].replace("*", inner[0]);
    return [...facts].sort().join(" ");
  },
  universe(p) {
    const [a, b] = pool(p);
    return perms(pool(p), n(p)).map((r) => r.join("")).filter((row) => Math.abs(row.indexOf(a) - row.indexOf(b)) === 1);
  },
  show: (key) => (/^[A-Z]+$/.test(key) ? `the row ${key}` : `an unfinished row (${key.replace("u:", "").replace("*", "[pair]")})`),
};

[seq, group, glue].forEach(registerTemplate);

// ---- cards -----------------------------------------------------------------------------
const s = (slot: string): MoveInput => ({ move: "slot", params: { slot } });
const rep = (slot: string, times: number) => Array.from({ length: times }, () => s(slot));
const div = (id: string): MoveInput => ({ move: "divide", params: { div: id } });
const CHECK: MoveInput = { move: "check" };
const COMPLEMENT: MoveInput = { move: "complement" };

const TEXT: Record<string, { insight: string; nudge: string; twistInsight: string; twistNudge: string }> = {
  "count.arrange": {
    insight: "One slot per choice, in order. Multiply, and watch whether each slot has fewer options than the last.",
    nudge: "How many choices for the first spot? Does the next spot have the same number?",
    twistInsight: "Things that must stay together act as one unit: arrange the units, then arrange inside the unit.",
    twistNudge: "Treat the inseparable pair as a single block first.",
  },
  "count.committee": {
    insight: "When order doesn't matter, count ordered picks, then divide by the orders of one group.",
    nudge: "Pick them one at a time first. How many times does that build the same group?",
    twistInsight: "Divide only by the orders of the part that is really interchangeable.",
    twistNudge: "Which of the picked people could swap places without changing the outcome?",
  },
  "count.complement": {
    insight: "\"At least one\" is easier backwards: everything minus the ones with none.",
    nudge: "How many are there with no restriction at all? How many have none of the special one?",
    twistInsight: "\"At least one repeat\" is the complement of \"all different\".",
    twistNudge: "What is the opposite of having a repeated digit?",
  },
};

interface Spec {
  id: string; skill: string; type: CardType; prompt: string; template: string; palette: string[]; divs: string[];
  full: P; small: P; smallNote: string; answer: number; path: MoveInput[]; keyMoves: string[]; why?: string; timeLimit?: number; generated?: boolean;
}
function card(c: Spec): StructCard {
  const t = TEXT[c.skill];
  return { ...c, module: "struct", insight: c.type === "twist" ? t.twistInsight : t.insight, nudge: c.type === "twist" ? t.twistNudge : t.nudge };
}
const SEQ = ["fresh", "any"];
const SEQ_C = ["any", "notSpecial", "special", "fresh"];
const A2Z = "ABCDEFGHIJ";

const CARDS: StructCard[] = [
  // ---- arrangements ----
  card({
    id: "count.arrange.w", skill: "count.arrange", type: "worked", template: "seq", palette: SEQ, divs: ["kfact", "two"],
    prompt: "Five runners finish a race with no ties. In how many ways can gold, silver and bronze be awarded?",
    full: { items: "ABCDE", k: 3, kind: 0, item: "runner", plural: "runners", sep: "" }, small: { items: "ABC", k: 3, kind: 0, item: "runner", plural: "runners", sep: "" },
    smallNote: "3 runners, 3 medals", answer: 60, path: [...rep("fresh", 3), CHECK], keyMoves: ["slot"],
    why: "Gold can go to any of 5 runners. That runner can't also take silver, so silver has 4 options, and bronze 3. Independent choices in a row multiply: 5 × 4 × 3.",
  }),
  card({
    id: "count.arrange.r1", skill: "count.arrange", type: "rep", template: "seq", palette: SEQ, divs: ["kfact", "two"],
    prompt: "Six different books are on a table. In how many ways can two of them be placed in the left and right spots of a small shelf?",
    full: { items: "ABCDEF", k: 2, kind: 0, item: "book", plural: "books", sep: "" }, small: { items: "ABC", k: 2, kind: 0, item: "book", plural: "books", sep: "" },
    smallNote: "3 books, 2 spots", answer: 30, path: [...rep("fresh", 2), CHECK], keyMoves: ["slot"],
  }),
  card({
    id: "count.arrange.r2", skill: "count.arrange", type: "rep", template: "seq", palette: SEQ, divs: ["kfact", "two"],
    prompt: "A locker code is three digits long, each digit from 1 to 5, and digits may repeat. How many codes are possible?",
    full: { items: "12345", k: 3, kind: 1, item: "digit", plural: "digits", sep: "" }, small: { items: "12", k: 3, kind: 1, item: "digit", plural: "digits", sep: "" },
    smallNote: "digits 1 and 2 only, 3 digits long", answer: 125, path: [...rep("any", 3), CHECK], keyMoves: ["slot"],
  }),
  card({
    id: "count.arrange.r3", skill: "count.arrange", type: "rep", template: "seq", palette: SEQ, divs: ["kfact", "two"],
    prompt: "Four friends stand in a single line for a photo. How many different lines are possible?",
    full: { items: "ABCD", k: 4, kind: 0, item: "friend", plural: "friends", sep: "" }, small: { items: "ABCD", k: 4, kind: 0, item: "friend", plural: "friends", sep: "" },
    smallNote: "the same 4 friends", answer: 24, path: [...rep("fresh", 4), CHECK], keyMoves: ["slot"],
  }),
  card({
    id: "count.arrange.t", skill: "count.arrange", type: "twist", template: "glue", palette: ["all", "block", "inner"], divs: ["two", "nn"],
    prompt: "Five students A, B, C, D, E line up for lunch. A and B insist on standing next to each other. How many lines are possible?",
    full: { items: "ABCDE", item: "student", plural: "students" }, small: { items: "ABCD", item: "student", plural: "students" },
    smallNote: "4 students A, B, C, D with A next to B", answer: 48, path: [s("block"), s("inner"), CHECK], keyMoves: ["slot"], timeLimit: 75,
  }),

  // ---- committees ----
  card({
    id: "count.committee.w", skill: "count.committee", type: "worked", template: "group", palette: ["fresh", "any"], divs: ["kfact", "kk", "two"],
    prompt: "Five students want to work in pairs. How many different pairs can be formed?",
    full: { items: "ABCDE", k: 2, item: "student", plural: "students" }, small: { items: "ABC", k: 2, item: "student", plural: "students" },
    smallNote: "3 students, pairs", answer: 10, path: [...rep("fresh", 2), div("kfact"), CHECK], keyMoves: ["divide"],
    why: "Picking one student and then another gives 5 × 4 = 20 ordered picks. But the pair {A, B} was built twice: A then B, and B then A. Every pair is doubled, so divide by 2.",
  }),
  card({
    id: "count.committee.r1", skill: "count.committee", type: "rep", template: "group", palette: ["fresh", "any"], divs: ["kfact", "kk", "two"],
    prompt: "Six people meet, and every two of them shake hands exactly once. How many handshakes take place?",
    full: { items: "ABCDEF", k: 2, item: "person", plural: "people" }, small: { items: "ABC", k: 2, item: "person", plural: "people" },
    smallNote: "3 people", answer: 15, path: [...rep("fresh", 2), div("kfact"), CHECK], keyMoves: ["divide"],
  }),
  card({
    id: "count.committee.r2", skill: "count.committee", type: "rep", template: "group", palette: ["fresh", "any"], divs: ["kfact", "kk", "two"],
    prompt: "A club of seven members chooses a committee of three, with no special roles. How many committees are possible?",
    full: { items: "ABCDEFG", k: 3, item: "member", plural: "members" }, small: { items: "ABCD", k: 3, item: "member", plural: "members" },
    smallNote: "4 members, committee of 3", answer: 35, path: [...rep("fresh", 3), div("kfact"), CHECK], keyMoves: ["divide"],
  }),
  card({
    id: "count.committee.r3", skill: "count.committee", type: "rep", template: "group", palette: ["fresh", "any"], divs: ["kfact", "kk", "two"],
    prompt: "A pizza shop offers six toppings. How many pizzas with exactly three different toppings can be ordered?",
    full: { items: "ABCDEF", k: 3, item: "topping", plural: "toppings" }, small: { items: "ABCD", k: 3, item: "topping", plural: "toppings" },
    smallNote: "4 toppings, choose 3", answer: 20, path: [...rep("fresh", 3), div("kfact"), CHECK], keyMoves: ["divide"],
  }),
  card({
    id: "count.committee.t", skill: "count.committee", type: "twist", template: "group", palette: ["leader", "fresh", "any"], divs: ["kfact", "allfact", "kk"],
    prompt: "From six scouts, a troop picks one captain and two helpers. The two helpers have the same job. In how many ways can this be done?",
    full: { items: "ABCDEF", k: 2, item: "scout", plural: "scouts", leader: "captain", members: "helpers" }, small: { items: "ABCD", k: 2, item: "scout", plural: "scouts", leader: "captain", members: "helpers" },
    smallNote: "4 scouts, 1 captain and 2 helpers", answer: 60, path: [s("leader"), ...rep("fresh", 2), div("kfact"), CHECK], keyMoves: ["divide"], timeLimit: 75,
  }),

  // ---- complement ----
  card({
    id: "count.complement.w", skill: "count.complement", type: "worked", template: "seq", palette: SEQ_C, divs: ["two"],
    prompt: "How many three-digit codes, using digits 0 to 9 with repeats allowed, contain at least one 7?",
    full: { items: "0123456789", k: 3, kind: 2, special: "7", item: "digit", plural: "digits", sep: "" }, small: { items: "78", k: 3, kind: 2, special: "7", item: "digit", plural: "digits", sep: "" },
    smallNote: "digits 7 and 8 only, 3 digits long", answer: 271, path: [...rep("any", 3), COMPLEMENT, ...rep("notSpecial", 3), CHECK], keyMoves: ["complement", "subtract"],
    why: "Counting codes with one 7, two 7s and three 7s separately is messy and easy to double count. Instead count all 10 × 10 × 10 codes and remove the 9 × 9 × 9 that avoid 7 completely.",
    timeLimit: 60,
  }),
  card({
    id: "count.complement.r1", skill: "count.complement", type: "rep", template: "seq", palette: SEQ_C, divs: ["two"],
    prompt: "A coin is flipped four times and the results are written in order. How many of the possible records contain at least one head (H)?",
    full: { items: "HT", k: 4, kind: 2, special: "H", item: "result", plural: "results", sep: "" }, small: { items: "HT", k: 4, kind: 2, special: "H", item: "result", plural: "results", sep: "" },
    smallNote: "the same 4 flips", answer: 15, path: [...rep("any", 4), COMPLEMENT, ...rep("notSpecial", 4), CHECK], keyMoves: ["complement", "subtract"], timeLimit: 60,
  }),
  card({
    id: "count.complement.r2", skill: "count.complement", type: "rep", template: "seq", palette: SEQ_C, divs: ["two"],
    prompt: "A standard die is rolled three times and the results are written in order. How many of the possible records contain at least one 6?",
    full: { items: "123456", k: 3, kind: 2, special: "6", item: "number", plural: "numbers", sep: "" }, small: { items: "56", k: 3, kind: 2, special: "6", item: "number", plural: "numbers", sep: "" },
    smallNote: "a die showing only 5 or 6, rolled 3 times", answer: 91, path: [...rep("any", 3), COMPLEMENT, ...rep("notSpecial", 3), CHECK], keyMoves: ["complement", "subtract"], timeLimit: 60,
  }),
  card({
    id: "count.complement.r3", skill: "count.complement", type: "rep", template: "seq", palette: SEQ_C, divs: ["two"],
    prompt: "How many four-letter strings made from the letters A, B, C, D, E (repeats allowed) contain at least one A?",
    full: { items: "ABCDE", k: 4, kind: 2, special: "A", item: "letter", plural: "letters", sep: "" }, small: { items: "AB", k: 4, kind: 2, special: "A", item: "letter", plural: "letters", sep: "" },
    smallNote: "letters A and B only, 4 letters long", answer: 369, path: [...rep("any", 4), COMPLEMENT, ...rep("notSpecial", 4), CHECK], keyMoves: ["complement", "subtract"], timeLimit: 60,
  }),
  card({
    id: "count.complement.t", skill: "count.complement", type: "twist", template: "seq", palette: SEQ_C, divs: ["two"],
    prompt: "A PIN has four digits, each from 0 to 9. How many PINs have at least one digit that appears more than once?",
    full: { items: "0123456789", k: 4, kind: 3, special: "0", item: "digit", plural: "digits", sep: "" }, small: { items: "01234", k: 4, kind: 3, special: "0", item: "digit", plural: "digits", sep: "" },
    smallNote: "digits 0 to 4 only, 4 digits long", answer: 4960, path: [...rep("any", 4), COMPLEMENT, ...rep("fresh", 4), CHECK], keyMoves: ["complement", "subtract"], timeLimit: 90,
  }),
];

const skill = (id: string, title: string, blurb: string, prereqs: string[]): Skill => ({
  id, title, blurb, prereqs, worked: `${id}.w`, reps: [`${id}.r1`, `${id}.r2`, `${id}.r3`], twist: `${id}.t`,
});
const SKILLS: Skill[] = [
  skill("count.arrange", "Arrangements", "Multiply the options slot by slot.", []),
  skill("count.committee", "Committees", "Order doesn't matter: divide by symmetry.", ["count.arrange"]),
  skill("count.complement", "At least one", "Count everything, subtract the ones with none.", ["count.arrange"]),
];

// ---- generators: the same templates with fresh numbers and settings -------------------------
const ARRANGE = [
  ["runner", "runners", (a: number, b: number) => `${a} runners race with no ties. In how many ways can the first ${b} places be filled?`],
  ["painting", "paintings", (a: number, b: number) => `A gallery owns ${a} different paintings and hangs ${b} of them in a row. How many different rows are possible?`],
  ["song", "songs", (a: number, b: number) => `A playlist of ${b} different songs, in order, is made from ${a} songs. How many playlists are possible?`],
] as const;
const GROUPS = [
  ["player", "players", (a: number, b: number) => `A coach picks ${b} of ${a} players to hand out water. The ${b} players have the same job. How many choices are there?`],
  ["card", "cards", (a: number, b: number) => `From ${a} different cards, a hand of ${b} cards is dealt. The order of the cards in a hand doesn't matter. How many hands are possible?`],
  ["flavour", "flavours", (a: number, b: number) => `An ice-cream bar has ${a} flavours. How many bowls with ${b} different flavours can be made?`],
] as const;
const AT_LEAST = [
  ["0123456789", "3", "digit", "digits", (len: number) => `How many ${len}-digit codes, using digits 0 to 9 with repeats allowed, contain at least one 3?`],
  ["ABCDEF", "F", "letter", "letters", (len: number) => `How many ${len}-letter strings made from A, B, C, D, E, F (repeats allowed) contain at least one F?`],
  ["1234", "1", "number", "numbers", (len: number) => `A spinner shows 1, 2, 3 or 4. It is spun ${len} times and the results are written in order. How many records contain at least one 1?`],
  ["RGB", "R", "colour", "colours", (len: number) => `A row of ${len} lights can each be red (R), green (G) or blue (B). How many rows have at least one red light?`],
] as const;
const choose = (a: number, b: number) => fact(a) / (fact(b) * fact(a - b));

function generate(skillId: string, type: "rep" | "twist", seed: number): StructCard {
  const r = rng(seed * 6007 + skillId.length * 7907 + (type === "twist" ? 9973 : 0));
  const pick = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const id = `${skillId}~${type}~${seed}`;
  const base = { id, skill: skillId, type, generated: true } as const;
  switch (`${skillId}/${type}`) {
    case "count.arrange/rep": {
      const [item, plural, text] = ARRANGE[pick(0, ARRANGE.length - 1)];
      const b = pick(2, 3);
      const a = pick(b + 2, 8);
      return card({
        ...base, template: "seq", palette: SEQ, divs: ["kfact", "two"], prompt: text(a, b),
        full: { items: A2Z.slice(0, a), k: b, kind: 0, item, plural, sep: "" }, small: { items: A2Z.slice(0, b + 1), k: b, kind: 0, item, plural, sep: "" },
        smallNote: `${b + 1} ${plural}, ${b} spots`, answer: fact(a) / fact(a - b), path: [...rep("fresh", b), CHECK], keyMoves: ["slot"],
      });
    }
    case "count.arrange/twist": {
      const a = pick(4, 6);
      const names = A2Z.slice(0, a);
      return card({
        ...base, template: "glue", palette: ["all", "block", "inner"], divs: ["two", "nn"],
        prompt: `${a} children ${names.split("").join(", ")} sit in a row of ${a} seats. ${names[0]} and ${names[1]} must sit side by side. How many seatings are possible?`,
        full: { items: names, item: "child", plural: "children" }, small: { items: "ABC", item: "child", plural: "children" },
        smallNote: "3 children A, B, C with A next to B", answer: 2 * fact(a - 1), path: [s("block"), s("inner"), CHECK], keyMoves: ["slot"], timeLimit: 75,
      });
    }
    case "count.committee/rep": {
      const [item, plural, text] = GROUPS[pick(0, GROUPS.length - 1)];
      const b = pick(2, 3);
      const a = pick(b + 2, 8);
      return card({
        ...base, template: "group", palette: ["fresh", "any"], divs: ["kfact", "kk", "two"], prompt: text(a, b),
        full: { items: A2Z.slice(0, a), k: b, item, plural }, small: { items: A2Z.slice(0, b + 1), k: b, item, plural },
        smallNote: `${b + 1} ${plural}, choose ${b}`, answer: choose(a, b), path: [...rep("fresh", b), div("kfact"), CHECK], keyMoves: ["divide"],
      });
    }
    case "count.committee/twist": {
      const a = pick(5, 8);
      return card({
        ...base, template: "group", palette: ["leader", "fresh", "any"], divs: ["kfact", "allfact", "kk"],
        prompt: `A band of ${a} musicians chooses one conductor and two page-turners. The two page-turners have the same job. In how many ways can this be done?`,
        full: { items: A2Z.slice(0, a), k: 2, item: "musician", plural: "musicians", leader: "conductor", members: "page-turners" },
        small: { items: "ABCD", k: 2, item: "musician", plural: "musicians", leader: "conductor", members: "page-turners" },
        smallNote: "4 musicians, 1 conductor and 2 page-turners", answer: a * choose(a - 1, 2), path: [s("leader"), ...rep("fresh", 2), div("kfact"), CHECK], keyMoves: ["divide"], timeLimit: 75,
      });
    }
    case "count.complement/rep": {
      const [items, special, item, plural, text] = AT_LEAST[pick(0, AT_LEAST.length - 1)];
      const len = pick(2, 4);
      const smallItems = special + [...items].find((x) => x !== special);
      return card({
        ...base, template: "seq", palette: SEQ_C, divs: ["two"], prompt: text(len),
        full: { items, k: len, kind: 2, special, item, plural, sep: "" }, small: { items: smallItems, k: len, kind: 2, special, item, plural, sep: "" },
        smallNote: `only ${smallItems[0]} and ${smallItems[1]}, length ${len}`, answer: items.length ** len - (items.length - 1) ** len,
        path: [...rep("any", len), COMPLEMENT, ...rep("notSpecial", len), CHECK], keyMoves: ["complement", "subtract"], timeLimit: 60,
      });
    }
    case "count.complement/twist": {
      const len = pick(3, 4);
      const a = pick(len + 2, 9);
      const items = "123456789".slice(0, a);
      return card({
        ...base, template: "seq", palette: SEQ_C, divs: ["two"],
        prompt: `A code has ${len} digits, each from 1 to ${a}. How many codes use at least one digit more than once?`,
        full: { items, k: len, kind: 3, special: "1", item: "digit", plural: "digits", sep: "" }, small: { items: items.slice(0, len + 1), k: len, kind: 3, special: "1", item: "digit", plural: "digits", sep: "" },
        smallNote: `digits 1 to ${len + 1} only, ${len} digits long`, answer: a ** len - fact(a) / fact(a - len),
        path: [...rep("any", len), COMPLEMENT, ...rep("fresh", len), CHECK], keyMoves: ["complement", "subtract"], timeLimit: 90,
      });
    }
  }
  throw new Error(`No generator for ${skillId}/${type}`);
}

export const counting: TopicPack<StructCard> = {
  id: "count",
  title: "Counting",
  module: "struct",
  topic: "counting_probability",
  skills: SKILLS,
  cards: CARDS,
  generate,
};
