/**
 * `ma_report` — forest data + Markdown + SARIF.
 * @module dsh-meta-analysis/tools/ma-report
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { PooledEstimate, PoolResult, StudyResult } from '../pool.ts'
import { forestData, renderPoolMarkdown, renderPoolSarif } from '../report.ts'
import { VERSION } from '../version.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    forest: { type: 'json' },
    markdown: { type: 'string' },
    sarif: { type: 'json' },
    error: ERROR_SCHEMA,
  },
} as const

/** True for a finite number. */
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** True for an object with finite estimate fields. */
function isEstimate(value: unknown): value is PooledEstimate {
  if (typeof value !== 'object' || value === null) return false
  const estimate = value as Partial<PooledEstimate>
  return finite(estimate.effect) && finite(estimate.se) && finite(estimate.ciLow) && finite(estimate.ciHigh) && finite(estimate.z) && finite(estimate.p)
}

/** True for one study row with everything the renderer reads. */
function isStudy(value: unknown): value is StudyResult {
  if (typeof value !== 'object' || value === null) return false
  const study = value as Partial<StudyResult>
  return typeof study.label === 'string' && finite(study.effect) && finite(study.se) && finite(study.ciLow) && finite(study.ciHigh) && finite(study.weightFixedPct)
}

/**
 * Validate a value passed back from `ma_pool`. The result crosses a JSON
 * boundary, so nothing about its shape is guaranteed by the type system.
 */
function isPoolResult(value: unknown): value is PoolResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<PoolResult>
  if (result.model !== 'fixed' && result.model !== 'random' && result.model !== 'both') return false
  if (!finite(result.k) || !finite(result.Q) || !finite(result.df) || !finite(result.pQ) || !finite(result.I2) || !finite(result.tau2)) return false
  if (!Array.isArray(result.studies) || result.studies.length < 2 || !result.studies.every(isStudy)) return false
  if (!Array.isArray(result.warnings) || !result.warnings.every(warning => typeof warning === 'string')) return false
  if (result.fixed !== undefined && !isEstimate(result.fixed)) return false
  if (result.random !== undefined && !isEstimate(result.random)) return false
  if (result.model !== 'random' && result.fixed === undefined) return false
  if (result.model !== 'fixed' && result.random === undefined) return false
  return true
}

/**
 * Build the `ma_report` tool.
 * @returns the tool definition.
 */
export function makeMaReportTool() {
  return defineTool({
    name: 'ma_report',
    description: [
      'Render a meta-analysis result as forest-plot data, Markdown and SARIF 2.1.0 (dsh-meta-analysis).',
      '',
      'The forest data is renderer-agnostic (rows with effect, CI and weight percentage plus the pooled row), so the host can draw it; the Markdown report includes the pooled estimates, heterogeneity, Egger and every warning. The confidence level is the one recorded in the ma_pool result.',
    ].join('\n'),
    parameters: {
      result: { type: 'json', required: true, description: 'The `result` from ma_pool.' },
      measure: { type: 'string', description: 'Effect measure label (e.g. "log OR").' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; markdown: string } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `ma_report failed (${result.error.code}): ${result.error.message}` }]
        return [{ type: 'text', text: result.markdown }]
      },
    },
    async execute(args: unknown) {
      const request = args as { result?: unknown; measure?: string }
      if (!isPoolResult(request.result)) {
        return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'pass the result object from ma_pool' } }
      }
      if (request.measure !== undefined && typeof request.measure !== 'string') {
        return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'measure must be a string' } }
      }
      const measure = request.measure ?? 'effect'
      return {
        ok: true as const,
        forest: forestData(request.result, measure) as never,
        markdown: renderPoolMarkdown(request.result, measure),
        sarif: renderPoolSarif(request.result, VERSION) as never,
      }
    },
  })
}
