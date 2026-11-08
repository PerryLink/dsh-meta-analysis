/**
 * Effect-size conversions used by `ma_convert`.
 *
 * The formulas are textbook ones and are named in the output, so a reader can
 * check them:
 * - OR/RR ⇄ log scale; SE from a CI on the analysis scale
 * - Cohen's d ⇄ r (equal groups): r = d / √(d² + 4)
 * - d ⇄ OR (logistic approximation): OR = exp(d·π/√3)
 * - SMD from two means: d = (m1 − m2)/s_pooled with the Hedges-style SE
 *
 * Conversions are lossy (the d⇄OR link assumes a logistic model); every result
 * carries the formula name.
 *
 * @module dsh-meta-analysis/effects
 */

import { normalQuantile } from './math.ts'

/** Supported conversion names. */
export type Conversion =
  | 'or-to-logor'
  | 'logor-to-or'
  | 'rr-to-logr'
  | 'logrr-to-rr'
  | 'd-to-r'
  | 'r-to-d'
  | 'd-to-or'
  | 'or-to-d'
  | 'smd-from-means'
  | 'ci-to-se'

/** Conversion request. */
export interface ConvertRequest {
  readonly conversion: Conversion
  /** Input value (interpretation depends on the conversion). */
  readonly value?: number
  /** Optional CI on the input scale (used by or/rr/ci-to-se). */
  readonly low?: number
  readonly high?: number
  /** Confidence level for CI-derived SE (default 0.95). */
  readonly level?: number
  /** Mean/SD/n for smd-from-means. */
  readonly mean1?: number
  readonly sd1?: number
  readonly n1?: number
  readonly mean2?: number
  readonly sd2?: number
  readonly n2?: number
}

/** Conversion result. */
export interface ConvertResult {
  readonly conversion: Conversion
  readonly value: number
  readonly se?: number
  readonly formula: string
  readonly notes: readonly string[]
}

/** Throw a range error with a stable message. */
function assertFinite(name: string, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`)
  return value
}

/** SE from a two-sided CI on the analysis scale. */
export function seFromCi(low: number, high: number, level = 0.95): number {
  if (!Number.isFinite(low) || !Number.isFinite(high)) throw new RangeError('low and high must be finite numbers')
  if (typeof level !== 'number' || !Number.isFinite(level) || !(level > 0 && level < 1)) throw new RangeError('level must be between 0 and 1')
  if (!(high > low)) throw new RangeError('high must be greater than low')
  const z = normalQuantile(1 - (1 - level) / 2)
  return (high - low) / (2 * z)
}

/**
 * Convert one effect size.
 * @param request - conversion and inputs.
 * @returns the converted value, optional SE and the formula used.
 */
export function convert(request: ConvertRequest): ConvertResult {
  const level = request.level ?? 0.95
  const notes: string[] = []
  switch (request.conversion) {
    case 'or-to-logor': {
      const or = assertFinite('value', request.value)
      if (or <= 0) throw new RangeError('an odds ratio must be positive')
      const result: ConvertResult = { conversion: request.conversion, value: Math.log(or), formula: 'log(OR)', notes }
      if (request.low !== undefined && request.high !== undefined) {
        if (request.low <= 0 || request.high <= 0) throw new RangeError('CI bounds for an OR must be positive')
        return { ...result, se: seFromCi(Math.log(request.low), Math.log(request.high), level), notes: [...notes, 'SE from log CI'] }
      }
      return result
    }
    case 'logor-to-or':
      return { conversion: request.conversion, value: Math.exp(assertFinite('value', request.value)), formula: 'exp(logOR)', notes }
    case 'rr-to-logr': {
      const rr = assertFinite('value', request.value)
      if (rr <= 0) throw new RangeError('a risk ratio must be positive')
      const result: ConvertResult = { conversion: request.conversion, value: Math.log(rr), formula: 'log(RR)', notes }
      if (request.low !== undefined && request.high !== undefined) {
        if (request.low <= 0 || request.high <= 0) throw new RangeError('CI bounds for an RR must be positive')
        return { ...result, se: seFromCi(Math.log(request.low), Math.log(request.high), level), notes: [...notes, 'SE from log CI'] }
      }
      return result
    }
    case 'logrr-to-rr':
      return { conversion: request.conversion, value: Math.exp(assertFinite('value', request.value)), formula: 'exp(logRR)', notes }
    case 'd-to-r': {
      const d = assertFinite('value', request.value)
      return { conversion: request.conversion, value: d / Math.sqrt(d * d + 4), formula: 'r = d/√(d²+4)', notes: [...notes, 'assumes two equal-sized groups'] }
    }
    case 'r-to-d': {
      const r = assertFinite('value', request.value)
      if (Math.abs(r) >= 1) throw new RangeError('|r| must be below 1')
      return { conversion: request.conversion, value: (2 * r) / Math.sqrt(1 - r * r), formula: 'd = 2r/√(1−r²)', notes: [...notes, 'assumes two equal-sized groups'] }
    }
    case 'd-to-or': {
      const d = assertFinite('value', request.value)
      return { conversion: request.conversion, value: Math.exp((d * Math.PI) / Math.sqrt(3)), formula: 'OR = exp(d·π/√3)', notes: [...notes, 'logistic approximation; exact only under a logistic model'] }
    }
    case 'or-to-d': {
      const or = assertFinite('value', request.value)
      if (or <= 0) throw new RangeError('an odds ratio must be positive')
      return { conversion: request.conversion, value: (Math.log(or) * Math.sqrt(3)) / Math.PI, formula: 'd = log(OR)·√3/π', notes: [...notes, 'logistic approximation; exact only under a logistic model'] }
    }
    case 'smd-from-means': {
      const mean1 = assertFinite('mean1', request.mean1)
      const mean2 = assertFinite('mean2', request.mean2)
      const sd1 = assertFinite('sd1', request.sd1)
      const sd2 = assertFinite('sd2', request.sd2)
      const n1 = assertFinite('n1', request.n1)
      const n2 = assertFinite('n2', request.n2)
      if (sd1 <= 0 || sd2 <= 0) throw new RangeError('standard deviations must be positive')
      if (n1 < 2 || n2 < 2) throw new RangeError('each group needs at least two observations')
      const pooledSd = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2))
      const d = (mean1 - mean2) / pooledSd
      const se = Math.sqrt(1 / n1 + 1 / n2 + (d * d) / (2 * (n1 + n2)))
      return { conversion: request.conversion, value: d, se, formula: 'd = (m1−m2)/s_pooled', notes: ['SE = √(1/n1 + 1/n2 + d²/(2(n1+n2)))'] }
    }
    case 'ci-to-se': {
      const low = assertFinite('low', request.low)
      const high = assertFinite('high', request.high)
      return { conversion: request.conversion, value: (low + high) / 2, se: seFromCi(low, high, level), formula: 'SE = (high−low)/(2·z)', notes }
    }
    default:
      throw new RangeError(`unknown conversion: ${String((request as { conversion?: unknown }).conversion)}`)
  }
}
