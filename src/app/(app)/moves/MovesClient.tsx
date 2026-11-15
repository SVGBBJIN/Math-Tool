"use client";
import { useCallback, useRef, useState } from "react";
import { saveEngineProgress } from "../../actions/engine";
import { MovesApp } from "@/components/engine/MovesApp";
import type { EngineProgress } from "@/lib/engine/progress";

export function MovesClient({ initial, today, contestDate, readOnly }: { initial: EngineProgress; today: string; contestDate: string | null; readOnly: boolean }) {
  const [error, setError] = useState<string | null>(null);
  // Saves run one at a time, in order, so a slow request can't overwrite a newer one.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback((p: EngineProgress) => {
    chain.current = chain.current.then(async () => {
      try {
        const r = await saveEngineProgress(p);
        setError(r.ok ? null : (r.error ?? "Could not save"));
      } catch {
        setError("Could not reach the server");
      }
    });
  }, []);

  return (
    <>
      {error && <p className="card mb-4 border-danger/40 text-sm text-danger" role="alert">Progress isn&apos;t being saved: {error}. Keep this tab open and try again in a moment.</p>}
      {readOnly && <p className="card mb-4 text-sm text-muted">Moves practice runs on the student&apos;s login. This is a read-only view of their progress.</p>}
      <MovesApp initial={initial} today={today} contestDate={contestDate} save={save} readOnly={readOnly} />
    </>
  );
}
