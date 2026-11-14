"use client";
import { useTransition, useState } from "react";
import { deleteProblem, setProblemStatus } from "../../actions/problems";

export function RowActions({ id, status }: { id: string; status: string }) {
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
      {status === "train" && (
        <button className="text-muted" disabled={pending} onClick={() => run(() => setProblemStatus(id, "vault"))}>Seal in vault</button>
      )}
      <button
        className="ml-auto text-danger"
        disabled={pending}
        onClick={() => confirm("Delete this problem and its attempts?") && run(() => deleteProblem(id))}
      >
        Delete
      </button>
      {error && <span className="w-full text-danger">{error}</span>}
    </div>
  );
}
