// Card validation. `npm run verify:cards` runs this before every build, and a single
// problem fails the build: a card that has not passed never reaches a student.
//
// Three layers:
//   1. shape      every field present and sensible, ids and references resolve, markup parses;
//   2. key        the stored answer equals an INDEPENDENT recomputation (content/verifiers.ts),
//                 expressions are compared symbolically, the checker accepts the key and
//                 rejects every listed slip;
//   3. coherence  the explanation states the answer, the card type matches its interaction,
//                 every concept with cards can actually be taken to mastery.
import { conceptOf, objectiveOf, requiredPrereqs, CONCEPTS } from "../curriculum";
import { EXTRA_CHECKS, FAMILY_VERIFIERS, VERIFIERS } from "../content/verifiers";
import { parseExpr } from "../math/ast";
import { pEq, tryPoly } from "../math/poly";
import { parseRational, rEq } from "../math/rational";
import { answerText, check, unfactored } from "./check";
import { CARDS, FAMILIES, cardsOf, hasCards } from "./index";
import { MarkupError, parseRich, plainText } from "./markup";
import type { Card, CardFamily, Response } from "./types";

export interface Problem { card: string; problem: string }
export interface Report { cards: number; variants: number; concepts: number; problems: Problem[] }

export const VARIANT_SEEDS = 30;
/** Card text must never name a real contest or a problem number: all content is original. */
const BANNED = /\b(AMC|AIME|MAA|MATHCOUNTS|USAMO|USAJMO|olympiad)\b|#\s*\d+/i;
const LIMITS = { title: 48, prompt: 420, takeaway: 150, whenToUse: 160, feedback: 320, hint: 220 };

const sameNumber = (a: string, b: string) => { const [x, y] = [parseRational(a), parseRational(b)]; return !!x && !!y && rEq(x, y); };
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
/** Flatten typography so "5x²(x − 2)" and "5x^2(x - 2)" compare equal. */
const squash = (s: string) => s.replace(/[−–]/g, "-").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => "^" + "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).replace(/[\s·*,]/g, "");

function texts(card: Card): [string, string][] {
  const i = card.interaction;
  const out: [string, string][] = [
    ["title", card.title], ["prompt", card.prompt], ["feedback.correct", card.feedback.correct], ["feedback.incorrect", card.feedback.incorrect],
    ["explanation", card.explanation.summary], ["takeaway", card.takeaway], ["whenToUse", card.whenToUse],
  ];
  if (card.hint) out.push(["hint", card.hint]);
  if (card.teach) out.push(["teach", card.teach.body], ...(card.teach.steps ?? []).map((s, k) => [`teach step ${k + 1}`, s] as [string, string]));
  (card.explanation.steps ?? []).forEach((s, k) => out.push([`explanation step ${k + 1}`, s]));
  if (i.kind === "choice" || i.kind === "multi") for (const o of i.options) out.push([`option ${o.id}`, o.text], ...(o.feedback ? [[`option ${o.id} feedback`, o.feedback] as [string, string]] : []));
  if (i.kind === "order") for (const o of i.items) out.push([`step ${o.id}`, o.text], ...(o.feedback ? [[`step ${o.id} feedback`, o.feedback] as [string, string]] : []));
  if (i.kind === "blanks") out.push(["blanks text", i.text.replace(/\{\{\d+\}\}/g, "__")]);
  if (i.kind === "explain") out.push(["model", i.model], ...i.points.map((p, k) => [`point ${k + 1}`, p] as [string, string]));
  if (i.kind === "numeric" || i.kind === "expression") for (const s of i.slips ?? []) out.push([`slip ${s.answer}`, s.feedback]);
  if (i.kind === "blanks") for (const b of i.blanks) for (const s of b.slips ?? []) out.push([`slip ${s.answer}`, s.feedback]);
  return out;
}

/** The response a student who knows the answer would give. */
export function keyResponse(card: Card): Response {
  const i = card.interaction;
  switch (i.kind) {
    case "numeric": return { kind: "numeric", text: i.answer };
    case "expression": return { kind: "expression", text: i.answer };
    case "choice": return { kind: "choice", id: i.answer };
    case "multi": return { kind: "multi", ids: i.answers };
    case "order": return { kind: "order", ids: i.items.map((o) => o.id) };
    case "blanks": return { kind: "blanks", values: i.blanks.map((b) => b.answer) };
    case "tap": return { kind: "tap", ids: i.answers };
    case "explain": return { kind: "explain", text: "A complete explanation in my own words.", covered: i.points.map((_, k) => k) };
  }
}

/** A plausible wrong response, for checking that the checker does reject things. */
export function wrongResponse(card: Card): Response {
  const i = card.interaction;
  switch (i.kind) {
    case "numeric": return { kind: "numeric", text: sameNumber(i.answer, "987654") ? "1" : "987654" };
    case "expression": return { kind: "expression", text: `(${i.answer}) + 1` };
    case "choice": return { kind: "choice", id: i.options.find((o) => o.id !== i.answer)!.id };
    case "multi": { const other = i.options.find((o) => !i.answers.includes(o.id)); return { kind: "multi", ids: other ? [...i.answers, other.id] : i.answers.slice(1) }; }
    case "order": return { kind: "order", ids: [...i.items.map((o) => o.id)].reverse() };
    case "blanks": return { kind: "blanks", values: i.blanks.map(() => "987654") };
    case "tap": { const ids = (card.figure?.items ?? []).flatMap((it) => (it.t === "target" && !i.answers.includes(it.id) ? [it.id] : [])); return { kind: "tap", ids: ids.slice(0, 1) }; }
    case "explain": return { kind: "explain", text: "A partial explanation in my own words.", covered: [] };
  }
}

function checkShape(card: Card, add: (p: string) => void) {
  const concept = conceptOf(card.conceptId);
  if (!concept) return add(`unknown concept ${card.conceptId}`);
  if (!card.id.startsWith(`${card.conceptId}.`)) add("id must start with its concept id");
  if (!concept.objectives.some((o) => o.id === card.objectiveId) || !objectiveOf(card.objectiveId)) add(`objective ${card.objectiveId} is not an objective of ${card.conceptId}`);
  if (![1, 2, 3, 4, 5].includes(card.difficulty)) add("difficulty must be 1 to 5");
  if ((card.type === "insight" || card.type === "technique") && card.difficulty > 3) add("a teaching card should not be harder than 3");
  if (card.type === "variation" && card.difficulty < 3) add("a variation should be at least difficulty 3");
  if (!(card.seconds >= 15 && card.seconds <= 120)) add("estimated time must be 15 to 120 seconds");
  if (card.type === "technique" && !card.teach) add("a technique card must teach the method before the task");
  if (card.type === "technique" && card.interaction.kind !== "order" && !(card.teach?.steps?.length)) add("a technique card must demonstrate the method in steps");
  if (card.type !== "technique" && card.teach) add("only technique cards carry a teaching section");
  if ((card.type === "application" || card.type === "variation") && ["choice", "multi", "explain", "order"].includes(card.interaction.kind)) add("application and variation cards must ask for the answer itself, not a selection");
  if (card.type !== "insight" && card.type !== "technique" && !card.hint && card.difficulty >= 3 && card.interaction.kind !== "explain" && card.interaction.kind !== "multi" && card.interaction.kind !== "choice") add("a card of difficulty 3 or more needs a hint");
  for (const r of card.requires ?? []) {
    if (!conceptOf(r)) add(`requires unknown concept ${r}`);
    else if (!hasCards(r)) add(`requires ${r}, which has no cards yet`);
  }
  if (!card.verification.note.trim()) add("verification needs a note");
  if (!card.source.author || !/^\d{4}-\d{2}-\d{2}$/.test(card.source.created)) add("provenance needs an author and a date");
  if (card.source.origin !== "original" && !card.source.basedOn) add("adapted and generated cards must say what they are based on");

  for (const [where, text] of texts(card)) {
    if (!text.trim()) { add(`${where} is empty`); continue; }
    try { parseRich(text); } catch (e) { add(`${where}: ${e instanceof MarkupError ? e.message : String(e)}`); continue; }
    if (BANNED.test(plainText(text))) add(`${where} names a real contest or problem number`);
  }
  if (card.title.length > LIMITS.title) add("title is too long");
  if (plainText(card.prompt).length > LIMITS.prompt) add("prompt is too long for a card");
  if (plainText(card.takeaway).length > LIMITS.takeaway) add("takeaway is too long to remember");
  if (plainText(card.whenToUse).length > LIMITS.whenToUse) add("whenToUse is too long");
  if (card.hint && plainText(card.hint).length > LIMITS.hint) add("hint is too long");
  if (plainText(card.feedback.correct).length > LIMITS.feedback || plainText(card.feedback.incorrect).length > LIMITS.feedback) add("feedback is too long");
  if (/^(correct|incorrect|wrong|right)[.!]?$/i.test(card.feedback.incorrect.trim()) || plainText(card.feedback.incorrect).length < 30) add("feedback.incorrect must explain the reasoning, not just the verdict");
  if (plainText(card.feedback.correct).length < 15) add("feedback.correct must say why the reasoning works");

  const fig = card.figure;
  if (fig) {
    if (fig.alt.trim().length < 30) add("figure needs a real text description");
    const inside = ([x, y]: [number, number]) => x >= 0 && x <= fig.w && y >= 0 && y <= fig.h;
    for (const it of fig.items) {
      const pts: [number, number][] = it.t === "line" || it.t === "tick" ? [it.a, it.b] : it.t === "poly" ? it.pts : it.t === "circle" ? [it.c] : it.t === "angle" ? [it.at] : [it.at];
      if (!pts.every(inside)) add(`figure item ${it.t} lies outside the drawing area`);
    }
  }
  const targets = (fig?.items ?? []).flatMap((it) => (it.t === "target" ? [it.id] : []));
  if (new Set(targets).size !== targets.length) add("duplicate tap target ids");

  const i = card.interaction;
  const unique = (ids: string[], what: string) => { if (new Set(ids).size !== ids.length) add(`duplicate ${what} ids`); };
  switch (i.kind) {
    case "numeric":
      if (!parseRational(i.answer)) add("numeric answer is not a number");
      for (const s of i.slips ?? []) { if (!parseRational(s.answer)) add(`slip ${s.answer} is not a number`); else if (sameNumber(s.answer, i.answer)) add(`slip ${s.answer} equals the answer`); }
      break;
    case "expression": {
      const key = (() => { try { return tryPoly(parseExpr(i.answer)); } catch { return null; } })();
      if (!key) { add("expression answer does not parse as a polynomial"); break; }
      if (i.form === "factored" && unfactored(parseExpr(i.answer))) add(`the key is not completely factored: ${unfactored(parseExpr(i.answer))}`);
      for (const s of i.slips ?? []) {
        const p = (() => { try { return tryPoly(parseExpr(s.answer)); } catch { return null; } })();
        if (!p) add(`slip ${s.answer} does not parse`); else if (pEq(p, key)) add(`slip ${s.answer} equals the answer`);
      }
      break;
    }
    case "choice":
      unique(i.options.map((o) => o.id), "option");
      if (i.options.length < 2 || i.options.length > 4) add("a choice needs 2 to 4 options");
      if (!i.options.some((o) => o.id === i.answer)) add("choice answer is not one of the options");
      if (i.options.some((o) => o.id !== i.answer && !o.feedback)) add("every wrong option needs feedback about the reasoning");
      break;
    case "multi":
      unique(i.options.map((o) => o.id), "option");
      if (!i.answers.length || i.answers.length === i.options.length) add("a multi-select needs at least one right and one wrong option");
      if (i.answers.some((a) => !i.options.some((o) => o.id === a))) add("multi answer is not one of the options");
      if (i.options.some((o) => !o.feedback)) add("every option of a multi-select needs feedback");
      break;
    case "order":
      unique(i.items.map((o) => o.id), "step");
      if (i.items.length < 3 || i.items.length > 5) add("an ordering needs 3 to 5 steps");
      break;
    case "blanks": {
      const marks = [...i.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      if (marks.length !== i.blanks.length || marks.some((m, k) => m !== k)) add("blank markers must be {{0}}, {{1}}, … in order, one per blank");
      if (/\$[^$]*\{\{\d+\}\}[^$]*\$/.test(i.text.replace(/\$[^$]*\$/g, (m) => (m.includes("{{") ? m : "")))) add("a blank cannot sit inside $…$");
      for (const b of i.blanks) if (!parseRational(b.answer)) add(`blank answer ${b.answer} is not a number`);
      break;
    }
    case "tap":
      if (!targets.length) add("a tap card needs a figure with targets");
      if (i.answers.some((a) => !targets.includes(a))) add("tap answer is not a target in the figure");
      if (i.answers.length === targets.length) add("at least one target must be wrong");
      break;
    case "explain":
      if (i.points.length < 2 || i.points.length > 4) add("an explain card needs 2 to 4 key points");
      break;
  }
}

function checkKey(card: Card, add: (p: string) => void, verifier: (() => string | string[]) | undefined) {
  const i = card.interaction;
  const computable = i.kind !== "order" && i.kind !== "explain";
  if (card.verification.method === "computed") {
    if (!computable) add(`${i.kind} cards have no computable key; mark them reasoned`);
    else if (!verifier) add("marked computed but has no independent verifier");
  } else if (verifier) add("has a verifier but is marked reasoned");
  if ((i.kind === "numeric" || i.kind === "expression" || i.kind === "blanks") && card.verification.method !== "computed") add("a card with a numeric or symbolic answer must be independently computed");

  if (verifier && computable) {
    let got: string | string[];
    try { got = verifier(); } catch (e) { return add(`verifier failed: ${e instanceof Error ? e.message : String(e)}`); }
    const one = (g: string | string[]) => (Array.isArray(g) ? g.join(", ") : g);
    switch (i.kind) {
      case "numeric": if (Array.isArray(got) || !sameNumber(got, i.answer)) add(`key ${i.answer} ≠ independent result ${one(got)}`); break;
      case "expression": {
        const [a, b] = [tryPoly(parseExpr(i.answer)), Array.isArray(got) ? null : tryPoly(parseExpr(got))];
        if (!a || !b || !pEq(a, b)) add(`key ${i.answer} does not expand to ${one(got)}`);
        break;
      }
      case "choice": if (got !== i.answer) add(`key ${i.answer} ≠ independent result ${one(got)}`); break;
      case "multi": if (!Array.isArray(got) || !sameSet(got, i.answers)) add(`key ${i.answers.join(", ")} ≠ independent result ${one(got)}`); break;
      case "tap": if (!Array.isArray(got) || !sameSet(got, i.answers)) add(`key ${i.answers.join(", ")} ≠ independent result ${one(got)}`); break;
      case "blanks": if (!Array.isArray(got) || got.length !== i.blanks.length || got.some((g, k) => !sameNumber(g, i.blanks[k].answer))) add(`key ${i.blanks.map((b) => b.answer).join(", ")} ≠ independent result ${one(got)}`); break;
    }
  }

  // The live checker must accept the key and reject a wrong answer and every listed slip.
  if (check(card, keyResponse(card)).status !== "correct") add("the checker does not accept the card's own key");
  if (check(card, wrongResponse(card)).status !== "incorrect") add("the checker does not reject a wrong answer");
  const slips = i.kind === "numeric" || i.kind === "expression" ? (i.slips ?? []) : [];
  for (const s of slips) {
    const r = check(card, { kind: i.kind, text: s.answer } as Response);
    if (r.status !== "incorrect" || r.message !== s.feedback) add(`slip ${s.answer} does not produce its own feedback`);
  }
}

function checkCoherence(card: Card, add: (p: string) => void) {
  const i = card.interaction;
  const explanation = squash(plainText([card.explanation.summary, ...(card.explanation.steps ?? [])].join(" ")));
  const mentions = (answer: string) => new RegExp(`(^|[^\\d./^])${squash(answer).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\d/]|$)`).test(explanation);
  if (i.kind === "numeric" && !mentions(i.answer)) add(`the explanation never states the answer ${i.answer}`);
  if (i.kind === "expression" && !explanation.includes(squash(answerText(card)))) add(`the explanation never states the answer ${answerText(card)}`);
  if (i.kind === "blanks") for (const b of i.blanks) if (!mentions(b.answer)) add(`the explanation never states the blank's answer ${b.answer}`);
  if (card.takeaway.trim().endsWith("?")) add("a takeaway is a statement, not a question");
}

export function validateCard(card: Card, verifier?: () => string | string[]): string[] {
  const problems: string[] = [];
  const add = (p: string) => problems.push(p);
  try {
    checkShape(card, add);
    if (!problems.length) { checkKey(card, add, verifier); checkCoherence(card, add); }
  } catch (e) {
    add(`validation crashed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return problems;
}

function validateFamily(f: CardFamily, problems: Problem[]): number {
  const verify = (FAMILY_VERIFIERS as Record<string, ((p: Record<string, number>) => string) | undefined>)[f.id];
  if (!verify) problems.push({ card: f.id, problem: "family has no independent verifier" });
  if (!conceptOf(f.conceptId) || !hasCards(f.conceptId)) problems.push({ card: f.id, problem: "family belongs to a concept with no hand-written cards" });
  const prompts = new Set<string>();
  for (let seed = 1; seed <= VARIANT_SEEDS; seed++) {
    let card: Card;
    try { card = f.make(seed); } catch (e) { problems.push({ card: `${f.id}~${seed}`, problem: `generator threw: ${String(e)}` }); continue; }
    if (JSON.stringify(f.make(seed)) !== JSON.stringify(card)) problems.push({ card: card.id, problem: "generator is not deterministic" });
    if (card.family !== f.id || card.type !== f.type || card.conceptId !== f.conceptId) problems.push({ card: card.id, problem: "variant does not match its family" });
    if (!card.params) problems.push({ card: card.id, problem: "variant records no parameters" });
    prompts.add(card.prompt);
    for (const p of validateCard(card, verify && card.params ? () => verify(card.params!) : undefined)) problems.push({ card: card.id, problem: p });
  }
  if (prompts.size < 8) problems.push({ card: f.id, problem: `only ${prompts.size} distinct variants in ${VARIANT_SEEDS} seeds` });
  return VARIANT_SEEDS;
}

/** Whole-bank rules: ids, coverage, and that mastery is reachable for every concept that has cards. */
function checkBank(problems: Problem[]) {
  const ids = new Set<string>();
  for (const c of CARDS) {
    if (ids.has(c.id)) problems.push({ card: c.id, problem: "duplicate card id" });
    ids.add(c.id);
    if (c.id.includes("~")) problems.push({ card: c.id, problem: "\"~\" is reserved for generated variants" });
  }
  const familyIds = new Set<string>();
  for (const f of FAMILIES) {
    if (familyIds.has(f.id) || ids.has(f.id)) problems.push({ card: f.id, problem: "duplicate family id" });
    familyIds.add(f.id);
  }
  for (const id of Object.keys(VERIFIERS)) if (!ids.has(id)) problems.push({ card: id, problem: "verifier for a card that does not exist" });
  for (const id of Object.keys(EXTRA_CHECKS)) if (!ids.has(id)) problems.push({ card: id, problem: "extra check for a card that does not exist" });
  for (const id of Object.keys(FAMILY_VERIFIERS)) if (!familyIds.has(id)) problems.push({ card: id, problem: "verifier for a family that does not exist" });

  for (const concept of CONCEPTS) {
    const cards = cardsOf(concept.id);
    if (!cards.length) continue;
    const n = (t: Card["type"]) => cards.filter((c) => c.type === t).length;
    const fail = (problem: string) => problems.push({ card: concept.id, problem });
    if (n("insight") + n("technique") < 2) fail("needs at least two teaching cards (insight or technique)");
    if (!n("technique")) fail("needs a technique card");
    if (!cards.some((c) => c.type === "recognition" && c.interaction.kind !== "explain")) fail("needs a checked recognition card");
    if (n("application") < 2) fail("needs at least two application cards (mastery asks for two different ones)");
    if (!n("variation")) fail("needs a variation card (mastery asks for transfer)");
    for (const o of concept.objectives) if (!cards.some((c) => c.objectiveId === o.id)) fail(`objective ${o.id} has no card`);
    for (const p of requiredPrereqs(concept)) if (!hasCards(p)) fail(`requires ${p}, which has no cards, so it could never unlock`);
  }
  const choice = CARDS.filter((c) => c.interaction.kind === "choice").length;
  if (choice / CARDS.length > 0.2) problems.push({ card: "(bank)", problem: `${choice} of ${CARDS.length} cards are single-choice: multiple choice must not be the default` });
}

export function validateAllCards(): Report {
  const problems: Problem[] = [];
  checkBank(problems);
  for (const card of CARDS) for (const p of validateCard(card, VERIFIERS[card.id])) problems.push({ card: card.id, problem: p });
  for (const [id, test] of Object.entries(EXTRA_CHECKS)) {
    let ok = false;
    try { ok = test(); } catch { ok = false; }
    if (!ok) problems.push({ card: id, problem: "a fact quoted in the explanation failed its recomputation" });
  }
  let variants = 0;
  for (const f of FAMILIES) variants += validateFamily(f, problems);
  return { cards: CARDS.length, variants, concepts: CONCEPTS.filter((c) => hasCards(c.id)).length, problems };
}
