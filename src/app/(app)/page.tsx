import Link from "next/link";
import { requireContext } from "@/lib/session";
import { getDayStatus, getKeptMap } from "@/lib/data";
import { PLAN_LABELS, currentStreak, type PlanItem } from "@/lib/plan";
import { addDays, daysBetween, weekday } from "@/lib/dates";

const ITEM_LINKS: Partial<Record<PlanItem, string>> = {
  trainer: "/trainer",
  error_review: "/errors",
  khan: "/khan",
};
const COMING: Partial<Record<PlanItem, string>> = {
  timed_block: "Endurance mode arrives in M4",
  saturday_review: "Arrives with endurance mode (M4)",
};

export default async function TodayPage() {
  const ctx = await requireContext();
  const { today, household } = ctx;
  const [status, kept] = await Promise.all([
    getDayStatus(ctx.supabase, ctx.profile.id, today),
    getKeptMap(ctx.supabase, ctx.profile.id, today, 70),
  ]);
  const streak = currentStreak(kept, today);
  const amcDays = household.amc_date ? daysBetween(today, household.amc_date) : null;

  // 5 weeks ending this week (Sun–Sat rows).
  const start = addDays(today, -weekday(today) - 28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const doneCount = status.done.length;
  const pct = status.required.length ? Math.round((doneCount / status.required.length) * 100) : 100;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-sm font-semibold text-muted">Streak</p>
          <p className="text-3xl font-extrabold">
            {streak} <span className="text-base font-semibold text-muted">day{streak === 1 ? "" : "s"}</span>
          </p>
          <p className="text-xs text-muted">{status.minimumMet ? "Today counts ✓" : "10 min keeps it alive"}</p>
        </div>
        <div className="card">
          <p className="text-sm font-semibold text-muted">AMC 10</p>
          {amcDays === null ? (
            <Link href="/settings" className="text-sm font-semibold text-brand">Set the date →</Link>
          ) : (
            <>
              <p className="text-3xl font-extrabold">
                {Math.max(0, amcDays)} <span className="text-base font-semibold text-muted">days</span>
              </p>
              <p className="text-xs text-muted">{household.amc_date}</p>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="flex items-baseline justify-between">
          <h1 className="h2">Today</h1>
          <span className="text-sm text-muted">{today}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas" aria-label={`${pct}% of today's plan done`}>
          <div className="h-full rounded-full bg-mastery transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 space-y-2">
          {status.required.map((item) => {
            const done = status.done.includes(item);
            const href = ITEM_LINKS[item];
            const body = (
              <div className={`flex items-center gap-3 rounded-xl border p-3 ${done ? "border-mastery/40 bg-mastery/5" : "border-line"}`}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-mastery text-white" : "border-2 border-line"}`}
                  aria-hidden
                >
                  {done ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{PLAN_LABELS[item]}</p>
                  {!done && COMING[item] && <p className="text-xs text-muted">{COMING[item]}</p>}
                </div>
                {href && !done && <span className="text-sm font-semibold text-brand">Start →</span>}
              </div>
            );
            return <li key={item}>{href ? <Link href={href}>{body}</Link> : body}</li>;
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {status.complete
            ? "All done for today. 🎉"
            : `${Math.round(status.totalMinutes)} min logged today. Finish the list to stop reminders.`}
        </p>
      </section>

      <section className="card">
        <h2 className="h2">Last 5 weeks</h2>
        <div className="mt-3 grid grid-cols-7 gap-1.5" role="grid" aria-label="Completion over the last 5 weeks">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="text-center text-xs text-muted">{d}</span>
          ))}
          {cells.map((d) => {
            const future = d > today;
            const k = kept.get(d);
            const cls = future ? "bg-transparent" : k ? "bg-mastery" : kept.has(d) ? "bg-familiar/60" : "bg-canvas";
            return (
              <span
                key={d}
                title={`${d}${k ? ": kept" : ""}`}
                className={`aspect-square rounded-md ${cls} ${d === today ? "ring-2 ring-brand" : ""}`}
              />
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Green = streak kept · amber = some work, under the minimum</p>
      </section>
    </div>
  );
}
