// Khan Academy proof entry: validation and the daily completion rule (pure functions).
import { z } from "zod";

/** Minutes of logged, proven Khan work that complete the day's Khan item. */
export const KHAN_TARGET_MINUTES = 20;

export const KHAN_URL_HELP = "Use a link on khanacademy.org (https)";

/** True for https links on khanacademy.org or its subdomains. */
export function isKhanUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.hostname === "khanacademy.org" || u.hostname.endsWith(".khanacademy.org"));
  } catch {
    return false;
  }
}

export const KhanEntrySchema = z
  .object({
    unit: z.string().trim().min(2, "Name the unit").max(120),
    skill: z.string().trim().min(2, "Name the skill or exercise").max(160),
    minutes: z.number().int("Whole minutes only").min(1, "At least 1 minute").max(180, "Max 180 minutes per entry"),
    questionsCorrect: z.number().int().min(0),
    questionsTotal: z.number().int().min(0),
    proofNote: z.string().trim().min(20, "Describe what you did in at least 20 characters").max(1000),
    proofUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || isKhanUrl(v), { message: KHAN_URL_HELP }),
  })
  .refine((v) => v.questionsCorrect <= v.questionsTotal, {
    message: "Correct can't be more than total questions",
    path: ["questionsCorrect"],
  });

export type KhanEntryInput = z.input<typeof KhanEntrySchema>;

export interface KhanDayEntry {
  minutes: number;
}

export interface KhanDaySummary {
  minutes: number;
  remainingMinutes: number;
  completed: boolean;
}

export function summarizeKhanDay(entries: KhanDayEntry[]): KhanDaySummary {
  const minutes = entries.reduce((s, e) => s + Math.max(0, e.minutes), 0);
  return {
    minutes,
    remainingMinutes: Math.max(0, KHAN_TARGET_MINUTES - minutes),
    completed: minutes >= KHAN_TARGET_MINUTES,
  };
}

/** "7/10" style accuracy label, or null when no questions were attempted. */
export function accuracyLabel(correct: number, total: number): string | null {
  if (total <= 0) return null;
  return `${correct}/${total} (${Math.round((correct / total) * 100)}%)`;
}
