/**
 * Small, dependency-free special functions for meta-analysis:
 * log-gamma, regularized lower incomplete gamma (χ² CDF), regularized
 * incomplete beta (t CDF) and a two-sided normal tail.
 *
 * Accuracy target is ~1e-10 for the gamma/beta continued fractions and ~1e-7
 * for the normal tail approximation; that is enough for pooling output, and the
 * README says which approximation is used.
 *
 * @module dsh-meta-analysis/math
 */

/** Lanczos coefficients. */
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

/** Natural log of the gamma function (Lanczos, g=7). */
export function lnGamma(value: number): number {
  if (value < 0.5) {
    // Reflection formula.
    return Math.log(Math.PI / Math.sin(Math.PI * value)) - lnGamma(1 - value)
  }
  let x = 0.99999999999980993
  const z = value - 1
  for (let index = 0; index < LANCZOS.length; index += 1) x += LANCZOS[index]! / (z + index + 1)
  const t = z + LANCZOS.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/** Regularized lower incomplete gamma P(a,x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0
  if (x < a + 1) {
    // Series.
    let sum = 1 / a
    let term = sum
    for (let n = 1; n < 500; n += 1) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  // Continued fraction for Q(a,x).
  let b = x + 1 - a
  let c = 1e300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-14) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
}

/** χ² CDF with `df` degrees of freedom. */
export function chiSquareCdf(statistic: number, df: number): number {
  if (df <= 0) return Number.NaN
  if (statistic <= 0) return 0
  return gammaP(df / 2, statistic / 2)
}

/** Continued fraction for the incomplete beta function. */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 500
  const epsilon = 1e-14
  const tiny = 1e-300
  let qab = a + b
  let qap = a + 1
  let qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return h
}

/** Regularized incomplete beta I_x(a,b). */
export function betaIncomplete(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b
}

/** Two-sided p-value for a t statistic with `df` degrees of freedom. */
export function tTwoSidedP(statistic: number, df: number): number {
  if (df <= 0 || !Number.isFinite(statistic)) return Number.NaN
  const x = df / (df + statistic * statistic)
  return betaIncomplete(x, df / 2, 0.5)
}

/** Two-sided p-value for a z statistic (normal tail, A&S 7.1.26). */
export function zTwoSidedP(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return Math.max(0, Math.min(1, 1 - erf))
}

/** Quantile of the standard normal (Acklam's rational approximation). */
export function normalQuantile(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY
  if (p >= 1) return Number.POSITIVE_INFINITY
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const low = 0.02425
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  if (p > 1 - low) return -normalQuantile(1 - p)
  const q = p - 0.5
  const r = q * q
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
}
