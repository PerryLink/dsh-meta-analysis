/**
 * `ma_pool` — inverse-variance pooling.
 * @module dsh-meta-analysis/tools/ma-pool
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { pool, type PoolResult, type StudyInput } from '../pool.ts'
import type { ResolvedConfig } from '../config.ts'
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
 * Build the `ma_pool` tool.
 * @param config - resolved plugin config.
 * @returns the tool definition.
 */
export function makeMaPoolTool(config: ResolvedConfig) {
  return defineTool({
    name: 'ma_pool',
    description: [
      'Pool effect sizes with inverse-variance weights (dsh-meta-analysis).',
      '',
      'Computes fixed-effect and DerSimonian–Laird random-effects estimates with confidence intervals at the requested level (default 95%), Q/df/p, I² and τ². Every study needs an effect plus either an SE or a symmetric CI on the same scale (log OR/RR, Cohen\'s d, r …). Egger runs only when k ≥ 10 and is labelled a screening aid.',
      '',
      'The arithmetic is reproducible from the inputs; it cannot correct a biased study set or a wrong effect scale.',
    ].join('\n'),
    parameters: {
      studies: { type: 'json', required: true, description: '[{label, effect, se?, ciLow?, ciHigh?}] on one analysis scale.' },
      model: { type: 'string', enum: ['fixed', 'random', 'both'], description: 'Pooling model (default from config).' },
      level: { type: 'number', description: 'Confidence level (default 0.95).' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; result: PoolResult } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `ma_pool failed (${result.error.code}): ${result.error.message}` }]
        const pooled = result.result.random ?? result.result.fixed
        return [
          {
            type: 'text',
            text: `ma_pool: k=${result.result.k}, pooled ${pooled === undefined ? 'n/a' : `${pooled.effect.toFixed(3)} (${pooled.ciLow.toFixed(3)}…${pooled.ciHigh.toFixed(3)})`}, I²=${(result.result.I2 * 100).toFixed(1)}%, τ²=${result.result.tau2.toFixed(3)}`,
          },
        ]
      },
    },
    async execute(args: unknown) {
      const request = args as { studies?: StudyInput[]; model?: 'fixed' | 'random' | 'both'; level?: number }
      try {
        const result = pool(request.studies ?? [], { model: request.model ?? config.model, level: request.level ?? config.level })
        return { ok: true as const, result: result as never }
      } catch (error) {
        if (error instanceof RangeError) return { ok: false as const, error: { code: 'INVALID_INPUT', message: error.message } }
        throw error
      }
    },
  })
}
