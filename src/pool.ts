/**
 * Fixed-effect and random-effects pooling (inverse variance), heterogeneity and
 * a light Egger test.
 *
 * - Fixed: w = 1/v, θ = Σwθ/Σw, SE = 1/√Σw.
 * - Random: DerSimonian–Laird τ², w* = 1/(v+τ²).
 * - Q = Σw_i(θ_i−θ_FE)²; I² = max(0, (Q−df)/Q).
 * - Egger (k ≥ 10 only): OLS of θ_i/SE_i on 1/SE_i; the intercept tests
 *   small-study effects. It is a screening aid, not proof of reporting bias.
 *
 * @module dsh-meta-analysis/pool
 */

import { chiSquareCdf, normalQuantile, tTwoSidedP, zTwoSidedP } from './math.ts'

/** One study on the analysis scale (log OR/RR, d, r, mean difference …). */
export interface StudyInput {
  readonly label: string
  /** Effect on the analysis scale. */
  readonly effect: number
  /** Standard error; either this or a symmetric CI is required. */
  readonly se?: number
  /** CI on the analysis scale (e.g. log OR bounds). */
  readonly ciLow?: number
  readonly ciHigh?: number
}

/** Pooling model. */
export type PoolModel = 'fixed' | 'random' | 'both'

/** Pooled estimate. */
export interface PooledEstimate {
  readonly effect: number
  readonly se: number
  readonly ciLow: number
  readonly ciHigh: number
  readonly z: number
  readonly p: number
}

/** Per-study result. */
export interface StudyResult {
  readonly label: string
  readonly effect: number
  readonly se: number
  readonly variance: number
  readonly ciLow: number
  readonly ciHigh: number
  readonly weightFixed: number
  readonly weightFixedPct: number
  readonly weightRandom?: number
  readonly weightRandomPct?: number
}

/** Egger test result. */
export interface EggerResult {
  readonly intercept: number
  readonly se: number
  readonly t: number
  readonly p: number
  readonly df: number
}

/** Pooling result. */
export interface PoolResult {
  readonly k: number
  readonly model: PoolModel
  /** Confidence level used for every reported interval. */
  readonly level: number
  readonly fixed?: PooledEstimate
  readonly random?: PooledEstimate
  readonly Q: number
  readonly df: number
  readonly pQ: number
  readonly I2: number
  readonly tau2: number
  readonly egger?: EggerResult
  readonly studies: readonly StudyResult[]
  readonly warnings: readonly string[]
}

/** Options for {@link pool}. */
export interface PoolOptions {
  readonly model?: PoolModel
  /** Confidence level for the pooled CI (default 0.95). */
  readonly level?: number
}

/** Validate one study and resolve its SE at the pooling confidence level. */
function resolveStudy(study: StudyInput, zCritical: number): { se: number; variance: number } {
  if (typeof study !== 'object' || study === null) throw new RangeError('every study must be an object')
  if (typeof study.label !== 'string' || study.label.trim() === '') throw new RangeError('every study needs a label')
  if (typeof study.effect !== 'number' || !Number.isFinite(study.effect)) throw new RangeError(`study "${study.label}": effect must be finite`)
  if (study.ciLow !== undefined && (typeof study.ciLow !== 'number' || !Number.isFinite(study.ciLow))) throw new RangeError(`study "${study.label}": ciLow must be a finite number`)
  if (study.ciHigh !== undefined && (typeof study.ciHigh !== 'number' || !Number.isFinite(study.ciHigh))) throw new RangeError(`study "${study.label}": ciHigh must be a finite number`)
  /** The interval must describe this effect on the analysis scale. */
  const assertCentred = (): void => {
    if (study.ciLow === undefined || study.ciHigh === undefined) return
    const midpoint = (study.ciLow + study.ciHigh) / 2
    if (Math.abs(midpoint - study.effect) > Math.max(1e-6, Math.abs(study.effect) * 1e-3)) {
      throw new RangeError(`study "${study.label}": the CI is not centred on the effect (the CI must be on the analysis scale)`)
    }
  }
  let se: number
  if (study.se !== undefined) {
    if (typeof study.se !== 'number' || !Number.isFinite(study.se) || study.se <= 0) throw new RangeError(`study "${study.label}": SE must be positive`)
    se = study.se
    if (study.ciLow !== undefined && study.ciHigh !== undefined) {
      const widthSe = (study.ciHigh - study.ciLow) / (2 * zCritical)
      if (Math.abs(widthSe - se) > Math.max(1e-6, se * 0.05)) {
        throw new RangeError(`study "${study.label}": the CI and SE disagree by more than 5%`)
      }
      assertCentred()
    }
  } else if (study.ciLow !== undefined && study.ciHigh !== undefined) {
    if (!(study.ciHigh > study.ciLow)) throw new RangeError(`study "${study.label}": CI must have high > low`)
    assertCentred()
    se = (study.ciHigh - study.ciLow) / (2 * zCritical)
  } else {
    throw new RangeError(`study "${study.label}": provide se or a symmetric ciLow/ciHigh`)
  }
  return { se, variance: se * se }
}

/** OLS Egger test. */
function egger(studies: readonly StudyResult[]): EggerResult {
  const points = studies.map(study => ({ x: 1 / study.se, y: study.effect / study.se }))
  const n = points.length
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / n
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / n
  let sxx = 0
  let sxy = 0
  for (const point of points) {
    sxx += (point.x - meanX) ** 2
    sxy += (point.x - meanX) * (point.y - meanY)
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = meanY - slope * meanX
  let sse = 0
  for (const point of points) sse += (point.y - (intercept + slope * point.x)) ** 2
  const residual = Math.sqrt(sse / (n - 2))
  const se = residual * Math.sqrt(1 / n + (meanX * meanX) / sxx)
  const t = se === 0 ? 0 : intercept / se
  return { intercept, se, t, p: tTwoSidedP(t, n - 2), df: n - 2 }
}

/**
 * Pool studies with inverse-variance weights.
 * @param studies - at least two studies.
 * @param options - model and confidence level.
 * @returns pooled estimates, heterogeneity, weights and warnings.
 */
export function pool(studies: readonly StudyInput[], options: PoolOptions = {}): PoolResult {
  if (!Array.isArray(studies) || studies.length < 2) throw new RangeError('pooling needs at least two studies')
  const model = options.model ?? 'both'
  if (!['fixed', 'random', 'both'].includes(model)) throw new RangeError('model must be fixed, random or both')
  const level = options.level ?? 0.95
  if (typeof level !== 'number' || !Number.isFinite(level) || !(level > 0 && level < 1)) throw new RangeError('level must be between 0 and 1')
  const zCritical = normalQuantile(1 - (1 - level) / 2)
  const resolved = studies.map(study => ({ study, ...resolveStudy(study, zCritical) }))

  const warnings: string[] = []
  const weightsFixed = resolved.map(entry => 1 / entry.variance)
  const sumW = weightsFixed.reduce((sum, weight) => sum + weight, 0)
  const sumW2 = weightsFixed.reduce((sum, weight) => sum + weight * weight, 0)
  const fixedEffect = resolved.reduce((sum, entry, index) => sum + weightsFixed[index]! * entry.study.effect, 0) / sumW
  const fixedSe = Math.sqrt(1 / sumW)
  const fixed: PooledEstimate = {
    effect: fixedEffect,
    se: fixedSe,
    ciLow: fixedEffect - zCritical * fixedSe,
    ciHigh: fixedEffect + zCritical * fixedSe,
    z: fixedEffect / fixedSe,
    p: zTwoSidedP(fixedEffect / fixedSe),
  }

  let Q = 0
  for (let index = 0; index < resolved.length; index += 1) {
    Q += weightsFixed[index]! * (resolved[index]!.study.effect - fixedEffect) ** 2
  }
  const df = resolved.length - 1
  const pQ = 1 - chiSquareCdf(Q, df)
  const I2 = Q === 0 ? 0 : Math.max(0, (Q - df) / Q)
  const tau2 = Math.max(0, (Q - df) / (sumW - sumW2 / sumW))

  const weightsRandom = resolved.map(entry => 1 / (entry.variance + tau2))
  const sumWR = weightsRandom.reduce((sum, weight) => sum + weight, 0)
  const randomEffect = resolved.reduce((sum, entry, index) => sum + weightsRandom[index]! * entry.study.effect, 0) / sumWR
  const randomSe = Math.sqrt(1 / sumWR)
  const random: PooledEstimate = {
    effect: randomEffect,
    se: randomSe,
    ciLow: randomEffect - zCritical * randomSe,
    ciHigh: randomEffect + zCritical * randomSe,
    z: randomEffect / randomSe,
    p: zTwoSidedP(randomEffect / randomSe),
  }

  const studyResults: StudyResult[] = resolved.map((entry, index) => ({
    label: entry.study.label,
    effect: entry.study.effect,
    se: entry.se,
    variance: entry.variance,
    ciLow: entry.study.effect - zCritical * entry.se,
    ciHigh: entry.study.effect + zCritical * entry.se,
    weightFixed: weightsFixed[index]!,
    weightFixedPct: (weightsFixed[index]! / sumW) * 100,
    weightRandom: weightsRandom[index]!,
    weightRandomPct: (weightsRandom[index]! / sumWR) * 100,
  }))

  if (resolved.length < 3) warnings.push('fewer than three studies: heterogeneity and Egger are uninformative')
  if (resolved.length >= 3 && pQ < 0.10) warnings.push('Q is significant at the 10% level; the fixed-effect model assumes homogeneity that the data do not support')
  if (tau2 > 0 && resolved.length < 5) warnings.push('τ² is estimated from few studies; random-effects weights are unstable')
  if (I2 >= 0.75) warnings.push('I² ≥ 75%: consider subgroup or sensitivity analysis before pooling')

  const result: PoolResult = {
    k: resolved.length,
    model,
    level,
    ...(model === 'random' ? {} : { fixed }),
    ...(model === 'fixed' ? {} : { random }),
    Q,
    df,
    pQ,
    I2,
    tau2,
    studies: studyResults,
    warnings,
  }
  if (resolved.length >= 10) {
    const test = egger(studyResults)
    return { ...result, egger: test, warnings: [...warnings, 'Egger intercept is a screening aid for small-study effects, not proof of reporting bias'] }
  }
  return { ...result, warnings: [...warnings, `Egger was not run: k = ${resolved.length} < 10`] }
}
