"use server";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/session";
import { saveLearnRow, storedRecordUnreadable } from "@/lib/data";
import { parseDocument } from "@/lib/learn/persistence";

const MAX_BYTES = 3_000_000;

/**
 * Store the student's learning record. The browser runs the engines; this action only
 * validates and persists the result, and refuses to overwrite a stored record it cannot read.
 */
export async function saveLearnState(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = parseDocument(raw);
  if (!parsed.ok) return { ok: false, error: `Invalid progress (${parsed.reason})` };
  if (JSON.stringify(parsed.state).length > MAX_BYTES) return { ok: false, error: "Progress is too large to save" };
  const { supabase: db, profile, household } = await requireStudent();
  try {
    if (await storedRecordUnreadable(db, profile.id)) return { ok: false, error: "The saved record could not be read, so it was not overwritten" };
    await saveLearnRow(db, household.id, profile.id, parsed.state);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save" };
  }
  revalidatePath("/errors");
  return { ok: true };
}
