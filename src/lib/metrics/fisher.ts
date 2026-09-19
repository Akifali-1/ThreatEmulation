/**
 * Fisher's exact test on a 2×2 contingency table.
 *
 * Used on the Compare page to test the *primary* outcome — whether a technique was evaded —
 * which the Mann-Whitney test cannot see, because it compares detection latency and only
 * among trials that were detected at all.
 *
 * The two-sided p-value follows scipy's definition: sum the hypergeometric probability of
 * every table with the same margins whose probability is less than or equal to the observed
 * table's, with a small relative tolerance so that floating-point noise doesn't drop
 * equally-probable tables. Probabilities are accumulated in log space via log-factorials,
 * which keeps the factorials from overflowing for large samples.
 */

export interface FisherTable {
  /** Detected / not detected in group A. */
  a: number
  b: number
  /** Detected / not detected in group B. */
  c: number
  d: number
}

export interface FisherResult {
  table: FisherTable
  /** Two-sided p-value. */
  p: number
  /** (a·d) / (b·c). Infinity when a cell in the denominator is zero. */
  oddsRatio: number
  /** Detection rate for group A, 0..1. */
  rateA: number
  /** Detection rate for group B, 0..1. */
  rateB: number
  n: number
  /** True when p < ALPHA. */
  significant: boolean
}

/** scipy uses a 1e-7 relative tolerance when comparing table probabilities. */
const REL_TOL = 1e-7

const LOG_FACTORIAL_CACHE: number[] = [0, 0]

function logFactorial(n: number): number {
  if (n < 2) return 0
  for (let i = LOG_FACTORIAL_CACHE.length; i <= n; i += 1) {
    LOG_FACTORIAL_CACHE[i] = LOG_FACTORIAL_CACHE[i - 1] + Math.log(i)
  }
  return LOG_FACTORIAL_CACHE[n]
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k)
}

/**
 * Log probability of observing cell `a` given fixed margins — the hypergeometric density.
 * Equivalent to choose(r1,a)·choose(r2,c1-a) / choose(n,c1).
 */
function logHypergeometric(a: number, rowOne: number, colOne: number, total: number): number {
  return (
    logChoose(rowOne, a) + logChoose(total - rowOne, colOne - a) - logChoose(total, colOne)
  )
}

export function fisherExact(table: FisherTable, alpha = 0.05): FisherResult | null {
  const { a, b, c, d } = table

  const rowOne = a + b
  const rowTwo = c + d
  const colOne = a + c
  const total = rowOne + rowTwo

  if (total === 0) return null

  const observed = logHypergeometric(a, rowOne, colOne, total)
  if (!Number.isFinite(observed)) return null

  // Feasible range of `a` given the fixed margins.
  const lower = Math.max(0, colOne - rowTwo)
  const upper = Math.min(rowOne, colOne)
  // log(1 + REL_TOL) ≈ REL_TOL — tables within this of the observed one are included.
  const threshold = observed + REL_TOL

  let p = 0
  for (let candidate = lower; candidate <= upper; candidate += 1) {
    const logP = logHypergeometric(candidate, rowOne, colOne, total)
    if (logP <= threshold) p += Math.exp(logP)
  }

  const denominator = b * c
  const oddsRatio = denominator === 0 ? Number.POSITIVE_INFINITY : (a * d) / denominator

  return {
    table,
    p: Math.min(1, Math.max(0, p)),
    oddsRatio,
    rateA: rowOne > 0 ? a / rowOne : 0,
    rateB: rowTwo > 0 ? c / rowTwo : 0,
    n: total,
    significant: p < alpha,
  }
}

/** Builds the table from two groups' detected/missed counts. */
export function fisherFromCounts(
  detectedA: number,
  totalA: number,
  detectedB: number,
  totalB: number,
  alpha = 0.05,
): FisherResult | null {
  return fisherExact(
    {
      a: detectedA,
      b: totalA - detectedA,
      c: detectedB,
      d: totalB - detectedB,
    },
    alpha,
  )
}

export function formatOddsRatio(oddsRatio: number): string {
  if (!Number.isFinite(oddsRatio)) return '∞'
  if (oddsRatio === 0) return '0.00'
  if (oddsRatio >= 100) return oddsRatio.toFixed(0)
  return oddsRatio.toFixed(2)
}
