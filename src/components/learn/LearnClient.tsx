"use client";
// Signed-in mode: the record comes from the server and every change is saved back through
// a server action, one save at a time and in order.
import { useCallback, useRef, useState } from "react";
import { saveLearnState } from "@/app/actions/learn";
import { toEnvelope } from "@/lib/learn/persistence";
import type { LearnState } from "@/lib/learn/state";
import { MapView } from "./MapView";
import { TodayView } from "./TodayView";
import { ProblemPage } from "./ProblemPage";
import { ProgressView } from "./ProgressView";
import { useLearnStore } from "./useLearnStore";

export function LearnClient({ initial, notice, today, mode, readOnly }: { initial: LearnState; notice: string | null; today: string; mode: "today" | "map" | "problem" | "progress"; readOnly: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(notice);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback((s: LearnState) => {
    if (readOnly) return;
    chain.current = chain.current.then(async () => {
      try {
        const r = await saveLearnState(toEnvelope(s));
        setError(r.ok ? null : (r.error ?? "Could not save"));
      } catch {
        setError("Could not reach the server");
      }
    });
  }, [readOnly]);
  const store = useLearnStore(initial, persist);

  return (
    <>
      {error && <p className="card mb-4 border-danger/40 text-sm text-danger" role="alert">Progress isn&apos;t being saved: {error}. Keep this tab open and try again in a moment.</p>}
      {shown && (
        <p className="card mb-4 flex items-start justify-between gap-3 text-sm" role="status">
          <span>{shown}</span>
          <button type="button" className="font-semibold text-muted" onClick={() => setShown(null)}>OK</button>
        </p>
      )}
      {readOnly && <p className="card mb-4 text-sm text-muted">Learning runs on the student&apos;s login. This is a read-only view of their progress.</p>}
      {mode === "progress" ? <ProgressView store={store} today={today} base="" />
        : mode === "problem" && !readOnly ? <ProblemPage store={store} today={today} base="" />
        : mode === "today" && !readOnly ? <TodayView store={store} today={today} base="" />
        : <MapView store={store} today={today} readOnly={readOnly} />}
    </>
  );
}
