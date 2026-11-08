/**
 * Special functions, conversions, pooling and heterogeneity.
 * @module test/meta.spec
 */

import { describe, expect, it } from 'vitest'
import { convert } from '../src/effects.ts'
import { chiSquareCdf, normalQuantile, tTwoSidedP, zTwoSidedP } from '../src/math.ts'
import { pool } from '../src/pool.ts'

describe('special functions', () => {
  it('computes the chi-square CDF', () => {
    expect(chiSquareCdf(8, 2)).toBeCloseTo(0.981684, 5)
    expect(chiSquareCdf(0, 2)).toBe(0)
  })

  it('computes t and normal two-sided p-values', () => {
    expect(tTwoSidedP(2.306004, 8)).toBeCloseTo(0.05, 4)
    expect(zTwoSidedP(1.959964)).toBeCloseTo(0.05, 4)
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5)
  })
})

describe('conversions', () => {
  it('converts OR to logOR and derives SE from the CI', () => {
    const result = convert({ conversion: 'or-to-logor', value: 2, low: 1.5, high: 2.67 })
    expect(result.value).toBeCloseTo(0.693147, 5)
    expect(result.se).toBeCloseTo((Math.log(2.67) - Math.log(1.5)) / (2 * 1.959964), 5)
    expect(result.formula).toBe('log(OR)')
  })

  it('round-trips d and r', () => {
    const r = convert({ conversion: 'd-to-r', value: 0.5 })
    expect(r.value).toBeCloseTo(0.242536, 5)
    const d = convert({ conversion: 'r-to-d', value: r.value })
    expect(d.value).toBeCloseTo(0.5, 6)
  })

  it('round-trips d and OR through the logistic approximation', () => {
    const or = convert({ conversion: 'd-to-or', value: 0.5 })
    expect(or.value).toBeCloseTo(Math.exp((0.5 * Math.PI) / Math.sqrt(3)), 6)
    const back = convert({ conversion: 'or-to-d', value: or.value })
    expect(back.value).toBeCloseTo(0.5, 6)
    expect(back.notes.join(' ')).toContain('logistic')
  })

  it('computes SMD from two means', () => {
    const result = convert({ conversion: 'smd-from-means', mean1: 10, sd1: 2, n1: 20, mean2: 8, sd2: 2, n2: 20 })
    expect(result.value).toBeCloseTo(1, 6)
    expect(result.se).toBeCloseTo(Math.sqrt(0.05 + 0.05 + 1 / 80), 6)
  })

  it('rejects impossible inputs', () => {
    expect(() => convert({ conversion: 'or-to-logor', value: 0 })).toThrow(RangeError)
    expect(() => convert({ conversion: 'r-to-d', value: 1 })).toThrow(RangeError)
    expect(() => convert({ conversion: 'smd-from-means', mean1: 1, sd1: 0, n1: 5, mean2: 0, sd2: 1, n2: 5 })).toThrow(RangeError)
  })
})

describe('pooling', () => {
  const studies = [
    { label: 'A', effect: 0.2, se: 0.1 },
    { label: 'B', effect: 0.4, se: 0.1 },
    { label: 'C', effect: 0.6, se: 0.1 },
  ]

  it('reproduces the hand-calculated fixed and random estimates', () => {
    const result = pool(studies)
    expect(result.k).toBe(3)
    expect(result.fixed!.effect).toBeCloseTo(0.4, 10)
    expect(result.fixed!.se).toBeCloseTo(Math.sqrt(1 / 300), 10)
    expect(result.Q).toBeCloseTo(8, 10)
    expect(result.df).toBe(2)
    expect(result.I2).toBeCloseTo(0.75, 10)
    expect(result.tau2).toBeCloseTo(0.03, 10)
    expect(result.random!.effect).toBeCloseTo(0.4, 10)
    expect(result.random!.se).toBeCloseTo(Math.sqrt(1 / 75), 10)
  })

  it('derives SE from a symmetric CI and rejects disagreement', () => {
    const fromCi = pool([
      { label: 'A', effect: 0.2, ciLow: 0.004, ciHigh: 0.396 },
      { label: 'B', effect: 0.4, ciLow: 0.204, ciHigh: 0.596 },
    ])
    expect(fromCi.fixed!.effect).toBeCloseTo(0.3, 6)
    expect(() => pool([{ label: 'A', effect: 0.2, se: 0.1, ciLow: 0, ciHigh: 1 }, { label: 'B', effect: 0.4, se: 0.1 }])).toThrow(/disagree/u)
  })

  it('runs Egger only at k >= 10', () => {
    const small = pool(studies)
    expect(small.egger).toBeUndefined()
    expect(small.warnings.join(' ')).toContain('Egger was not run')

    const many = Array.from({ length: 10 }, (_, index) => ({ label: `S${index}`, effect: 0.1 + index * 0.01, se: 0.05 + index * 0.01 }))
    const result = pool(many)
    expect(result.egger).toBeDefined()
    expect(result.egger!.df).toBe(8)
    expect(result.egger!.p).toBeGreaterThanOrEqual(0)
    expect(result.egger!.p).toBeLessThanOrEqual(1)
  })

  it('rejects invalid study sets', () => {
    expect(() => pool([{ label: 'A', effect: 0.1, se: 0.1 }])).toThrow(RangeError)
    expect(() => pool([{ label: 'A', effect: 0.1 }, { label: 'B', effect: 0.2, se: 0.1 }])).toThrow(/se or a symmetric|SE or/u)
    expect(() => pool([{ label: '', effect: 0.1, se: 0.1 }, { label: 'B', effect: 0.2, se: 0.1 }])).toThrow(RangeError)
  })

  it('warns about extreme heterogeneity', () => {
    const result = pool([
      { label: 'A', effect: -1, se: 0.05 },
      { label: 'B', effect: 0, se: 0.05 },
      { label: 'C', effect: 1, se: 0.05 },
    ])
    expect(result.I2).toBeGreaterThan(0.75)
    expect(result.warnings.join(' ')).toContain('I²')
  })
})
