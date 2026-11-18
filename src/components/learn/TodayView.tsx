"use client";
// The home screen: today's three cards as a short feed, then a small picture of progress.
// Opening the app puts the first card on screen; there is nothing to click through first.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCard } from "@/lib/learn/cards";
import { conceptOf } from "@/lib/learn/curriculum";
import { snapshots } from "@/lib/learn/mastery";
import { dailyStatus, ensureDaily, nextExtra, type Pick } from "@/lib/learn/select";
import type { Role } from "@/lib/learn/state";
import { CardView } from "./CardView";
import { Rich } from "./Rich";
import { RoleChip } from "./bits";
import { recordCard, tagMiss } from "./practice";
import type { LearnStore } from "./useLearnStore";
import { ProgressSummary } from "./ProgressSummary";
import { DailyProblemView } from "./DailyProblemView";

const ROLE_DOT = { discover: "bg-brand/10 text-brand", reinforce: "bg-sun/15 text-[#9a6700]", apply: "bg-mastery/15 text-apply" } as const;

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

export function TodayView({ store, today, mapHref }: { store: LearnStore; today: string; mapHref: string }) {
  const { state, update } = store;
  useEffect(() => { update((s) => ensureDaily(s, today)); }, [update, today]);
  const slots = useMemo(() => (state.daily?.date === today ? state.daily.slots : []), [state.daily, today]);
  const status = dailyStatus(state, today);
  // The card being looked at. It stays open after it is answered, until "Next".
  const [open, setOpen] = useState<string | null>(null);
  const [extra, setExtra] = useState<(Pick & { role: Role }) | null>(null);
  const [extraDone, setExtraDone] = useState(0);
  const current = open ?? slots.find((s) => !s.done)?.cardId ?? null;
  const seconds = useMemo(() => slots.filter((s) => !s.done).reduce((sum, s) => sum + (getCard(s.cardId)?.seconds ?? 40), 0), [slots]);
  const snaps = useMemo(() => snapshots(state.events), [state.events]);
  const changedToday = useMemo(() => {
    const before = snapshots(state.events.filter((e) => e.date < today));
    return [...snaps.values()].filter((s) => s.seen && before.get(s.conceptId)!.state !== s.state);
  }, [snaps, state.events, today]);

  if (!slots.length) {
    return <p className="learn-card text-muted">Getting today&apos;s cards ready…</p>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-semibold text-muted">{weekday(today)}</p>
          <h1 className="brand-text text-3xl font-extrabold tracking-tight md:text-4xl">{status.complete ? "Today's three: done" : "Today's three"}</h1>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-violet shadow-sm ring-1 ring-violet/15">{status.complete ? `${status.total} of ${status.total}` : `about ${Math.max(1, Math.round(seconds / 60 * 2) / 2)} min left`}</p>
      </header>

      <ol className="space-y-3">
        {slots.map((slot, k) => {
          const card = getCard(slot.cardId);
          if (!card) return null;
          if (slot.cardId === current) {
            return (
              <li key={slot.cardId}>
                <CardView key={slot.cardId} card={card} slot={slot.role} reason={slot.reason}
                  onRecord={(r) => { setOpen(slot.cardId); return recordCard(store, r, today); }}
                  onMissDetails={(id, t) => tagMiss(store, id, t)}
                  onNext={() => setOpen(null)}
                  nextLabel={slots.slice(k + 1).some((s) => !s.done) ? "Next card" : "Finish"} />
              </li>
            );
          }
          return (
            <li key={slot.cardId} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${slot.done ? "border-white bg-white shadow-sm" : "border-dashed border-violet/25 bg-white/60"}`}>
              <span title={slot.done && slot.outcome !== "correct" ? "This idea comes back soon" : undefined} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${slot.done ? (slot.outcome === "correct" ? "bg-mastery text-white" : "bg-sun/20 text-[#9a6700]") : ROLE_DOT[slot.role]}`} aria-hidden>
                {slot.done ? (slot.outcome === "correct" ? "✓" : "↻") : k + 1}
              </span>
              <div className="min-w-0 flex-1">
                <RoleChip slot={slot.role} />
                <p className="mt-1 truncate text-sm">{slot.done ? <Rich text={card.takeaway} /> : <span className="text-muted">{slot.role === "discover" ? `A new idea in ${conceptOf(slot.conceptId)?.name}` : "Up next"}</span>}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {status.complete && !current && (
        <section className="learn-card card-in">
          <h2 className="text-lg font-bold">That&apos;s today.</h2>
          {changedToday.length ? (
            <ul className="mt-2 space-y-1 text-[15px]">
              {changedToday.map((s) => <li key={s.conceptId}><span className="font-semibold">{conceptOf(s.conceptId)?.name}</span>: {s.next}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-[15px] text-muted">Progress shows up when an idea is used independently, so it can take a few days to move. That&apos;s by design.</p>
          )}
          {extra ? (
            <div className="mt-4">
              <CardView key={extra.cardId} card={getCard(extra.cardId)!} slot="extra" reason={extra.reason}
                onRecord={(r) => recordCard(store, r, today)} onMissDetails={(id, t) => tagMiss(store, id, t)}
                onNext={() => { setExtra(null); setExtraDone((n) => n + 1); }} nextLabel="Done" />
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setExtra(nextExtra(store.state, today))}>{extraDone ? "Another one" : "One more card"}</button>
              <Link href={mapHref} className="btn-ghost">See your map</Link>
            </div>
          )}
          {extraDone > 0 && !extra && <p className="mt-2 text-xs text-muted">{extraDone} extra card{extraDone === 1 ? "" : "s"} today. Stopping here is fine: spacing helps more than volume.</p>}
        </section>
      )}

      <DailyProblemView store={store} today={today} />

      <ProgressSummary snaps={snaps} events={state.events} mapHref={mapHref} />
    </div>
  );
}
