import { describe, expect, it } from "vitest";
import { comfortLevel, pickTrainerProblems, type CandidateProblem } from "@/lib/trainer";

const P = (id: string, difficulty: number, ...techniqueTags: string[]): CandidateProblem => ({
  id, difficulty, techniqueTags,
});

const bank = [
  P("a", 5, "casework"),
  P("b", 8, "casework"),
  P("c", 7, "similar_triangles"),
  P("d", 9, "modular_arithmetic"),
  P("e", 14, "casework"),
  P("f", 20, "similar_triangles"),
  P("g", 3, "factoring"),
];

describe("comfortLevel", () => {
  it("defaults to 8 with little data", () => {
    expect(comfortLevel([])).toBe(8);
  });
  it("is the top of the highest band with >=60% unfamiliar accuracy", () => {
    const a = (difficulty: number, correct: boolean, familiar = false) => ({ difficulty, correct, familiar });
    const attempts = [
      a(2, true), a(3, true), a(4, false),        // band 1-5: 2/3
      a(12, true), a(13, true), a(14, true),      // band 11-15: 3/3
      a(17, true), a(18, true), a(19, true, true), // band 16-20: only 2 unfamiliar -> ignored
    ];
    expect(comfortLevel(attempts)).toBe(15);
  });
});

describe("pickTrainerProblems", () => {
  it("puts due twins first (oldest first), never the origin problem", () => {
    const picks = pickTrainerProblems({
      candidates: bank,
      dueItems: [
        { id: "r2", techniqueTag: "casework", dueDate: "2026-11-15", originProblemId: "b", originDifficulty: 8 },
        { id: "r1", techniqueTag: "similar_triangles", dueDate: "2026-11-10", originProblemId: null, originDifficulty: 7 },
      ],
      tagStats: new Map(),
      comfort: 8,
    });
    expect(picks[0]).toEqual({ problemId: "c", reason: "twin:similar_triangles", reviewItemId: "r1" });
    expect(picks[1].reason).toBe("twin:casework");
    expect(picks[1].problemId).not.toBe("b");
    expect(picks[2].reason).toBe("stretch");
    expect(picks).toHaveLength(3);
  });

  it("caps twins at 2 so the stretch slot survives", () => {
    const picks = pickTrainerProblems({
      candidates: bank,
      dueItems: ["casework", "similar_triangles", "factoring"].map((t, i) => ({
        id: `r${i}`, techniqueTag: t, dueDate: "2026-11-10", originProblemId: null, originDifficulty: 8,
      })),
      tagStats: new Map(),
      comfort: 8,
    });
    expect(picks.filter((p) => p.reason.startsWith("twin")).length).toBe(2);
    expect(picks[2].reason).toBe("stretch");
  });

  it("then picks the weakest technique tags", () => {
    const picks = pickTrainerProblems({
      candidates: bank,
      dueItems: [],
      tagStats: new Map([
        ["casework", { attempts: 10, correct: 9 }],
        ["similar_triangles", { attempts: 10, correct: 2 }],
        ["modular_arithmetic", { attempts: 10, correct: 5 }],
        ["factoring", { attempts: 10, correct: 10 }],
      ]),
      comfort: 8,
    });
    expect(picks.map((p) => p.reason)).toEqual(["weak:similar_triangles", "weak:modular_arithmetic", "stretch"]);
    expect(picks[0].problemId).toBe("c"); // near comfort, not the d=20 one
    expect(picks[2].problemId).toBe("e"); // easiest at >= comfort+4 = 12
  });

  it("stretch falls back to the hardest left; small banks still fill", () => {
    const picks = pickTrainerProblems({
      candidates: [P("x", 2, "casework"), P("y", 3, "casework")],
      dueItems: [],
      tagStats: new Map(),
      comfort: 8,
    });
    expect(picks.map((p) => p.problemId).sort()).toEqual(["x", "y"]);
  });

  it("returns nothing for an empty bank", () => {
    expect(pickTrainerProblems({ candidates: [], dueItems: [], tagStats: new Map(), comfort: 8 })).toEqual([]);
  });
});
