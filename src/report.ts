/**
 * Forest-plot data, Markdown and SARIF for meta-analysis results.
 * @module dsh-meta-analysis/report
 */

import type { PoolResult } from './pool.ts'

/** One forest row. */
export interface ForestRow {
  readonly label: string
  readonly effect: number
  readonly ciLow: number
  readonly ciHigh: number
  readonly weightPct: number
}

/** Forest-plot data (renderer-agnostic). */
export interface ForestData {
  readonly measure: string
  readonly rows: readonly ForestRow[]
  readonly pooled: { readonly effect: number; readonly ciLow: number; readonly ciHigh: number }
  readonly model: 'fixed' | 'random'
}

/** Format a number with three decimals. */
function f(value: number): string {
  return Number(value.toFixed(3)).toString()
}

/**
 * Build forest-plot data.
 * @param result - pooling result.
 * @param measure - effect measure label (e.g. "log OR").
 * @returns rows plus the pooled estimate.
 */
export function forestData(result: PoolResult, measure = 'effect'): ForestData {
  const useRandom = result.model !== 'fixed' && result.random !== undefined
  const pooled = useRandom ? result.random! : result.fixed!
  return {
    measure,
    model: useRandom ? 'random' : 'fixed',
    rows: result.studies.map(study => ({
      label: study.label,
      effect: study.effect,
      ciLow: study.ciLow,
      ciHigh: study.ciHigh,
      weightPct: useRandom ? (study.weightRandomPct ?? study.weightFixedPct) : study.weightFixedPct,
    })),
    pooled: { effect: pooled.effect, ciLow: pooled.ciLow, ciHigh: pooled.ciHigh },
  }
}

/**
 * Render a pooling result as Markdown.
 * @param result - pooling result.
 * @param measure - effect measure label.
 * @returns Markdown text.
 */
export function renderPoolMarkdown(result: PoolResult, measure = 'effect'): string {
  const lines = ['# Meta-analysis', '']
  lines.push(`**Studies:** ${result.k} · **Model:** ${result.model} · **Measure:** ${measure}`)
  lines.push('')
  lines.push('| Model | Pooled | 95% CI | z | p |')
  lines.push('|---|---:|---|---:|---:|')
  if (result.fixed !== undefined) lines.push(`| fixed | ${f(result.fixed.effect)} | ${f(result.fixed.ciLow)} … ${f(result.fixed.ciHigh)} | ${f(result.fixed.z)} | ${f(result.fixed.p)} |`)
  if (result.random !== undefined) lines.push(`| random | ${f(result.random.effect)} | ${f(result.random.ciLow)} … ${f(result.random.ciHigh)} | ${f(result.random.z)} | ${f(result.random.p)} |`)
  lines.push('')
  lines.push(`**Heterogeneity:** Q = ${f(result.Q)} (df ${result.df}, p = ${f(result.pQ)}), I² = ${(result.I2 * 100).toFixed(1)}%, τ² = ${f(result.tau2)}`)
  if (result.egger !== undefined) lines.push(`**Egger:** intercept ${f(result.egger.intercept)} (SE ${f(result.egger.se)}, t ${f(result.egger.t)}, p ${f(result.egger.p)}, df ${result.egger.df})`)
  lines.push('')
  lines.push('## Studies')
  lines.push('')
  lines.push('| Study | Effect | 95% CI | Weight |')
  lines.push('|---|---:|---|---:|')
  for (const study of result.studies) lines.push(`| ${study.label} | ${f(study.effect)} | ${f(study.ciLow)} … ${f(study.ciHigh)} | ${(study.weightFixedPct).toFixed(1)}% |`)
  lines.push('')
  if (result.warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const warning of result.warnings) lines.push(`- ${warning}`)
    lines.push('')
  }
  lines.push('> Pooling is arithmetic on the numbers you supplied; it cannot fix a biased sample of studies or a wrong effect scale.')
  return `${lines.join('\n')}\n`
}

/**
 * Render a pooling result as SARIF 2.1.0 (warnings only).
 * @param result - pooling result.
 * @param version - plugin version.
 * @returns SARIF log.
 */
export function renderPoolSarif(result: PoolResult, version: string): Record<string, unknown> {
  const results = result.warnings.map((warning, index) => ({
    ruleId: `meta-analysis/warning-${index + 1}`,
    level: 'warning' as const,
    message: { text: warning },
  }))
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{ tool: { driver: { name: 'dsh-meta-analysis', version } }, results }],
  }
}
