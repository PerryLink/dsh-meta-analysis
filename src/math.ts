/**
 * Small, dependency-free special functions for meta-analysis:
 * log-gamma, regularized lower incomplete gamma (χ² CDF), regularized
 * incomplete beta (t CDF) and a two-sided normal tail.
 *
 * Accuracy target is ~1e-10 for the gamma/beta continued fractions, ~1e-7
 * for the normal tail approximation and ~1e-16 for the normal quantile
 * (Wichura's AS 241); that is enough for pooling output, and the README says
 * which approximation is used.
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

/** AS 241 (PPND16) coefficients, lowest degree first. */
const AS241_A = [
  3.387132872796366608, 1.3314166789178437745e2, 1.9715909503065514427e3, 1.3731693765509461125e4,
  4.5921953931549871457e4, 6.7265770927008700853e4, 3.3430575583588128105e4, 2.5090809287301226727e3,
]
const AS241_B = [
  1, 4.2313330701600911252e1, 6.871870074920579083e2, 5.3941960214247511077e3,
  2.1213794301586595867e4, 3.930789580009271061e4, 2.8729085735721942674e4, 5.226495278852854561e3,
]
const AS241_C = [
  1.42343711074968357734, 4.6303378461565452959, 5.7694972214606914055, 3.64784832476320460504,
  1.27045825245236838258, 2.4178072517745061177e-1, 2.27238449892691845833e-2, 7.7454501427834140764e-4,
]
const AS241_D = [
  1, 2.05319162663775882187, 1.6763848301838038494, 6.8976733498510000455e-1,
  1.4810397642748007459e-1, 1.51986665636164571966e-2, 5.475938084995344946e-4, 1.05075007164441684324e-9,
]
const AS241_E = [
  6.6579046435011037772, 5.4637849111641143699, 1.7848265399172913358, 2.9656057182850489123e-1,
  2.6532189526576123093e-2, 1.2426609473880784386e-3, 2.71155556874348757815e-5, 2.01033439929228813265e-7,
]
const AS241_F = [
  1, 5.9983220655588793769e-1, 1.3692988092273580531e-1, 1.48753612908506148525e-2,
  7.868691311456132591e-4, 1.8463183175100546818e-5, 1.4215117583164458887e-7, 2.04426310338993978564e-15,
]

/** Horner evaluation with the coefficients ordered from lowest to highest degree. */
function horner(coefficients: readonly number[], value: number): number {
  let result = coefficients[coefficients.length - 1]!
  for (let index = coefficients.length - 2; index >= 0; index -= 1) result = result * value + coefficients[index]!
  return result
}

/** Quantile of the standard normal (Wichura's AS 241 / PPND16, ~1e-16). */
export function normalQuantile(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY
  if (p >= 1) return Number.POSITIVE_INFINITY
  const q = p - 0.5
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q
    return (q * horner(AS241_A, r)) / horner(AS241_B, r)
  }
  const tail = q < 0 ? p : 1 - p
  const r = Math.sqrt(-Math.log(tail))
  let value: number
  if (r <= 5) {
    const shifted = r - 1.6
    value = horner(AS241_C, shifted) / horner(AS241_D, shifted)
  } else {
    const shifted = r - 5
    value = horner(AS241_E, shifted) / horner(AS241_F, shifted)
  }
  return q < 0 ? -value : value
}
