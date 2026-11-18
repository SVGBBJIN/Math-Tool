// Geometry cards: angle chasing and similar triangles. Figures are drawn to scale from
// the coordinates below (y grows downward, as in SVG).
import type { Card, CardFamily, Figure } from "../cards/types";
import { COMPUTED, REASONED, forConcept, opt, slip } from "./author";

const ang = forConcept("geo.angles");
const sim = forConcept("geo.similar");

/** Triangle ABC with DE parallel to BC; `t` is AD : AB. */
function parallelCut(t: number, labels: { ad?: string; db?: string; de?: string; bc?: string }, alt: string): Figure {
  const A: [number, number] = [120, 22];
  const B: [number, number] = [30, 168];
  const C: [number, number] = [230, 168];
  const D: [number, number] = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])];
  const E: [number, number] = [A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1])];
  const mid = (p: [number, number], q: [number, number], dx = 0, dy = 0): [number, number] => [(p[0] + q[0]) / 2 + dx, (p[1] + q[1]) / 2 + dy];
  return {
    w: 260, h: 196, alt,
    items: [
      { t: "poly", pts: [A, D, E], fill: "tint" },
      { t: "poly", pts: [A, B, C] },
      { t: "line", a: D, b: E },
      { t: "label", at: [120, 12], text: "A" }, { t: "label", at: [20, 178], text: "B" }, { t: "label", at: [240, 178], text: "C" },
      { t: "label", at: [D[0] - 12, D[1]], text: "D" }, { t: "label", at: [E[0] + 12, E[1]], text: "E" },
      ...(labels.ad ? [{ t: "label" as const, at: mid(A, D, -14, 0), text: labels.ad, tone: "accent" as const }] : []),
      ...(labels.db ? [{ t: "label" as const, at: mid(D, B, -14, 0), text: labels.db, tone: "accent" as const }] : []),
      ...(labels.de ? [{ t: "label" as const, at: mid(D, E, 0, -9), text: labels.de, tone: "accent" as const }] : []),
      ...(labels.bc ? [{ t: "label" as const, at: mid(B, C, 0, 16), text: labels.bc, tone: "accent" as const }] : []),
    ],
  };
}

export const CARDS: Card[] = [
  // ---------------------------------------------------------------- angle chasing
  ang("i1", "insight", "exterior", 1, 40, {
    title: "The angle outside",
    prompt: "Two angles of the triangle are $50°$ and $60°$. Side $BC$ is extended past $C$. What is the marked angle outside the triangle?",
    figure: {
      w: 280, h: 200, alt: "Triangle ABC with angle 50 degrees at A and 60 degrees at B. Side BC continues past C to a point D, and the angle between CA and CD is marked with a question mark.",
      items: [
        { t: "poly", pts: [[114, 42], [40, 170], [160, 170]] },
        { t: "line", a: [160, 170], b: [250, 170] },
        { t: "angle", at: [160, 170], p: [250, 170], q: [114, 42], r: 20, tone: "accent" },
        { t: "angle", at: [114, 42], p: [40, 170], q: [160, 170], r: 20 },
        { t: "angle", at: [40, 170], p: [160, 170], q: [114, 42], r: 20 },
        { t: "label", at: [114, 28], text: "A" }, { t: "label", at: [28, 180], text: "B" }, { t: "label", at: [158, 186], text: "C" }, { t: "label", at: [258, 180], text: "D" },
        { t: "label", at: [112, 76], text: "50°", tone: "muted" }, { t: "label", at: [72, 156], text: "60°", tone: "muted" }, { t: "label", at: [190, 150], text: "?", tone: "accent" },
      ],
    },
    interaction: { kind: "numeric", answer: "110", unit: "°", slips: [slip(70, "70° is the angle inside the triangle at $C$. The marked angle is its neighbour on the straight line.")] },
    feedback: { correct: "And notice: $110 = 50 + 60$. That is not a coincidence.", incorrect: "The inside angle at $C$ is $180 - 50 - 60 = 70$. The marked angle sits next to it on a straight line." },
    explanation: {
      summary: "Inside angle at $C$: $180 - 50 - 60 = 70$. On the straight line, the outside angle is $180 - 70 = 110$. Both steps subtract from 180, so they undo each other: the outside angle is simply $50 + 60$.",
    },
    takeaway: "An exterior angle of a triangle equals the sum of the two interior angles that are not next to it.",
    whenToUse: "A side of a triangle extended, or an angle that sits outside a triangle on one of its lines.",
    verification: COMPUTED("Computes 180 − (180 − 50 − 60)."),
  }),
  ang("t1", "technique", "isosceles", 2, 50, {
    title: "Equal sides, equal angles",
    teach: {
      body: "In a triangle with two equal sides, the angles opposite those sides are equal. So one angle of an isosceles triangle tells you all three.",
      steps: [
        "Triangle with $AB = AC$ and angle $A = 40°$.",
        "The equal sides meet at $A$, so the equal angles are at $B$ and $C$.",
        "They share what is left: $180 - 40 = 140$.",
        "Each base angle is $140 \\div 2 = 70°$.",
      ],
    },
    prompt: "In triangle $PQR$, $PQ = PR$ and angle $Q = 35°$. What is angle $P$?",
    figure: {
      w: 280, h: 180, alt: "Triangle PQR with P at the top. Sides PQ and PR carry matching tick marks. The angle at Q is 35 degrees and the angle at P is marked with a question mark.",
      items: [
        { t: "poly", pts: [[140, 80], [40, 150], [240, 150]] },
        { t: "tick", a: [140, 80], b: [40, 150] }, { t: "tick", a: [140, 80], b: [240, 150] },
        { t: "angle", at: [40, 150], p: [240, 150], q: [140, 80], r: 26 },
        { t: "angle", at: [140, 80], p: [40, 150], q: [240, 150], r: 16, tone: "accent" },
        { t: "label", at: [140, 64], text: "P" }, { t: "label", at: [28, 160], text: "Q" }, { t: "label", at: [252, 160], text: "R" },
        { t: "label", at: [84, 140], text: "35°", tone: "muted" }, { t: "label", at: [140, 108], text: "?", tone: "accent" },
      ],
    },
    interaction: { kind: "numeric", answer: "110", unit: "°", slips: [slip(72.5, "That would be right if $P$ were one of the two equal angles. The equal sides meet at $P$, so the equal angles are at $Q$ and $R$."), slip(145, "There are two 35° angles, at $Q$ and at $R$. Subtract both.")] },
    feedback: { correct: "The equal angles are at $Q$ and $R$, so $P = 180 - 35 - 35$.", incorrect: "The equal sides $PQ$ and $PR$ are opposite the angles at $R$ and $Q$, so those two angles are both 35°." },
    explanation: { summary: "$PQ = PR$, so the angles opposite them are equal: angle $R$ = angle $Q$ = 35°. Then angle $P = 180 - 35 - 35 = 110°$." },
    takeaway: "Equal sides sit opposite equal angles. Find where the equal sides meet: the other two angles are the equal ones.",
    whenToUse: "Any figure with equal lengths: marked sides, radii of a circle, sides of a regular polygon.",
    verification: COMPUTED("Computes 180 − 2·35."),
  }),
  ang("r1", "recognition", "parallel", 2, 45, {
    title: "Find the equal angles",
    prompt: "The two horizontal lines are parallel. Tap **every** angle that must equal the marked one.",
    figure: {
      w: 280, h: 200, alt: "Two parallel horizontal lines crossed by a slanted line. At the lower crossing the angle to the upper right of the crossing is marked. The other seven angles at the two crossings can be tapped.",
      items: [
        { t: "line", a: [20, 60], b: [260, 60] }, { t: "line", a: [20, 140], b: [260, 140] },
        { t: "line", a: [60, 180], b: [220, 20] },
        { t: "angle", at: [100, 140], p: [260, 140], q: [180, 60], r: 22, tone: "accent" },
        { t: "target", id: "p-ul", at: [90, 116], name: "lower crossing, upper left" },
        { t: "target", id: "p-ll", at: [72, 152], name: "lower crossing, lower left" },
        { t: "target", id: "p-lr", at: [110, 164], name: "lower crossing, lower right" },
        { t: "target", id: "q-ur", at: [208, 48], name: "upper crossing, upper right" },
        { t: "target", id: "q-ul", at: [170, 36], name: "upper crossing, upper left" },
        { t: "target", id: "q-ll", at: [152, 72], name: "upper crossing, lower left" },
        { t: "target", id: "q-lr", at: [190, 84], name: "upper crossing, lower right" },
      ],
    },
    interaction: { kind: "tap", answers: ["p-ll", "q-ur", "q-ll"] },
    hint: "At one crossing, opposite angles are equal. Then slide the whole crossing along the slanted line to the other parallel line.",
    feedback: {
      correct: "The opposite angle at the same crossing, and the two matching positions at the other crossing.",
      incorrect: "At each crossing there are only two angle sizes: a small one and a large one. The marked angle is the small one. Find the three other small angles.",
    },
    explanation: { summary: "The angle opposite the marked one at the same crossing is equal (vertical angles). Because the lines are parallel, the upper crossing is a copy of the lower one, so the same two positions there are equal too. The other four angles are the supplement." },
    takeaway: "A line crossing two parallel lines makes only two angle sizes, and they add to 180°.",
    whenToUse: "Any figure with parallel lines: mark every copy of a known angle before doing anything else.",
    verification: COMPUTED("Measures each tappable region's angle from the figure's coordinates and compares it with the marked one."),
  }),
  ang("a2", "application", "parallel", 3, 60, {
    title: "A bend between parallel lines",
    prompt: "Lines $\\ell$ and $m$ are parallel. The path from $A$ to $P$ to $B$ makes a $35°$ angle with $\\ell$ at $A$ and a $25°$ angle with $m$ at $B$. What is angle $APB$?",
    figure: {
      w: 260, h: 200, alt: "Two parallel horizontal lines, l above and m below. A is on l and B is on m. Segments from A and from B meet at a point P between the lines, to the right. The angle at A between the line and AP is 35 degrees; the angle at B between the line and BP is 25 degrees; the angle at P is marked with a question mark.",
      items: [
        { t: "line", a: [10, 40], b: [250, 40] }, { t: "line", a: [10, 160], b: [250, 160] },
        { t: "line", a: [60, 40], b: [146, 100] }, { t: "line", a: [17, 160], b: [146, 100] },
        { t: "angle", at: [60, 40], p: [250, 40], q: [146, 100], r: 24 },
        { t: "angle", at: [17, 160], p: [250, 160], q: [146, 100], r: 34 },
        { t: "angle", at: [146, 100], p: [60, 40], q: [17, 160], r: 16, tone: "accent" },
        { t: "dot", at: [60, 40] }, { t: "dot", at: [17, 160] }, { t: "dot", at: [146, 100] },
        { t: "label", at: [60, 26], text: "A" }, { t: "label", at: [17, 176], text: "B" }, { t: "label", at: [160, 100], text: "P" },
        { t: "label", at: [100, 54], text: "35°", tone: "muted" }, { t: "label", at: [68, 150], text: "25°", tone: "muted" }, { t: "label", at: [118, 100], text: "?", tone: "accent" },
        { t: "label", at: [244, 28], text: "ℓ", tone: "muted" }, { t: "label", at: [244, 176], text: "m", tone: "muted" },
      ],
    },
    interaction: { kind: "numeric", answer: "60", unit: "°", slips: [slip(120, "The two given angles add; they are not subtracted from 180. Draw a third parallel line through $P$ to see why."), slip(10, "The two pieces of angle $P$ sit on opposite sides of the helper line, so they add.")] },
    hint: "Draw a line through $P$ parallel to the other two. It splits angle $P$ into two pieces.",
    feedback: { correct: "A parallel through $P$ splits the angle into a 35° piece and a 25° piece.", incorrect: "Add a line through $P$ parallel to $\\ell$ and $m$. The upper piece of angle $P$ equals 35° and the lower piece equals 25° (alternate angles)." },
    explanation: { summary: "Draw a line through $P$ parallel to $\\ell$ and $m$. The upper part of angle $APB$ equals the 35° angle at $A$, and the lower part equals the 25° angle at $B$ (alternate angles). So angle $APB = 35 + 25 = 60°$." },
    takeaway: "When a point sits between parallel lines, draw another parallel through it.",
    whenToUse: "Zig-zag paths between parallel lines, and any angle that is not attached to either parallel.",
    verification: COMPUTED("Measures angle APB from the figure's coordinates and compares it with 35 + 25."),
  }),
  ang("a1", "application", "triangle", 4, 75, {
    title: "Two isosceles triangles",
    prompt: "In triangle $ABC$, $AB = AC$ and angle $A = 40°$. Point $D$ is on side $AC$ with $BD = BC$. What is angle $ABD$?",
    figure: {
      w: 240, h: 200, alt: "Tall isosceles triangle ABC with A at the top, B at the bottom left and C at the bottom right. Point D lies on side AC, and segment BD is drawn. BD and BC carry matching tick marks.",
      items: [
        { t: "poly", pts: [[120, 15], [60, 180], [180, 180]] },
        { t: "line", a: [60, 180], b: [152, 103] },
        { t: "tick", a: [60, 180], b: [152, 103], n: 2 }, { t: "tick", a: [60, 180], b: [180, 180], n: 2 },
        { t: "tick", a: [120, 15], b: [60, 180] }, { t: "tick", a: [120, 15], b: [166, 141.5] },
        { t: "label", at: [120, 6], text: "A" }, { t: "label", at: [48, 188], text: "B" }, { t: "label", at: [192, 188], text: "C" }, { t: "label", at: [166, 98], text: "D" },
        { t: "label", at: [120, 48], text: "40°", tone: "muted" },
      ],
    },
    interaction: { kind: "numeric", answer: "30", unit: "°", slips: [slip(40, "40° is angle $DBC$. The question asks for the other part of angle $B$."), slip(70, "70° is the whole angle $ABC$. Part of it belongs to triangle $BCD$.")] },
    hint: "Find the base angles of triangle $ABC$ first. Then look at triangle $BCD$: it is isosceles too.",
    feedback: { correct: "Angle $B$ is 70°, triangle $BCD$ takes 40° of it, and 30° is left.", incorrect: "Triangle $ABC$: base angles 70°. Triangle $BCD$ has $BD = BC$, so its angles at $C$ and $D$ are both 70°, leaving 40° at $B$." },
    explanation: {
      summary: "Triangle $ABC$ is isosceles, so angles $B$ and $C$ are each $\\frac{180 - 40}{2} = 70°$. In triangle $BCD$, $BD = BC$, so angle $BDC$ = angle $C$ = 70° and angle $DBC = 180 - 140 = 40°$. Then angle $ABD = 70 - 40 = 30°$.",
      steps: ["Angle $ABC$ = angle $ACB$ = 70°", "Triangle $BCD$: angles at $C$ and $D$ are 70°, so angle $DBC$ = 40°", "Angle $ABD = 70 - 40 = 30°$"],
    },
    takeaway: "Chase angles one triangle at a time: finish everything you can in one before moving to the next.",
    whenToUse: "Figures built from several triangles sharing sides.",
    verification: COMPUTED("Recomputes the three steps arithmetically and checks the figure's coordinates give the same angle."),
  }),
  ang("v1", "variation", "exterior", 3, 50, {
    title: "Exterior angle, run backwards",
    prompt: "The exterior angle at the **apex** of an isosceles triangle (the corner where the two equal sides meet) is $100°$. What is each base angle?",
    interaction: { kind: "numeric", answer: "50", unit: "°", slips: [slip(80, "80° is the interior angle at the apex. The base angles share what is left of 180°."), slip(100, "The exterior angle equals the two base angles **together**, and they are equal.")] },
    hint: "An exterior angle equals the sum of the two far interior angles. Which angles are those here?",
    feedback: { correct: "The exterior angle at the apex equals the two base angles added, and they are equal.", incorrect: "The two interior angles far from the apex are the base angles. Their sum is 100°, and they are equal." },
    explanation: { summary: "The exterior angle at the apex equals the sum of the two base angles. They are equal, so each is $100 \\div 2 = 50°$. (Check: apex $= 80°$, and $80 + 50 + 50 = 180$.)" },
    takeaway: "The exterior-angle fact works in both directions: a known exterior angle gives the sum of the two far angles.",
    whenToUse: "When the angle you are given is outside the triangle.",
    verification: COMPUTED("Solves for the base angle and checks the triangle's angle sum."),
  }),

  // ---------------------------------------------------------------- similar triangles
  sim("i1", "insight", "area", 1, 35, {
    title: "Three times as long",
    prompt: "A triangle has area 6. A second triangle has the same shape, but every side is 3 times as long. What is the area of the second triangle?",
    interaction: { kind: "numeric", answer: "54", slips: [slip(18, "The base is 3 times as long, and so is the height. Area uses both."), slip(36, "The scale factor is 3, so the area is multiplied by $3^2$.")] },
    feedback: { correct: "Base × 3 and height × 3, so area × 9.", incorrect: "Area is half of base times height. Both the base and the height are 3 times as long." },
    explanation: { summary: "Enlarging by 3 triples the base and triples the height, so the area is multiplied by $3 \\cdot 3 = 9$: $6 \\cdot 9 = 54$." },
    takeaway: "Scale lengths by k and areas scale by k².",
    whenToUse: "Any pair of similar figures where areas are compared.",
    verification: COMPUTED("Computes 6·3² and cross-checks with a concrete triangle (base 4, height 3)."),
  }),
  sim("t1", "technique", "match", 2, 60, {
    title: "A parallel line makes a small copy",
    teach: {
      body: "A line parallel to one side of a triangle cuts off a smaller triangle with the same three angles: a scaled copy. Matching sides then have equal ratios. Compare the **whole** side of the big triangle with the matching side of the small one.",
      steps: [
        "$DE$ is parallel to $BC$, so triangle $ADE$ is a scaled copy of triangle $ABC$.",
        "Matching sides: $AD \\leftrightarrow AB$, $AE \\leftrightarrow AC$, $DE \\leftrightarrow BC$.",
        "If $AD = 4$ and $AB = 10$, the scale factor is $\\frac{10}{4} = 2.5$.",
        "Then $BC = 2.5 \\cdot DE$.",
      ],
    },
    prompt: "$DE$ is parallel to $BC$, with $AD = 6$, $DB = 3$ and $DE = 8$. Find $BC$.",
    figure: parallelCut(2 / 3, { ad: "6", db: "3", de: "8", bc: "?" }, "Triangle ABC with A at the top. D is on side AB and E is on side AC, and segment DE is parallel to BC. AD is 6, DB is 3 and DE is 8. BC is unknown."),
    interaction: { kind: "numeric", answer: "12", slips: [slip(4, "$DB$ is not a side of either triangle. The side matching $AD$ is the whole of $AB = 9$."), slip(16, "The ratio is $AB : AD = 9 : 6$, not $6 : 3$.")] },
    feedback: { correct: "$AB = 9$, so the scale factor is $\\frac{9}{6} = 1.5$, and $BC = 1.5 \\cdot 8$.", incorrect: "The big triangle's side is $AB = 6 + 3 = 9$, matching $AD = 6$. Scale factor $\\frac{9}{6} = 1.5$." },
    explanation: { summary: "$AB = AD + DB = 9$. Scale factor from the small triangle to the big one: $\\frac{AB}{AD} = \\frac{9}{6} = 1.5$. So $BC = 1.5 \\cdot 8 = 12$." },
    takeaway: "Match sides of the two triangles, never a side with a leftover piece: AD goes with AB, not with DB.",
    whenToUse: "A segment parallel to a side of a triangle; shadows; nested triangles sharing a corner.",
    verification: COMPUTED("Computes 8·(6 + 3)/6 exactly."),
  }),
  sim("r1", "recognition", "identify", 2, 45, {
    title: "Must they be similar?",
    prompt: "Which of these pairs of triangles **must** be similar?",
    interaction: {
      kind: "multi", answers: ["a", "c", "e"],
      options: [
        opt("a", "Two triangles that each have angles of 40° and 75°", "Two equal angles force the third to match too."),
        opt("b", "Two isosceles triangles", "One can be tall and thin, the other short and wide."),
        opt("c", "Two right triangles that each have a 30° angle", "Each has angles 90° and 30°: two pairs of equal angles."),
        opt("d", "Two triangles that each have a side of length 5", "One matching side says nothing about shape."),
        opt("e", "Two equilateral triangles", "All angles are 60° in both."),
      ],
    },
    feedback: { correct: "Each of those pairs shares two angles, and two angles fix the shape of a triangle.", incorrect: "Similar means same shape. Two matching angles guarantee it; a matching side or a shared name (isosceles) does not." },
    explanation: { summary: "Two pairs of equal angles force the third pair, so the shapes match. That covers the 40°–75° pair, the right triangles with 30°, and all equilateral triangles. Isosceles triangles and triangles sharing one side length come in many shapes." },
    takeaway: "Two pairs of equal angles are enough to make triangles similar.",
    whenToUse: "Before setting up any proportion: check that two angles match.",
    verification: REASONED("Classification by the AA criterion; counterexamples for the two rejected options are described in the feedback."),
  }),
  sim("e1", "recognition", "identify", 3, 75, {
    title: "Say why",
    prompt: "$AB$ is parallel to $CD$, and segments $AD$ and $BC$ cross at $E$. In your own words, explain why triangles $ABE$ and $DCE$ are similar.",
    figure: {
      w: 220, h: 200, alt: "A bow-tie figure. AB is a short horizontal segment at the top and CD is a longer horizontal segment at the bottom. Segment AD runs from top left to bottom right and segment BC from top right to bottom left; they cross at E.",
      items: [
        { t: "line", a: [40, 40], b: [160, 40] }, { t: "line", a: [20, 170], b: [200, 170] },
        { t: "line", a: [40, 40], b: [200, 170] }, { t: "line", a: [160, 40], b: [20, 170] },
        { t: "label", at: [30, 30], text: "A" }, { t: "label", at: [170, 30], text: "B" }, { t: "label", at: [10, 182], text: "C" }, { t: "label", at: [210, 182], text: "D" }, { t: "label", at: [122, 92], text: "E" },
      ],
    },
    interaction: {
      kind: "explain",
      placeholder: "The triangles are similar because…",
      model: "The angles at $E$ are vertical angles, so they are equal. Because $AB$ is parallel to $CD$, angle $ABE$ equals angle $DCE$ (alternate angles on line $BC$). Two pairs of equal angles make the triangles similar.",
      points: ["I said the two angles at E are equal (vertical angles)", "I used the parallel lines to get a second pair of equal angles", "I concluded similarity from two pairs of equal angles"],
    },
    feedback: { correct: "That is a complete argument: two pairs of equal angles, each with a reason.", incorrect: "A complete argument names two pairs of equal angles and says why each pair is equal. Compare yours with the model and note what was missing." },
    explanation: { summary: "Vertical angles at $E$ give one pair. The parallel lines give another: angle $ABE$ = angle $DCE$. Note the matching order: $A \\leftrightarrow D$, $B \\leftrightarrow C$, $E \\leftrightarrow E$." },
    takeaway: "Crossing segments between parallel lines make a bow-tie of two similar triangles.",
    whenToUse: "Trapezoids with their diagonals drawn, and any X shape between parallel lines.",
    verification: REASONED("Self-explanation card: the student compares with the model argument. The model was checked against the standard AA proof."),
  }),
  sim("a2", "application", "match", 2, 45, {
    title: "Shadows",
    prompt: "A 2 m pole casts a 3 m shadow. At the same moment, a nearby tree casts a 12 m shadow. How tall is the tree?",
    interaction: { kind: "numeric", answer: "8", unit: "m", slips: [slip(18, "The tree's shadow is 4 times the pole's shadow, so the tree is 4 times the pole's height, not $12 \\cdot \\frac{3}{2}$."), slip(11, "Similar triangles scale by multiplying, not by adding the same amount.")] },
    hint: "The sun's rays hit the pole and the tree at the same angle, so the two height-and-shadow triangles are similar.",
    feedback: { correct: "The shadow is 4 times as long, so the tree is 4 times as tall.", incorrect: "Same sun angle, so the triangles are similar. Shadow ratio $12 : 3 = 4$, so the heights are in the same ratio." },
    explanation: { summary: "Both triangles have a right angle and the same sun angle, so they are similar. The tree's shadow is $12 \\div 3 = 4$ times as long, so the tree is $4 \\cdot 2 = 8$ m tall." },
    takeaway: "Find the scale factor from one pair of matching sides, then apply it to the other.",
    whenToUse: "Shadows, maps, models, and any two figures with the same shape.",
    verification: COMPUTED("Computes 2·12/3 exactly."),
  }),
  sim("a1", "application", "match", 3, 60, {
    title: "The bow-tie",
    prompt: "$AB$ is parallel to $CD$, and $AD$ and $BC$ cross at $E$. If $AB = 6$, $CD = 9$ and $AE = 4$, find $ED$.",
    figure: {
      w: 220, h: 200, alt: "A bow-tie figure. AB is a horizontal segment of length 6 at the top; CD is a horizontal segment of length 9 at the bottom. AD and BC cross at E. AE is 4 and ED is unknown.",
      items: [
        { t: "line", a: [40, 40], b: [160, 40] }, { t: "line", a: [20, 170], b: [200, 170] },
        { t: "line", a: [40, 40], b: [200, 170] }, { t: "line", a: [160, 40], b: [20, 170] },
        { t: "label", at: [30, 30], text: "A" }, { t: "label", at: [170, 30], text: "B" }, { t: "label", at: [10, 182], text: "C" }, { t: "label", at: [210, 182], text: "D" }, { t: "label", at: [124, 92], text: "E" },
        { t: "label", at: [100, 28], text: "6", tone: "accent" }, { t: "label", at: [110, 186], text: "9", tone: "accent" }, { t: "label", at: [62, 72], text: "4", tone: "accent" }, { t: "label", at: [164, 126], text: "?", tone: "accent" },
      ],
    },
    interaction: { kind: "numeric", answer: "6", slips: [slip("8/3", "That shrinks $AE$. $ED$ belongs to the larger triangle, so it must be longer than $AE$."), slip(7, "Similar triangles scale by multiplying: $CD$ is 1.5 times $AB$, not 3 more.")] },
    hint: "Triangles $ABE$ and $DCE$ are similar. Which side of the big triangle matches $AE$?",
    feedback: { correct: "$A$ matches $D$, so $AE$ matches $DE$; the scale factor is $\\frac{9}{6} = 1.5$.", incorrect: "Triangle $ABE$ is similar to triangle $DCE$ with scale factor $\\frac{CD}{AB} = 1.5$. $AE$ matches $DE$." },
    explanation: { summary: "Triangles $ABE$ and $DCE$ are similar (vertical angles at $E$, alternate angles from the parallel lines). Scale factor: $\\frac{CD}{AB} = \\frac{9}{6} = 1.5$. So $ED = 1.5 \\cdot 4 = 6$." },
    takeaway: "Name similar triangles with matching corners in the same order, then read off which sides correspond.",
    whenToUse: "Diagonals of a trapezoid; crossing lines between parallels.",
    verification: COMPUTED("Computes 4·9/6 exactly and checks the figure's coordinates give the same ratio."),
  }),
  sim("v1", "variation", "area", 4, 70, {
    title: "The part that is left",
    prompt: "$DE$ is parallel to $BC$ and $AD : DB = 1 : 2$. The area of triangle $ADE$ is 5. What is the area of the trapezoid $DBCE$?",
    figure: parallelCut(1 / 3, {}, "Triangle ABC with A at the top. D is on AB one third of the way down, E is on AC one third of the way down, and DE is parallel to BC. The small triangle ADE at the top is shaded."),
    interaction: { kind: "numeric", answer: "40", slips: [slip(45, "45 is the area of the whole triangle $ABC$. The trapezoid is what remains after the small triangle is removed."), slip(10, "The ratio $1 : 2$ compares $AD$ with $DB$. The side matching $AD$ is $AB$, which is 3 times as long, and areas scale by the square."), slip(15, "Lengths scale by 3, but areas scale by $3^2 = 9$.")] },
    hint: "Compare $AD$ with the whole side $AB$ to get the scale factor. Then think about how areas scale.",
    feedback: { correct: "$AB$ is 3 times $AD$, so the big triangle has 9 times the area: 45. Removing the small triangle leaves 40.", incorrect: "$AD : AB = 1 : 3$, so the scale factor is 3 and the area of $ABC$ is $9 \\cdot 5 = 45$. The trapezoid is $45 - 5$." },
    explanation: { summary: "$AD : DB = 1 : 2$ means $AB = 3 \\cdot AD$. Triangle $ABC$ is triangle $ADE$ scaled by 3, so its area is $9 \\cdot 5 = 45$. The trapezoid is the difference: $45 - 5 = 40$." },
    takeaway: "Convert a part-to-part ratio into part-to-whole before using similarity, and square the scale factor for areas.",
    whenToUse: "Area questions with a line parallel to the base of a triangle.",
    verification: COMPUTED("Computes 5·3² − 5 and cross-checks with the areas of the figure's polygons."),
  }),
];

export const FAMILIES: CardFamily[] = [];
