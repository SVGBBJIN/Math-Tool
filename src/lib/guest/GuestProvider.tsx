"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emptyState, isGuestState, todayOf, type GuestState } from "./engine";

export const GUEST_STORAGE_KEY = "amc-coach:guest:v1";
export const GUEST_COOKIE = "amc_guest";

interface GuestCtx {
  /** Null until the browser's saved state has been read. */
  state: GuestState | null;
  today: string;
  /** False when the browser refuses localStorage (private mode, storage blocked). */
  persisted: boolean;
  /** Run a mutation against a copy of the state, then save it. Returns whatever `fn` returns. */
  update: <T>(fn: (draft: GuestState) => T) => T;
  reset: () => void;
  restore: (json: string) => { error?: string };
}

const Ctx = createContext<GuestCtx | null>(null);

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function read(): GuestState | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGuestState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function GuestProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuestState | null>(null);
  const [persisted, setPersisted] = useState(true);
  const ref = useRef<GuestState | null>(null);

  const commit = useCallback((next: GuestState) => {
    ref.current = next;
    setState(next);
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
      setPersisted(true);
    } catch {
      setPersisted(false);
    }
  }, []);

  useEffect(() => {
    commit(read() ?? emptyState(browserTimezone()));
    // Keep several open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== GUEST_STORAGE_KEY) return;
      const next = read();
      if (next) {
        ref.current = next;
        setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commit]);

  const update = useCallback(
    <T,>(fn: (draft: GuestState) => T): T => {
      const draft = structuredClone(ref.current ?? emptyState(browserTimezone()));
      const result = fn(draft);
      commit(draft);
      return result;
    },
    [commit],
  );

  const reset = useCallback(() => commit(emptyState(ref.current?.settings.timezone ?? browserTimezone())), [commit]);

  const restore = useCallback(
    (json: string) => {
      try {
        const parsed: unknown = JSON.parse(json);
        if (!isGuestState(parsed)) return { error: "That file isn't an AMC Coach guest backup." };
        commit(parsed);
        return {};
      } catch {
        return { error: "Couldn't read that file." };
      }
    },
    [commit],
  );

  const value = useMemo<GuestCtx>(
    () => ({ state, today: state ? todayOf(state) : "", persisted, update, reset, restore }),
    [state, persisted, update, reset, restore],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGuest() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGuest must be used inside <GuestProvider>");
  return ctx;
}
