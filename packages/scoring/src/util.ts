export const DAY_MS = 86_400_000;

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, x));
}

export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Days from `earlier` to `later`; negative if `earlier` is in the future. */
export function daysBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / DAY_MS;
}

/** Piecewise-linear lookup over ascending [x, y] points, flat beyond the ends. */
export function interpolate(points: ReadonlyArray<readonly [number, number]>, x: number): number {
  let prev: readonly [number, number] | undefined;
  for (const point of points) {
    if (x <= point[0]) {
      if (!prev) return point[1];
      const t = (x - prev[0]) / (point[0] - prev[0]);
      return prev[1] + (point[1] - prev[1]) * t;
    }
    prev = point;
  }
  return prev ? prev[1] : 0;
}

export function formatDays(days: number): string {
  const n = Math.round(days);
  if (n <= 0) return "today";
  return n === 1 ? "1 day ago" : `${n} days ago`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "a", "a and b", "a, b and c" */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Round non-negative reals to integers that sum to `target`, never exceeding `caps`.
 * Largest-remainder method; used so every displayed point adds up exactly (A2).
 */
export function roundToTarget(
  values: readonly number[],
  target: number,
  caps?: readonly number[],
): number[] {
  const capAt = (i: number) => caps?.[i] ?? Number.POSITIVE_INFINITY;
  const result = values.map((v, i) => Math.min(Math.floor(v), capAt(i)));
  let remaining = target - result.reduce((a, b) => a + b, 0);
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    const current = result[i] ?? 0;
    if (current + 1 <= capAt(i)) {
      result[i] = current + 1;
      remaining--;
    }
  }
  return result;
}
