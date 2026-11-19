"use client";
// The curriculum as a map of ideas: every concept, its state, and what it would take to
// move it. Any concept with cards can be practised from here, including ones that are not
// yet in the daily plan.
import { useEffect, useMemo, useRef, useState } from "react";
import { cardsOf, getCard, hasCards } from "@/lib/learn/cards";
import { COURSE, conceptOf, dependentsOf, type Concept } from "@/lib/learn/curriculum";
import { STANDARD, STATE_MEANING, snapshots, type ConceptSnapshot } from "@/lib/learn/mastery";
import { scheduleOf } from "@/lib/learn/review";
import { nextInConcept, type Pick } from "@/lib/learn/select";
import { CardView } from "./CardView";
import { StateBadge, STATE_STYLE } from "./bits";
import { progressFacts } from "./ProgressView";
import { recordCard, tagMiss } from "./practice";
import type { LearnStore } from "./useLearnStore";

function Meter({ label, have, want }: { label: string; have: number; want: number }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex gap-1" aria-label={`${Math.min(have, want)} of ${want}`}>
        {Array.from({ length: want }, (_, k) => <span key={k} className={`h-2.5 w-5 rounded-full ${k < have ? "bg-apply" : "bg-line"}`} />)}
      </span>
    </li>
  );
}

function ConceptSheet({ concept, snap, store, today, readOnly, onClose }: {
  concept: Concept; snap: ConceptSnapshot; store: LearnStore; today: string; readOnly: boolean; onClose: () => void;
}) {
  const [card, setCard] = useState<Pick | null>(null);
  const [done, setDone] = useState(0);
  const events = store.state.events.filter((e) => e.conceptId === concept.id);
  const schedule = scheduleOf(events);
  const objectiveNote = (id: string) => {
    const es = events.filter((e) => e.objectiveId === id && !e.legacy);
    if (!es.length) return hasCards(concept.id) && cardsOf(concept.id).some((c) => c.objectiveId === id) ? "not yet" : "";
    if (snap.weakObjectives.includes(id)) return "needs another look";
    return es.some((e) => e.outcome === "correct") ? "shown" : "attempted";
  };
  const start = () => { setCard(nextInConcept(store.state, concept.id, today)); };
  const ref = useRef<HTMLElement>(null);
  // The sheet sits above the map; bring it into view when a concept is tapped further down.
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);

  return (
    <section ref={ref} className="learn-card card-in scroll-mt-4 space-y-4" aria-labelledby={`c-${concept.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{COURSE.domains.find((d) => d.id === concept.domain)?.name}</p>
          <h2 id={`c-${concept.id}`} className="text-xl font-bold">{concept.name}</h2>
          <div className="mt-1"><StateBadge state={snap.state} /> <span className="text-xs text-muted">· {STATE_MEANING[snap.state]}</span></div>
        </div>
        <button type="button" className="text-sm font-semibold text-muted hover:text-ink" onClick={onClose} aria-label="Close">Close</button>
      </div>
      <p className="text-[15px]">{concept.description}</p>

      {card ? (
        <CardView key={card.cardId} card={getCard(card.cardId)!} slot="explore" reason={card.reason}
          onRecord={(r) => recordCard(store, r, today)} onMissDetails={(id, t) => tagMiss(store, id, t)}
          onNext={() => { setDone((n) => n + 1); setCard(nextInConcept(store.state, concept.id, today)); }} nextLabel="Next on this idea" />
      ) : (
        <>
          <div className="rounded-2xl bg-canvas p-4">
            <p className="text-sm font-semibold">Next step</p>
            <p className="mt-1 text-[15px]">{snap.next}</p>
            {schedule && <p className="mt-2 text-xs text-muted">Next review: {schedule.due <= today ? "due now" : schedule.due}</p>}
          </div>
          {snap.seen && snap.hasCards && (
            <div>
              <p className="text-sm font-semibold">Evidence so far <span className="font-normal text-muted">(first try, no hint, on problems not seen recently)</span></p>
              <ul className="mt-2 space-y-1.5">
                <Meter label="Used it on its own" have={snap.evidence.application.clean} want={STANDARD.applications} />
                <Meter label="Spotted where it applies" have={snap.evidence.recognition.clean} want={STANDARD.recognitions} />
                <Meter label="Adapted it to a changed problem" have={snap.evidence.transfer.clean} want={STANDARD.transfers} />
                <Meter label="Still there after days away" have={snap.retention} want={STANDARD.retentions} />
              </ul>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">You will be able to</p>
            <ul className="mt-1 space-y-1 text-[15px]">
              {concept.objectives.map((o) => {
                const note = objectiveNote(o.id);
                return <li key={o.id} className="flex gap-2"><span className="text-muted">–</span><span className="flex-1">{o.text}{note && <span className={`ml-2 text-xs font-semibold ${note === "shown" ? "text-apply" : note === "needs another look" ? "text-reinforce" : "text-muted"}`}>{note}</span>}</span></li>;
              })}
            </ul>
          </div>
          <p className="text-sm"><span className="font-semibold">Mastery looks like: </span>{concept.standard}</p>
          {concept.prerequisites.length > 0 && (
            <p className="text-sm text-muted">Builds on {concept.prerequisites.map((p) => `${conceptOf(p.concept)?.name}${p.strength === "helpful" ? " (helpful)" : ""}`).join(", ")}.</p>
          )}
          {dependentsOf(concept.id).length > 0 && <p className="text-sm text-muted">Leads to {dependentsOf(concept.id).map((c) => c.name).join(", ")}.</p>}
          {!readOnly && (hasCards(concept.id) ? (
            <div>
              <button type="button" className="btn w-full" onClick={start}>{done ? "Keep going" : snap.seen ? "Practise this idea" : "Start this idea"}</button>
              {snap.state === "locked" && <p className="mt-2 text-xs text-muted">This builds on ideas you haven&apos;t established yet. You can still look; it may feel harder.</p>}
            </div>
          ) : <p className="text-sm text-muted">Cards for this idea haven&apos;t been written yet. It won&apos;t appear in your daily cards until they are.</p>)}
          {done > 0 && !card && <p className="text-xs text-muted">{done} card{done === 1 ? "" : "s"} on this idea just now.</p>}
        </>
      )}
      {card === null && done > 0 && nextInConcept(store.state, concept.id, today) === null && <p className="text-sm text-muted">Nothing new left on this idea today.</p>}
    </section>
  );
}

export function MapView({ store, today, readOnly = false }: { store: LearnStore; today: string; readOnly?: boolean }) {
  const snaps = useMemo(() => snapshots(store.state.events), [store.state.events]);
  const facts = progressFacts(snaps, store.state.events);
  const [open, setOpen] = useState<string | null>(null);
  const openConcept = open ? conceptOf(open) : undefined;

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Your map</h1>
        <p className="mt-1 text-sm text-muted">Each idea moves on evidence: using it on your own, spotting it, adapting it, and keeping it over time. Doing more cards alone doesn&apos;t move it.</p>
      </header>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          [facts.discovered, "ideas met"],
          [facts.developing.length, "being built"],
          [facts.solid.length, "solid (proficient or mastered)"],
          [facts.reinforce.length, "need another look"],
        ].map(([n, label]) => (
          <div key={label as string} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-line">
            <p className="text-2xl font-bold">{n}</p>
            <p className="text-xs font-medium text-muted">{label}</p>
          </div>
        ))}
      </section>
      {(facts.domainStrength.size > 0 || facts.techniques.length > 0) && (
        <section className="space-y-1 px-1 text-sm">
          {facts.domainStrength.size > 0 && (
            <p><span className="font-semibold">Strongest areas: </span>{[...facts.domainStrength].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${COURSE.domains.find((x) => x.id === d)?.name} (${n})`).join(", ")}</p>
          )}
          {facts.techniques.length > 0 && <p><span className="font-semibold">Recently used on your own: </span>{facts.techniques.join(" · ")}</p>}
        </section>
      )}

      {openConcept && <ConceptSheet key={openConcept.id} concept={openConcept} snap={snaps.get(openConcept.id)!} store={store} today={today} readOnly={readOnly} onClose={() => setOpen(null)} />}

      {COURSE.domains.map((d) => (
        <section key={d.id} className="space-y-3">
          <h2 className="px-1 text-lg font-bold">{d.name}</h2>
          {d.units.map((u) => (
            <div key={u.id} className="rounded-3xl bg-white p-3 ring-1 ring-line md:p-4">
              <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-muted">{u.name}</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {u.concepts.map((c) => {
                  const s = snaps.get(c.id)!;
                  const written = hasCards(c.id);
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setOpen(c.id)} aria-pressed={open === c.id}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-canvas ${open === c.id ? "bg-canvas ring-2 ring-brand/30" : ""} ${written ? "" : "opacity-55"}`}>
                        <span className={`h-3 w-3 shrink-0 rounded-full ${STATE_STYLE[s.state].dot}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                          <span className={`block text-xs ${s.needsReinforcement ? "font-semibold text-reinforce" : "text-muted"}`}>
                            {!written ? "Not written yet" : s.needsReinforcement ? "Needs another look" : s.state === "available" ? "Ready to start" : s.state === "locked" ? `After ${s.blockedBy.map((b) => conceptOf(b)?.name).join(", ")}` : STATE_MEANING[s.state]}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
