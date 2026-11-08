/**
 * `ma_report` — forest data + Markdown + SARIF.
 * @module dsh-meta-analysis/tools/ma-report
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { PoolResult } from '../pool.ts'
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
      'The forest data is renderer-agnostic (rows with effect, CI and weight percentage plus the pooled row), so the host can draw it; the Markdown report includes the pooled estimates, heterogeneity, Egger and every warning.',
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
      const request = args as { result?: PoolResult; measure?: string }
      if (request.result === undefined || !Array.isArray(request.result.studies)) {
        return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'pass the result object from ma_pool' } }
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
