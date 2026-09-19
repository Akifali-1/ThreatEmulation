/**
 * Mann-Whitney U test (Wilcoxon rank-sum).
 *
 * Non-parametric, so it makes no normality assumption about time-to-detect — appropriate for
 * the small, skewed samples this project produces. Uses the normal approximation with a
 * tie correction and a continuity correction, which is what the Python side reports.
 */

/** Standard significance level used throughout the UI. */
export const ALPHA = 0.05

export interface MannWhitneyResult {
  /** Test statistic U (the smaller of U1/U2). */
  u: number
  u1: number
  u2: number
  z: number
  /** Two-tailed p-value. */
  p: number
  /** Rank-biserial correlation, in [-1, 1]. Sign follows group A vs group B. */
  rankBiserial: number
  n1: number
  n2: number
  significant: boolean
}

/** Abramowitz & Stegun 7.1.26 — max absolute error 1.5e-7, far below display precision. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - poly * Math.exp(-ax * ax))
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Average ranks for tied values, plus the tie-correction term Σ(t³ − t). */
function rank(values: number[]): { ranks: number[]; tieCorrection: number } {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const out = new Array<number>(values.length)
  let tieCorrection = 0
  let i = 0

  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1

    // Ranks are 1-based; ties share the average of the positions they span.
    const averageRank = (i + j) / 2 + 1
    const count = j - i + 1
    if (count > 1) tieCorrection += count ** 3 - count
    for (let k = i; k <= j; k += 1) out[indexed[k].index] = averageRank

    i = j + 1
  }

  return { ranks: out, tieCorrection }
}

/**
 * Returns null when either sample is empty — the caller should render "insufficient data"
 * rather than a fabricated statistic.
 */
export function mannWhitneyU(a: number[], b: number[]): MannWhitneyResult | null {
  const n1 = a.length
  const n2 = b.length
  if (n1 === 0 || n2 === 0) return null

  const n = n1 + n2
  const { ranks, tieCorrection } = rank([...a, ...b])

  const rankSumA = ranks.slice(0, n1).reduce((sum, value) => sum + value, 0)
  const u1 = rankSumA - (n1 * (n1 + 1)) / 2
  const u2 = n1 * n2 - u1
  const u = Math.min(u1, u2)

  const mu = (n1 * n2) / 2
  const tieTerm = n > 1 ? tieCorrection / (n * (n - 1)) : 0
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tieTerm))

  let z = 0
  let p = 1

  if (sigma > 0) {
    // Continuity correction: nudge toward the mean before standardising.
    const diff = u - mu
    const corrected = Math.max(0, Math.abs(diff) - 0.5)
    z = (Math.sign(diff) || -1) * (corrected / sigma)
    p = 2 * (1 - normalCdf(Math.abs(z)))
  }

  // Rank-biserial effect size: 0 = no separation, ±1 = complete separation.
  const rankBiserial = 1 - (2 * u) / (n1 * n2)

  return {
    u,
    u1,
    u2,
    z,
    p: Math.min(1, Math.max(0, p)),
    rankBiserial,
    n1,
    n2,
    significant: p < ALPHA,
  }
}

export type EffectMagnitude = 'negligible' | 'small' | 'moderate' | 'large'

/** Conventional thresholds for |rank-biserial|, stated so the UI can label the effect size. */
export function effectMagnitude(rankBiserial: number): EffectMagnitude {
  const magnitude = Math.abs(rankBiserial)
  if (magnitude < 0.1) return 'negligible'
  if (magnitude < 0.3) return 'small'
  if (magnitude < 0.5) return 'moderate'
  return 'large'
}

export function formatP(p: number): string {
  if (Number.isNaN(p)) return '—'
  if (p < 0.001) return 'p < 0.001'
  return `p = ${p.toFixed(3)}`
}
