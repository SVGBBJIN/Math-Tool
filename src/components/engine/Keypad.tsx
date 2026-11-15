"use client";
// On-screen keypad: the only way to type a value. No phone keyboard pops up, and nothing
// on it is ever an answer choice: it is digits and symbols.
export type KeySet = "int" | "term" | "count";

const KEYS: Record<KeySet, string[]> = {
  int: ["7", "8", "9", "4", "5", "6", "1", "2", "3", "−", "0", "⌫"],
  term: ["7", "8", "9", "x", "4", "5", "6", "y", "1", "2", "3", "²", "−", "0", "+", "⌫", "(", ")", "√", "^"],
  count: ["7", "8", "9", "4", "5", "6", "1", "2", "3", "!", "0", "⌫", "×"],
};
/** What each key appends to the slot's text (the parser reads Unicode minus, ² and √). */
const INSERT: Record<string, string> = { "²": "^2", "−": "-" };

export function applyKey(value: string, key: string): string {
  if (key === "⌫") return value.slice(0, -1);
  return value + (INSERT[key] ?? key);
}

export function Keypad({ set, onKey }: { set: KeySet; onKey: (key: string) => void }) {
  const cols = set === "term" ? "grid-cols-4" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-1.5`} role="group" aria-label="Keypad">
      {KEYS[set].map((k) => (
        <button key={k} type="button" data-keypad onClick={() => onKey(k)} aria-label={k === "⌫" ? "Delete" : k}
          className="min-h-11 rounded-xl border border-line bg-white text-lg font-semibold active:bg-brand/10">
          {k}
        </button>
      ))}
    </div>
  );
}
