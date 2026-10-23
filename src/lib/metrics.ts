export type Ratio = { num: number; den: number };

/** Returns a percentage or null when there is not enough data (empty denominator). */
export function ratioPercent(r: Ratio | null | undefined): number | null {
  if (!r || !r.den || r.den <= 0) return null;
  return Math.round((r.num / r.den) * 1000) / 10;
}

export function meetsTarget(r: Ratio | null | undefined, target: number): boolean | null {
  const p = ratioPercent(r);
  return p === null ? null : p >= target;
}

export const TARGETS = { understanding: 80, core_flow: 80, reminders: 99 } as const;

/** Escape spreadsheet formula injection (cells starting with = + - @ tab CR). */
export function safeCell(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
