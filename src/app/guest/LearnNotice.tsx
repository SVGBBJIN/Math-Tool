"use client";
import { useGuestLearn } from "@/components/learn/GuestLearnProvider";

/** One-off messages from loading the record: repaired, migrated or restored from a backup. */
export function LearnNotice() {
  const learn = useGuestLearn();
  if (!learn?.notice) return null;
  return (
    <p className="card mb-4 flex items-start justify-between gap-3 text-sm" role="status">
      <span>{learn.notice}</span>
      <button type="button" className="font-semibold text-muted" onClick={learn.dismiss}>OK</button>
    </p>
  );
}
