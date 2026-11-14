"use client";
import { useTransition, useState } from "react";
import { deleteProblem as serverDelete, setProblemStatus as serverSetStatus } from "../../actions/problems";

export interface RowActionHandlers {
  setProblemStatus: (id: string, status: "train" | "vault" | "burned") => Promise<{ error?: string }>;
  deleteProblem: (id: string) => Promise<{ error?: string }>;
}
const SERVER_ACTIONS: RowActionHandlers = { setProblemStatus: serverSetStatus, deleteProblem: serverDelete };

export function RowActions({
  id,
  status,
  isParent,
  actions = SERVER_ACTIONS,
}: {
  id: string;
  status: string;
  isParent: boolean;
  actions?: RowActionHandlers;
}) {
  const { setProblemStatus, deleteProblem } = actions;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
    });
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
      {status !== "train" && status !== "vault" && (
        <button className="text-brand" disabled={pending} onClick={() => run(() => setProblemStatus(id, "train"))}>Move to train</button>
      )}
      {status === "train" && (
        <button className="text-muted" disabled={pending} onClick={() => run(() => setProblemStatus(id, "burned"))}>Mark burned</button>
      )}
      {isParent && status === "train" && (
        <button className="text-muted" disabled={pending} onClick={() => run(() => setProblemStatus(id, "vault"))}>Seal in vault</button>
      )}
      {isParent && (
        <button
          className="ml-auto text-danger"
          disabled={pending}
          onClick={() => confirm("Delete this problem and its attempts?") && run(() => deleteProblem(id))}
        >
          Delete
        </button>
      )}
      {error && <span className="w-full text-danger">{error}</span>}
    </div>
  );
}
