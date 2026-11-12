"use client";
import { useState, useTransition } from "react";
import { logKhanSession } from "../../actions/khan";
import { FormMessage } from "@/components/FormMessage";

const EMPTY = { unit: "", skill: "", minutes: "", correct: "", total: "", note: "", url: "" };

export function KhanForm() {
  const [f, setF] = useState(EMPTY);
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [busy, start] = useTransition();
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setState({});
      const r = await logKhanSession({
        unit: f.unit,
        skill: f.skill,
        minutes: Number(f.minutes),
        questionsCorrect: Number(f.correct || 0),
        questionsTotal: Number(f.total || 0),
        proofNote: f.note,
        proofUrl: f.url,
      });
      if (r.error) return setState({ error: r.error });
      setF(EMPTY);
      setState({ message: "Logged. Nice work." });
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="h2">Log a session</h2>
      <div>
        <label className="label" htmlFor="unit">Unit</label>
        <input id="unit" className="input" required maxLength={120} placeholder="e.g. Trigonometry" value={f.unit} onChange={set("unit")} />
      </div>
      <div>
        <label className="label" htmlFor="skill">Skill or exercise</label>
        <input id="skill" className="input" required maxLength={160} placeholder="e.g. Unit circle" value={f.skill} onChange={set("skill")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="minutes">Minutes</label>
          <input id="minutes" className="input" type="number" inputMode="numeric" min={1} max={180} step={1} required value={f.minutes} onChange={set("minutes")} />
        </div>
        <div>
          <label className="label" htmlFor="correct">Correct</label>
          <input id="correct" className="input" type="number" inputMode="numeric" min={0} step={1} value={f.correct} onChange={set("correct")} />
        </div>
        <div>
          <label className="label" htmlFor="total">Out of</label>
          <input id="total" className="input" type="number" inputMode="numeric" min={0} step={1} value={f.total} onChange={set("total")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">Proof: what did you do and learn?</label>
        <textarea id="note" className="input min-h-24" required minLength={20} maxLength={1000} value={f.note} onChange={set("note")} placeholder="e.g. Finished the unit circle exercise. Missed two questions because I mixed up sign in quadrant III." />
      </div>
      <div>
        <label className="label" htmlFor="url">Khan link (optional)</label>
        <input id="url" className="input" type="url" inputMode="url" maxLength={500} placeholder="https://www.khanacademy.org/…" value={f.url} onChange={set("url")} />
      </div>
      <button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Log session"}</button>
      <FormMessage state={state} />
    </form>
  );
}
