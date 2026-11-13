"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { generateProblem, nextLevel, type Level, type ScrollProblem } from "@/lib/scroll";
import { logScrollProblem } from "../../actions/scroll";

const BATCH = 6;
const LABELS = ["A", "B", "C", "D"];

interface Card {
  problem: ScrollProblem;
  picked: number | null;
}

export function ScrollClient() {
  const [level, setLevel] = useState<Level>(1);
  const [cards, setCards] = useState<Card[]>([]);
  const [active, setActive] = useState(0);
  const [stats, setStats] = useState({ answered: 0, correct: 0, run: 0, best: 0 });
  const recent = useRef<boolean[]>([]);
  const seedRef = useRef(0);
  const shownAt = useRef(Date.now());
  const [, startTransition] = useTransition();

  const makeBatch = useCallback((lvl: Level): Card[] => {
    return Array.from({ length: BATCH }, () => {
      seedRef.current += 1;
      return { problem: generateProblem(seedRef.current, lvl), picked: null };
    });
  }, []);

  // Seed on the client only, so server and client never disagree about the first cards.
  useEffect(() => {
    seedRef.current = Math.floor(Math.random() * 1e9);
    setCards(makeBatch(1));
  }, [makeBatch]);

  // Keep a few unanswered cards ahead of the viewer.
  useEffect(() => {
    if (cards.length && active >= cards.length - 3) setCards((c) => [...c, ...makeBatch(level)]);
  }, [active, cards.length, level, makeBatch]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [active]);

  const answer = (index: number, choice: number) => {
    const card = cards[index];
    if (!card || card.picked !== null) return;
    const right = choice === card.problem.answerIndex;
    const seconds = (Date.now() - shownAt.current) / 1000;
    setCards((cs) => cs.map((c, i) => (i === index ? { ...c, picked: choice } : c)));
    recent.current = [...recent.current, right].slice(-5);
    setLevel((l) => nextLevel(l, recent.current));
    setStats((s) => {
      const run = right ? s.run + 1 : 0;
      return { answered: s.answered + 1, correct: s.correct + (right ? 1 : 0), run, best: Math.max(s.best, run) };
    });
    startTransition(() => {
      void logScrollProblem({ seconds });
    });
  };

  return (
    <div className="-mx-4 -mt-2">
      <div className="flex items-center justify-between px-4 pb-2 text-sm font-semibold">
        <span>🔥 {stats.run} in a row</span>
        <span className="text-muted">Level {level} · {stats.correct}/{stats.answered}</span>
      </div>
      <div
        className="h-[calc(100dvh-13rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollTop / el.clientHeight);
          if (i !== active) setActive(i);
        }}
      >
        {cards.map((c, i) => (
          <section key={c.problem.id} className="flex h-full snap-start snap-always flex-col justify-center px-4 py-3">
            <div className="card flex flex-col gap-4 p-5">
              <p className="chip self-start">#{i + 1} · {c.problem.kind}</p>
              <p className="text-xl font-bold leading-snug">{c.problem.prompt}</p>
              <div className="grid grid-cols-2 gap-3">
                {c.problem.choices.map((ch, ci) => {
                  const done = c.picked !== null;
                  const isAnswer = ci === c.problem.answerIndex;
                  const style = !done
                    ? "border-line bg-white active:bg-canvas"
                    : isAnswer
                      ? "border-mastery bg-mastery/10"
                      : ci === c.picked
                        ? "border-danger bg-danger/10"
                        : "border-line bg-white opacity-60";
                  return (
                    <button
                      key={ci}
                      disabled={done}
                      onClick={() => answer(i, ci)}
                      className={`min-h-14 rounded-xl border-2 px-3 py-2 text-lg font-bold transition ${style}`}
                    >
                      <span className="mr-2 text-sm font-semibold text-muted">{LABELS[ci]}</span>
                      {ch}
                    </button>
                  );
                })}
              </div>
              {c.picked !== null && (
                <div role="status" className="space-y-1 text-sm">
                  <p className={`font-bold ${c.picked === c.problem.answerIndex ? "text-mastery" : "text-danger"}`}>
                    {c.picked === c.problem.answerIndex ? "Nice! ✓" : "Not quite."}
                  </p>
                  <p className="text-muted">{c.problem.explanation}</p>
                  <p className="pt-1 text-center font-semibold text-brand">Swipe up for the next one ↑</p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
