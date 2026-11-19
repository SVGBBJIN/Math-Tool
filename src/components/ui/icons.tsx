// Small line icons used by page headers and hub tiles.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const IconProblem = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
);
export const IconProgress = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconMap = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>
);
export const IconErrors = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /><path d="M12 8v4l3 2" /></svg>
);
export const IconBack = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M15 18l-6-6 6-6" /></svg>
);
export const IconArrow = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconCheck = ({ className }: { className?: string }) => (
  <svg {...base} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
