"use client";
import { useCallback, useRef, useState } from "react";
import type { LearnState } from "@/lib/learn/state";

export interface LearnStore {
  state: LearnState;
  /** Apply a change to the latest state and persist it. */
  update: (fn: (s: LearnState) => LearnState) => LearnState;
}

/** Holds the learning record in memory and hands every change to `persist`. */
export function useLearnStore(initial: LearnState, persist: (s: LearnState) => void): LearnStore {
  const [state, setState] = useState(initial);
  const latest = useRef(initial);
  const update = useCallback((fn: (s: LearnState) => LearnState) => {
    const next = fn(latest.current);
    if (next !== latest.current) {
      latest.current = next;
      setState(next);
      persist(next);
    }
    return next;
  }, [persist]);
  return { state, update };
}
