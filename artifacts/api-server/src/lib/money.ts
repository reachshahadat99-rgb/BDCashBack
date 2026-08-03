/**
 * Canonical numeric helpers for the API server.
 *
 * All monetary values come from Postgres as numeric strings.  Import these
 * helpers instead of defining local equivalents in every file.
 */

/** Coerce a Postgres numeric/string/null value to a JS number. */
export const money = (v: string | number | null | undefined): number =>
  Number(v ?? 0);

/** Round to 2 decimal places (banker-safe for display; not for storage). */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
