// A small markup for card text, so content stays plain strings:
//   **bold**, and $…$ for mathematics in a TeX-like subset (x^2, a_n, \frac{a}{b}, \sqrt{x},
//   \binom{n}{k}, \text{…}, \pmod{n}, and named symbols).
// Parsing is pure and strict: an unknown command or unbalanced brace throws, so the card
// validator catches typos before a student ever sees them.

export class MarkupError extends Error {}

export type MathNode =
  | { t: "var"; s: string }
  | { t: "sym"; s: string }
  | { t: "op"; s: string }
  | { t: "text"; s: string }
  | { t: "sup"; body: MathNode[] }
  | { t: "sub"; body: MathNode[] }
  | { t: "frac"; num: MathNode[]; den: MathNode[] }
  | { t: "binom"; top: MathNode[]; bottom: MathNode[] }
  | { t: "sqrt"; body: MathNode[] };

export type Segment = { t: "text"; s: string } | { t: "bold"; s: string } | { t: "math"; nodes: MathNode[] };

const SYMBOLS: Record<string, string> = {
  cdot: "·", times: "×", div: "÷", pm: "±", le: "≤", ge: "≥", ne: "≠", equiv: "≡", approx: "≈", angle: "∠", triangle: "△",
  pi: "π", deg: "°", dots: "…", to: "→", parallel: "∥", perp: "⊥", sim: "∼", mid: "∣", ldots: "…", ell: "ℓ", leftrightarrow: "↔",
};
const SPACED = new Set(["=", "+", "−", "·", "×", "÷", "±", "≤", "≥", "≠", "≡", "≈", "<", ">", "→", "∥", "⊥", "∼", "∣", "↔"]);

export function parseMath(src: string): MathNode[] {
  let i = 0;
  const group = (): MathNode[] => {
    if (src[i] !== "{") throw new MarkupError(`expected "{" at ${i} in $${src}$`);
    i++;
    const body = seq("}");
    if (src[i] !== "}") throw new MarkupError(`missing "}" in $${src}$`);
    i++;
    return body;
  };
  /** One token or a braced group (for ^ and _). */
  const arg = (): MathNode[] => {
    if (src[i] === "{") return group();
    const before = i;
    const one = atom();
    if (i === before || !one) throw new MarkupError(`nothing after ^ or _ in $${src}$`);
    return [one];
  };
  const atom = (): MathNode | null => {
    const c = src[i];
    if (c === "\\") {
      i++;
      const m = /^[a-zA-Z]+/.exec(src.slice(i));
      if (!m) throw new MarkupError(`stray backslash in $${src}$`);
      const name = m[0];
      i += name.length;
      if (name === "frac") return { t: "frac", num: group(), den: group() };
      if (name === "binom") return { t: "binom", top: group(), bottom: group() };
      if (name === "sqrt") return { t: "sqrt", body: group() };
      if (name === "text") {
        if (src[i] !== "{") throw new MarkupError(`\\text needs braces in $${src}$`);
        const end = src.indexOf("}", i);
        if (end < 0) throw new MarkupError(`missing "}" in $${src}$`);
        const s = src.slice(i + 1, end);
        i = end + 1;
        return { t: "text", s };
      }
      if (name === "pmod") {
        const body = group();
        return { t: "text", s: ` (mod ${plainMath(body)})` };
      }
      if (!(name in SYMBOLS)) throw new MarkupError(`unknown command \\${name} in $${src}$`);
      const s = SYMBOLS[name];
      return SPACED.has(s) ? { t: "op", s } : { t: "sym", s };
    }
    if (c === "^") { i++; return { t: "sup", body: arg() }; }
    if (c === "_") { i++; return { t: "sub", body: arg() }; }
    if (c === "{") throw new MarkupError(`stray "{" in $${src}$`);
    i++;
    if (c === " ") return null;
    if (/[a-zA-Z]/.test(c)) return { t: "var", s: c };
    if (c === "-") return { t: "op", s: "−" };
    if (c === "*") return { t: "op", s: "·" };
    if (SPACED.has(c)) return { t: "op", s: c };
    if (/\d/.test(c)) {
      let j = i;
      while (j < src.length && /[\d.,]/.test(src[j]) && !(/[.,]/.test(src[j]) && !/\d/.test(src[j + 1] ?? ""))) j++;
      const s = c + src.slice(i, j);
      i = j;
      return { t: "sym", s };
    }
    return { t: "sym", s: c };
  };
  const seq = (stop: string | null): MathNode[] => {
    const out: MathNode[] = [];
    while (i < src.length && src[i] !== stop) {
      if (src[i] === "}") throw new MarkupError(`stray "}" in $${src}$`);
      const node = atom();
      if (node) out.push(node);
    }
    return out;
  };
  const nodes = seq(null);
  if (!nodes.length) throw new MarkupError("empty $$");
  return nodes;
}

/** Split card text into plain, bold and math segments. */
export function parseRich(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\$([^$]*)\$|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ t: "text", s: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { t: "math", nodes: parseMath(m[1]) } : { t: "bold", s: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", s: text.slice(last) });
  for (const s of out) if (s.t === "text" && /[$]|\*\*/.test(s.s)) throw new MarkupError(`unbalanced $ or ** in "${text}"`);
  return out;
}

/** True when a unary minus is meant: at the start, or after another operator or an opening bracket. */
const unaryAt = (nodes: MathNode[], k: number) => k === 0 || nodes[k - 1].t === "op" || (nodes[k - 1].t === "sym" && /[(,]/.test((nodes[k - 1] as { s: string }).s));
export { unaryAt };

function plainMath(nodes: MathNode[]): string {
  const wrap = (body: MathNode[]) => {
    const s = plainMath(body);
    return /^[\w.]+$/.test(s) ? s : `(${s})`;
  };
  return nodes
    .map((n, k) => {
      switch (n.t) {
        case "var": case "sym": case "text": return n.s;
        case "op": return n.s === "−" && unaryAt(nodes, k) ? "−" : ` ${n.s} `;
        case "sup": return `^${wrap(n.body)}`;
        case "sub": return `_${wrap(n.body)}`;
        case "frac": return `${wrap(n.num)}/${wrap(n.den)}`;
        case "binom": return `C(${plainMath(n.top)}, ${plainMath(n.bottom)})`;
        case "sqrt": return `√${wrap(n.body)}`;
      }
    })
    .join("");
}

/** Card text with the markup flattened, for logs, screen-reader labels and consistency checks. */
export function plainText(text: string): string {
  return parseRich(text).map((s) => (s.t === "math" ? plainMath(s.nodes) : s.s)).join("").replace(/\s+/g, " ").trim();
}
