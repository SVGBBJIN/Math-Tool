// No screen in the engine renders a multiple-choice set: not for answers, not for "pick the
// next move", not in worked examples. Each screen is rendered to HTML and every tappable
// control is accounted for: it must be a standing toolbox tile (the same for every card), a
// fixed control (Hint, Undo...), a keypad key, or a piece of the student's own workspace.
// The error-type row on the reveal is metadata about a miss, not part of a problem, and is
// the only exception (it lives inside data-metadata).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardRunner, type RunResult } from "@/components/engine/CardRunner";
import { Reveal, WorkedExample } from "@/components/engine/Panels";
import { show } from "@/lib/engine/expr/ast";
import { exprModule } from "@/lib/engine/expr/module";
import { partsOf, type ExprState } from "@/lib/engine/expr/state";
import { generateCard, moduleOf, PACKS, type Card } from "@/lib/engine/registry";
import { structModule, structPieces, type StructCard } from "@/lib/engine/struct/module";
import { guidance, hint } from "@/lib/engine/ui";
import * as ui from "@/lib/engine/ui";

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/g, "/").trim();

/** Accessible names of every <button> outside metadata, in order. */
function buttons(html: string): string[] {
  const outside = html.replace(/<div data-metadata="[^"]*"[\s\S]*?<\/fieldset>/g, "");
  return [...outside.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, inner]) => {
    const label = attrs.match(/aria-label="([^"]*)"/);
    return decode(label ? label[1] : inner);
  });
}

const CONTROLS = new Set([
  "Hint", "Hint 2/3", "Hint 3/3", "Undo", "Not sure", "Show me this step", "Got it, my turn", "Check my structure", "Next", "Cancel", "Apply",
  "Equals sign: drop a move here to use it on the equation", "Place at the end", "Empty slot: drop a piece here",
]);
const TOOLBOX = new Set([...exprModule.toolbox(), ...structModule.toolbox()].map((m) => m.name));

function allowed(card: Card): Set<string> {
  const out = new Set([...CONTROLS, ...TOOLBOX]);
  if (card.module === "struct") for (const p of structPieces(card as StructCard)) out.add(p.label);
  else {
    const s = exprModule.init(card as never) as ExprState;
    const sides = s.kind === "eqs" ? s.eqs.flatMap((e) => [e.lhs, e.rhs]) : [s.expr];
    for (const side of sides) {
      const parts = partsOf(side);
      (parts.length ? parts : [side]).forEach((p, i) => {
        out.add(show(p));
        out.add(`Place before term ${i + 1}`);
      });
    }
  }
  return out;
}

const HAND: Card[] = PACKS.flatMap((p) => p.cards);
const GENERATED: Card[] = PACKS.flatMap((p) => p.skills.flatMap((s) => [generateCard(s.id, "rep", 7), generateCard(s.id, "twist", 7)]));
const ALL = [...HAND, ...GENERATED];
const noop = () => {};

describe("no multiple choice: card screens", () => {
  it.each(ALL.map((c) => [c.id, c] as const))("%s at Levels 1, 2 and 3", (_id, card) => {
    for (const level of [1, 2, 3] as const) {
      const html = renderToStaticMarkup(<CardRunner card={card} level={level} budget={30} timed label="Test" onFinish={noop} />);
      // No form controls that present a fixed set of options.
      expect(html).not.toMatch(/<select|type="radio"|type="checkbox"|role="radio|role="listbox"|role="option"|role="menu/);
      const allow = allowed(card);
      for (const b of buttons(html)) expect(allow.has(b), `unexpected control "${b}" on ${card.id} (Level ${level})`).toBe(true);
      // The answer itself is never something to tap.
      const answer = moduleOf(card).answer(card);
      expect(buttons(html)).not.toContain(answer);
    }
  });

  it("the toolbox is the same standing palette on every card", () => {
    const tiles = (card: Card) => buttons(renderToStaticMarkup(<CardRunner card={card} level={2} budget={30} timed={false} label="T" onFinish={noop} />)).filter((b) => TOOLBOX.has(b));
    const byModule = new Map<string, string>();
    for (const card of ALL) {
      const found = tiles(card);
      // Sanity: the extraction really sees the controls (so an extra one would be caught).
      expect(found.length, card.id).toBe((card.module === "expr" ? exprModule : structModule).toolbox().length);
      const key = JSON.stringify(found);
      const seen = byModule.get(card.module);
      if (seen) expect(key, card.id).toBe(seen);
      else byModule.set(card.module, key);
    }
    expect(byModule.size).toBe(2);
  });
});

describe("no multiple choice: worked examples and reveals", () => {
  it.each(HAND.filter((c) => c.type === "worked").map((c) => [c.id, c] as const))("worked example %s is interactive, not a list", (_id, card) => {
    const html = renderToStaticMarkup(<WorkedExample card={card} title="T" onDone={noop} />);
    const allow = allowed(card);
    for (const b of buttons(html)) expect(allow.has(b), `unexpected control "${b}"`).toBe(true);
    expect(buttons(html)).toContain("Show me this step");
  });

  it("the reveal's only extra buttons are the error-type metadata row", () => {
    const card = HAND[0];
    const run: RunResult = { outcome: "not_sure", seconds: 5, wrongMoves: 0, hintLevel: 0, userAnswer: "", skippedKeyMove: false, stepCount: 0, steps: [], workspace: [], endLevel: 1 };
    const html = renderToStaticMarkup(<Reveal card={card} result="not_sure" run={run} messages={[]} isMistake onNext={noop} />);
    expect(buttons(html)).toEqual(["Next"]);
    expect(html).toContain('data-metadata="error-type"');
  });
});

describe("support comes from highlighting, not options", () => {
  it("the old menu builders are gone", () => {
    expect("menuOptions" in ui).toBe(false);
    expect("matchMove" in ui).toBe(false);
  });
  it("Level 1 highlights where the step applies and names its kind; Level 2 gives only the goal; Level 3 nothing", () => {
    for (const card of HAND.filter((c) => c.type !== "worked")) {
      const mod = moduleOf(card);
      const s = mod.init(card);
      const line = mod.show(s, card);
      const l1 = guidance(card, s, line, 1)!;
      const l2 = guidance(card, s, line, 2)!;
      const def = mod.moveDef(card.path[0].move)!;
      expect(l1.text, card.id).toBe(def.kind);
      expect(l1.highlight, card.id).toBeDefined();
      expect(l2.text, card.id).toBe(def.goal);
      expect(l2.highlight, card.id).toBeUndefined();
      expect(guidance(card, s, line, 3)).toBeNull();
    }
  });
  it("hint ladder: highlight, then the kind of step, then the step itself", () => {
    const card = HAND.find((c) => c.id === "quad.tri.r1")!;
    const mod = moduleOf(card);
    const s = mod.init(card);
    const line = mod.show(s, card);
    const h1 = hint(card, s, line, 1);
    expect(h1.highlight).toBeDefined();
    expect(h1.highlight?.tile).toBeUndefined();
    expect(hint(card, s, line, 2).text).toMatch(/Kind of step: Factor with sum and product/);
    expect(hint(card, s, line, 3).text).toMatch(/Do this: Factor x² \+ bx \+ c \(sum and product\): −2, −3/);
  });
});
