"use client";
// Guest mode's learning record: stored in this browser through the persistence layer
// (versioned, validated, with daily backups). Older move-based progress kept inside the guest
// state is imported once.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGuest } from "@/lib/guest/GuestProvider";
import { mergeLegacy } from "@/lib/learn/legacy";
import { browserStore, localRepository, volatileRepository, type LearnRepository } from "@/lib/learn/persistence";
import type { LearnState } from "@/lib/learn/state";
import { useLearnStore, type LearnStore } from "./useLearnStore";

interface Ctx { store: LearnStore; repo: LearnRepository; notice: string | null; dismiss: () => void; replace: (s: LearnState) => void }
const LearnCtx = createContext<Ctx | null>(null);

function Inner({ initial, repo, notice, children }: { initial: LearnState; repo: LearnRepository; notice: string | null; children: ReactNode }) {
  const [shown, setShown] = useState(notice);
  const [version, setVersion] = useState(0);
  const [base, setBase] = useState(initial);
  const persist = useCallback((s: LearnState) => { void repo.save(s); }, [repo]);
  const store = useLearnStore(base, persist);
  const value = useMemo<Ctx>(() => ({
    store, repo, notice: shown, dismiss: () => setShown(null),
    // After a restore or reset: start the in-memory store from the new record.
    replace: (s) => { setBase(s); setVersion((v) => v + 1); },
  }), [store, repo, shown]);
  return <LearnCtx.Provider value={value}><KeyedStore key={version}>{children}</KeyedStore></LearnCtx.Provider>;
}

const KeyedStore = ({ children }: { children: ReactNode }) => <>{children}</>;

export function GuestLearnProvider({ children }: { children: ReactNode }) {
  const { state: guest } = useGuest();
  const [loaded, setLoaded] = useState<{ state: LearnState; repo: LearnRepository; notice: string | null } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!guest || started.current) return;
    started.current = true;
    const kv = browserStore();
    const repo = kv ? localRepository(kv, "guest") : volatileRepository();
    void repo.load().then(async (r) => {
      let state = r.state;
      if (guest.engine) {
        const merged = mergeLegacy(state, guest.engine);
        if (merged !== state) { state = merged; await repo.save(state); }
      }
      setLoaded({ state, repo, notice: r.notice });
    });
  }, [guest]);

  if (!loaded) return <>{children}</>;
  return <Inner initial={loaded.state} repo={loaded.repo} notice={loaded.notice}>{children}</Inner>;
}

/** Null while the record is loading. */
export function useGuestLearn(): Ctx | null {
  return useContext(LearnCtx);
}
