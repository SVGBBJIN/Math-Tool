"use client";
// KaTeX rendering of one piece of math. Each term, factor and side is rendered on its own
// so it can be its own draggable/selectable element.
import katex from "katex";
import { useMemo } from "react";

export function Tex({ latex, className = "" }: { latex: string; className?: string }) {
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false, output: "html" }), [latex]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
