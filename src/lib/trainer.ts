// Daily trainer selection (pure function).
//
// 3 slots: due twins first (at most 2, so the stretch slot survives), then problems from
// the weakest technique tags, then one stretch problem above the student's comfort level.
// Only never-attempted problems with status "train" are eligible.

export interface CandidateProblem {
  id: string;
  difficulty: number; // 1-25 (test position)
  techniqueTags: string[];
}

export interface DueReviewItem {
  id: string;
  techniqueTag: string;
  dueDate: string;
  originProblemId: string | null;
  originDifficulty: number | null;
}

export interface TagStat {
  attempts: number; // unfamiliar attempts only
  correct: number;
}

export interface ScoredAttempt {
  difficulty: number;
  correct: boolean;
  familiar: boolean;
}

export interface Pick {
  problemId: string;
  reason: string; // 'twin:<tag>' | 'weak:<tag>' | 'stretch' | 'fill'
  reviewItemId: string | null;
}

export const TRAINER_SLOTS = 3;
export const MAX_TWINS = 2;
export const DEFAULT_COMFORT = 8;

/**
 * Highest difficulty band (5 positions wide) where unfamiliar accuracy is >= 60% with at
 * least 3 attempts; the comfort level is the top of that band. Defaults to 8.
 */
export function comfortLevel(attempts: ScoredAttempt[]): number {
  const bands = new Map<number, { n: number; c: number }>();
  for (const a of attempts) {
    if (a.familiar) continue;
    const band = Math.floor((a.difficulty - 1) / 5); // 0: 1-5, 1: 6-10, ...
    const b = bands.get(band) ?? { n: 0, c: 0 };
    b.n++;
    if (a.correct) b.c++;
    bands.set(band, b);
  }
  let best = -1;
  for (const [band, { n, c }] of bands) {
    if (n >= 3 && c / n >= 0.6 && band > best) best = band;
  }
  return best < 0 ? DEFAULT_COMFORT : Math.min(25, (best + 1) * 5);
}

/** Laplace-smoothed accuracy so untried tags count as weak-ish (0.5) rather than unknown. */
export function smoothedAccuracy(s: TagStat | undefined): number {
  const n = s?.attempts ?? 0;
  const c = s?.correct ?? 0;
  return (c + 1) / (n + 2);
}

function closestTo(target: number, list: CandidateProblem[]): CandidateProblem | undefined {
  return [...list].sort(
    (a, b) =>
      Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) ||
      a.difficulty - b.difficulty ||
      a.id.localeCompare(b.id),
  )[0];
}

export function pickTrainerProblems(input: {
  candidates: CandidateProblem[]; // status=train, never attempted
  dueItems: DueReviewItem[];
  tagStats: Map<string, TagStat>;
  comfort: number;
}): Pick[] {
  const { candidates, dueItems, tagStats, comfort } = input;
  const picks: Pick[] = [];
  const used = new Set<string>();
  const available = () => candidates.filter((p) => !used.has(p.id));
  const take = (p: CandidateProblem, reason: string, reviewItemId: string | null = null) => {
    used.add(p.id);
    picks.push({ problemId: p.id, reason, reviewItemId });
  };

  // 1. Due twins, oldest due first.
  const due = [...dueItems].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  for (const item of due) {
    if (picks.length >= MAX_TWINS) break;
    const pool = available().filter(
      (p) => p.techniqueTags.includes(item.techniqueTag) && p.id !== item.originProblemId,
    );
    const p = closestTo(item.originDifficulty ?? comfort, pool);
    if (p) take(p, `twin:${item.techniqueTag}`, item.id);
  }

  // 2. Weakest technique tags, near comfort level. Leave one slot for the stretch.
  const stretchMin = Math.min(25, comfort + 4);
  const allTags = [...new Set(candidates.flatMap((p) => p.techniqueTags))];
  const tagsByWeakness = allTags.sort(
    (a, b) =>
      smoothedAccuracy(tagStats.get(a)) - smoothedAccuracy(tagStats.get(b)) ||
      (tagStats.get(a)?.attempts ?? 0) - (tagStats.get(b)?.attempts ?? 0) ||
      a.localeCompare(b),
  );
  for (const tag of tagsByWeakness) {
    if (picks.length >= TRAINER_SLOTS - 1) break;
    const pool = available().filter((p) => p.techniqueTags.includes(tag) && p.difficulty < stretchMin);
    const p = closestTo(comfort, pool);
    if (p) take(p, `weak:${tag}`);
  }

  // 3. One stretch: the easiest problem at or above comfort + 4; else the hardest left.
  if (picks.length < TRAINER_SLOTS) {
    const pool = available();
    const above = pool.filter((p) => p.difficulty >= stretchMin);
    const p = above.length
      ? closestTo(stretchMin, above)
      : [...pool].sort((a, b) => b.difficulty - a.difficulty || a.id.localeCompare(b.id))[0];
    if (p) take(p, "stretch");
  }

  // 4. Fill any remaining slots (small banks).
  while (picks.length < TRAINER_SLOTS) {
    const p = closestTo(comfort, available());
    if (!p) break;
    take(p, "fill");
  }
  return picks;
}
