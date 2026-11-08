/**
 * `ma_convert` — effect-size conversions with named formulas.
 * @module dsh-meta-analysis/tools/ma-convert
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { convert } from '../effects.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    result: { type: 'json' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * Build the `ma_convert` tool.
 * @returns the tool definition.
 */
export function makeMaConvertTool() {
  return defineTool({
    name: 'ma_convert',
    description: [
      'Convert effect sizes for meta-analysis (dsh-meta-analysis).',
      '',
      'Supported: OR⇄logOR, RR⇄logRR (with SE from a CI), d⇄r (equal groups), d⇄OR (logistic approximation), SMD from two means, and SE from a confidence interval. Every result names the formula and any approximation it relies on.',
    ].join('\n'),
    parameters: {
      conversion: {
        type: 'string',
        required: true,
        enum: ['or-to-logor', 'logor-to-or', 'rr-to-logr', 'logrr-to-rr', 'd-to-r', 'r-to-d', 'd-to-or', 'or-to-d', 'smd-from-means', 'ci-to-se'],
        description: 'Conversion name.',
      },
      value: { type: 'number', description: 'Input value (OR/RR/d/r/log value).' },
      low: { type: 'number', description: 'CI lower bound (input scale).' },
      high: { type: 'number', description: 'CI upper bound (input scale).' },
      level: { type: 'number', description: 'Confidence level for CI-derived SE (default 0.95).' },
      mean1: { type: 'number' },
      sd1: { type: 'number' },
      n1: { type: 'number' },
      mean2: { type: 'number' },
      sd2: { type: 'number' },
      n2: { type: 'number' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; result: { value: number; se?: number; formula: string } } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `ma_convert failed (${result.error.code}): ${result.error.message}` }]
        return [{ type: 'text', text: `ma_convert: ${result.result.value}${result.result.se === undefined ? '' : ` (SE ${result.result.se})`} via ${result.result.formula}` }]
      },
    },
    async execute(args: unknown) {
      const request = args as Parameters<typeof convert>[0]
      try {
        return { ok: true as const, result: convert(request) as never }
      } catch (error) {
        if (error instanceof RangeError) return { ok: false as const, error: { code: 'INVALID_INPUT', message: error.message } }
        throw error
      }
    },
  })
}
