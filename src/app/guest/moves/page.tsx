"use client";
import { useCallback } from "react";
import { MovesApp } from "@/components/engine/MovesApp";
import { CONTEST_DATE } from "@/lib/engine/config";
import { emptyProgress, type EngineProgress } from "@/lib/engine/progress";
import { useGuest } from "@/lib/guest/GuestProvider";
import { saveEngine } from "@/lib/guest/engine";

export default function GuestMoves() {
  const { state, today, update } = useGuest();
  const save = useCallback((p: EngineProgress) => update((d) => saveEngine(d, p, today)), [update, today]);
  if (!state) return <p className="card text-muted">Loading…</p>;
  // The date set in Settings wins; CONTEST_DATE is only the fallback placeholder.
  return <MovesApp initial={state.engine ?? emptyProgress()} today={today} contestDate={state.settings.amcDate || CONTEST_DATE} save={save} basePath="/guest" />;
}
