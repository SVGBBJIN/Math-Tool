"use client";
import { useActionState, useState } from "react";
import { addAopsProblem as serverAops, addPastedProblem as serverPaste, importCsv as serverCsv } from "../../actions/problems";
import type { FormState } from "../../actions/account";
import { FormMessage } from "@/components/FormMessage";
import { TECHNIQUES, TOPICS } from "@/lib/tags";

type Tab = "aops" | "paste" | "csv";

type FormAction = (prev: FormState, form: FormData) => Promise<FormState>;
export interface AddProblemActions {
  addAopsProblem: FormAction;
  addPastedProblem: FormAction;
  importCsv: FormAction;
}
const SERVER_ACTIONS: AddProblemActions = { addAopsProblem: serverAops, addPastedProblem: serverPaste, importCsv: serverCsv };

export function AddProblemForms({ isParent, actions = SERVER_ACTIONS }: { isParent: boolean; actions?: AddProblemActions }) {
  const { addAopsProblem, addPastedProblem, importCsv } = actions;
  const [tab, setTab] = useState<Tab | null>(null);
  const [aopsState, aopsAction, aopsPending] = useActionState<FormState, FormData>(addAopsProblem, {});
  const [pasteState, pasteAction, pastePending] = useActionState<FormState, FormData>(addPastedProblem, {});
  const [csvState, csvAction, csvPending] = useActionState<FormState, FormData>(importCsv, {});

  return (
    <section className="card">
      <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
        {([
          ["aops", "+ AoPS link"],
          ["paste", "+ Paste"],
          ["csv", "Import CSV"],
        ] as const).map(([t, l]) => (
          <button key={t} type="button" onClick={() => setTab(tab === t ? null : t)} className={tab === t ? "btn" : "btn-ghost"}>
            {l}
          </button>
        ))}
      </div>

      <datalist id="techniques">{TECHNIQUES.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="topics">{TOPICS.map((t) => <option key={t} value={t} />)}</datalist>

      {tab === "aops" && (
        <form action={aopsAction} className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="contest">Contest</label>
              <input id="contest" name="contest" className="input" defaultValue="AMC 10A" required />
            </div>
            <div>
              <label className="label" htmlFor="year">Year</label>
              <input id="year" name="year" type="number" className="input" required min={2000} max={2100} />
            </div>
            <div>
              <label className="label" htmlFor="number">#</label>
              <input id="number" name="number" type="number" className="input" required min={1} max={25} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="answer">Answer</label>
              <select id="answer" name="answer" className="input" required>
                {["A", "B", "C", "D", "E"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" className="input">
                <option value="train">train</option>
                {isParent && <option value="vault">vault (sealed)</option>}
              </select>
            </div>
          </div>
          <TagInputs />
          <button className="btn w-full" disabled={aopsPending}>Add link</button>
          <FormMessage state={aopsState} />
        </form>
      )}

      {tab === "paste" && (
        <form action={pasteAction} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="statement">Problem statement</label>
            <textarea id="statement" name="statement" className="input min-h-28" required />
          </div>
          {["A", "B", "C", "D", "E"].map((l) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-6 font-bold">{l}</span>
              <input name={`choice${l}`} className="input" required aria-label={`Choice ${l}`} />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label" htmlFor="pAnswer">Answer</label>
              <select id="pAnswer" name="answer" className="input">{["A", "B", "C", "D", "E"].map((l) => <option key={l}>{l}</option>)}</select>
            </div>
            <div>
              <label className="label" htmlFor="difficulty">Position</label>
              <input id="difficulty" name="difficulty" type="number" min={1} max={25} defaultValue={10} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="pContest">Source</label>
              <input id="pContest" name="contest" className="input" placeholder="optional" />
            </div>
          </div>
          <TagInputs />
          <button className="btn w-full" disabled={pastePending}>Add problem</button>
          <FormMessage state={pasteState} />
        </form>
      )}

      {tab === "csv" && (
        <form action={csvAction} className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            One AoPS problem per line: <code className="text-xs">contest,year,number,answer,topic,techniques[,status]</code>. Separate
            multiple tags with <code>;</code>. Status is <code>train</code> (default) or <code>vault</code>.
          </p>
          <textarea
            name="csv"
            className="input min-h-36 font-mono text-xs"
            placeholder={"contest,year,number,answer,topic,techniques,status\nAMC 10A,2016,7,C,algebra,systems_of_equations,train"}
            required
          />
          <button className="btn w-full" disabled={csvPending}>Import</button>
          <FormMessage state={csvState} />
        </form>
      )}
    </section>
  );
}

function TagInputs() {
  return (
    <>
      <div>
        <label className="label" htmlFor="techniques">Technique tags (separate with ;)</label>
        <input id="techniques" name="techniques" list="techniques" className="input" placeholder="casework; complementary_counting" required />
      </div>
      <div>
        <label className="label" htmlFor="topics">Topic</label>
        <input id="topics" name="topics" list="topics" className="input" placeholder="counting_probability" />
      </div>
    </>
  );
}
