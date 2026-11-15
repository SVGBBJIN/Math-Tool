"use client";
// Direct manipulation for the workspace, touch-first. One rule covers everything:
//   drag X onto Y   ==   tap X, then tap Y.
// X is "held" between the two taps (it gets a ring); tapping it again lets go. Drags start
// only on draggable pieces, which carry `touch-action: none`; the rest of the page keeps
// normal scrolling, and a press that moves less than a few pixels is treated as a tap.
// No hover-only behaviour anywhere. Works with a mouse the same way.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/** Something that can be picked up. `id` must be unique on screen. */
export interface Held {
  id: string;
  /** Text for the floating ghost while dragging. */
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}
export interface DropSpot {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface Ctx {
  held: Held | null;
  setHeld: (h: Held | null) => void;
  over: string | null;
  drop: (h: Held, spot: DropSpot) => void;
  accepts: (h: Held, spot: DropSpot) => boolean;
  begin: (h: Held, e: React.PointerEvent) => void;
  spots: React.RefObject<Map<string, DropSpot>>;
}
const DnD = createContext<Ctx | null>(null);
const useDnD = () => {
  const c = useContext(DnD);
  if (!c) throw new Error("DnD context missing");
  return c;
};
export const useHeld = () => useDnD().held;
export const useSetHeld = () => useDnD().setHeld;

const THRESHOLD = 8;

export function DragProvider({
  children, onDrop, accepts,
}: {
  children: ReactNode;
  onDrop: (h: Held, spot: DropSpot) => void;
  accepts: (h: Held, spot: DropSpot) => boolean;
}) {
  const [held, setHeld] = useState<Held | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number } | null>(null);
  const spots = useRef(new Map<string, DropSpot>());
  const live = useRef({ onDrop, accepts });
  live.current = { onDrop, accepts };

  const drop = useCallback((h: Held, spot: DropSpot) => {
    setHeld(null);
    setOver(null);
    live.current.onDrop(h, spot);
  }, []);

  const spotAt = (x: number, y: number): DropSpot | null => {
    const el = typeof document !== "undefined" ? document.elementFromPoint(x, y)?.closest("[data-drop]") : null;
    const id = el?.getAttribute("data-drop");
    return id ? (spots.current.get(id) ?? null) : null;
  };

  const begin = useCallback((h: Held, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
      dragging = true;
      ev.preventDefault();
      setGhost({ label: h.label, x: ev.clientX, y: ev.clientY });
      const s = spotAt(ev.clientX, ev.clientY);
      setOver(s && s.id !== h.id && live.current.accepts(h, s) ? s.id : null);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setGhost(null);
      setOver(null);
      if (!dragging) return; // a tap: handled by the element's click
      const s = spotAt(ev.clientX, ev.clientY);
      // Dropped nowhere useful: it snaps back.
      if (s && s.id !== h.id && live.current.accepts(h, s)) drop(h, s);
      suppressClick();
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setGhost(null);
      setOver(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }, [drop]);

  const value = useMemo(() => ({ held, setHeld, over, drop, accepts, begin, spots }), [held, over, drop, accepts, begin]);
  return (
    <DnD.Provider value={value}>
      {children}
      {ghost && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[120%] rounded-lg bg-brand px-2 py-1 text-sm font-bold text-white shadow-lg" style={{ left: ghost.x, top: ghost.y }} aria-hidden>
          {ghost.label}
        </div>
      )}
    </DnD.Provider>
  );
}

// After a drag ends, the browser may still fire one click (dispatched in the same task as
// the pointerup). Swallow only that click: the flag is cleared on the next macrotask, so a
// quick genuine tap right after a drag still works.
let suppressing = false;
function suppressClick() {
  suppressing = true;
  setTimeout(() => {
    suppressing = false;
  }, 0);
}
const suppressed = () => suppressing;

/**
 * A piece of the workspace: draggable (`item`), a drop spot (`spot`), or both.
 * Tap: if something else is held and this spot accepts it, drop it here; otherwise pick
 * this up (or let go if it is already held).
 */
export function Piece({
  item, spot, className = "", heldClass = "ring-2 ring-brand bg-brand/10", overClass = "ring-2 ring-mastery bg-mastery/10", label, onTapEmpty, children, disabled,
}: {
  item?: Held;
  spot?: DropSpot;
  className?: string;
  heldClass?: string;
  overClass?: string;
  label?: string;
  /** Tap with nothing held, on a spot that can't be picked up. */
  onTapEmpty?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const c = useDnD();
  if (spot) c.spots.current.set(spot.id, spot);
  const isHeld = !!item && c.held?.id === item.id;
  const canTake = !!spot && !!c.held && c.held.id !== item?.id && c.accepts(c.held, spot);
  const isOver = !!spot && c.over === spot.id;

  const tap = () => {
    if (disabled || suppressed()) return;
    if (canTake && c.held && spot) return c.drop(c.held, spot);
    if (item) return c.setHeld(isHeld ? null : item);
    onTapEmpty?.();
  };
  return (
    <button
      type="button"
      data-drop={spot?.id}
      aria-pressed={item ? isHeld : undefined}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        tap();
      }}
      onPointerDown={item && !disabled ? (e) => c.begin(item, e) : undefined}
      style={item ? { touchAction: "none" } : undefined}
      className={`${className} ${isHeld ? heldClass : ""} ${isOver ? overClass : ""} ${canTake && !isOver ? "outline-2 outline-dashed outline-brand/60" : ""} select-none transition`}
    >
      {children}
    </button>
  );
}

/**
 * A drop area that contains other pieces (a side of an equation, the structure canvas).
 * Not a button, since it holds buttons; taps on its children don't reach it.
 */
export function Zone({
  spot, className = "", overClass = "ring-2 ring-mastery bg-mastery/5", label, onTapEmpty, children,
}: {
  spot: DropSpot;
  className?: string;
  overClass?: string;
  label: string;
  onTapEmpty?: () => void;
  children: ReactNode;
}) {
  const c = useDnD();
  c.spots.current.set(spot.id, spot);
  const canTake = !!c.held && c.accepts(c.held, spot);
  const isOver = c.over === spot.id;
  const tap = () => {
    if (suppressed()) return;
    if (canTake && c.held) return c.drop(c.held, spot);
    onTapEmpty?.();
  };
  return (
    <div
      data-drop={spot.id}
      role="group"
      aria-label={label}
      tabIndex={0}
      onClick={tap}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && tap()}
      className={`${className} ${isOver ? overClass : ""} ${canTake && !isOver ? "outline-2 outline-dashed outline-brand/50" : ""} transition`}
    >
      {children}
    </div>
  );
}
