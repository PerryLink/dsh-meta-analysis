/**
 * `dsh-meta-analysis` — effect-size conversion, inverse-variance pooling,
 * heterogeneity, forest-plot data and a light Egger test.
 *
 * Three tools: ma_pool, ma_convert, ma_report. Local arithmetic; no network.
 *
 * Function plugin — no default export.
 * @module dsh-meta-analysis
 */

import type { Context } from '@deepseek-ai/cordis'
import { Config, resolveConfig, type Config as ConfigShape } from './config.ts'
import { makeMaConvertTool } from './tools/ma-convert.ts'
import { makeMaPoolTool } from './tools/ma-pool.ts'
import { makeMaReportTool } from './tools/ma-report.ts'

/** Cordis plugin name. */
export const name = 'meta-analysis'

/** The tool registry is required. */
export const inject = ['tools']

export { Config, resolveConfig }
export type { ConfigShape }
export type { ResolvedConfig } from './config.ts'
export { VERSION } from './version.ts'
export { betaIncomplete, chiSquareCdf, gammaP, lnGamma, normalQuantile, tTwoSidedP, zTwoSidedP } from './math.ts'
export { convert, seFromCi } from './effects.ts'
export type { Conversion, ConvertRequest, ConvertResult } from './effects.ts'
export { pool } from './pool.ts'
export type { EggerResult, PooledEstimate, PoolModel, PoolOptions, PoolResult, StudyInput, StudyResult } from './pool.ts'
export { forestData, renderPoolMarkdown, renderPoolSarif } from './report.ts'
export type { ForestData, ForestRow } from './report.ts'
export { makeMaPoolTool } from './tools/ma-pool.ts'
export { makeMaConvertTool } from './tools/ma-convert.ts'
export { makeMaReportTool } from './tools/ma-report.ts'

/**
 * Mount the three tools.
 * @param ctx - the plugin context (host).
 * @param config - raw plugin config.
 */
export function apply(ctx: Context, config: ConfigShape): void {
  const resolved = resolveConfig(config)
  const logger = ctx.logger('meta-analysis')
  if (!resolved.enabled) {
    logger.info('disabled: enabled is false — no tools are mounted')
    return
  }
  ctx.effect(() => ctx.tools.register(makeMaPoolTool(resolved)), 'meta-analysis: ma_pool tool')
  ctx.effect(() => ctx.tools.register(makeMaConvertTool()), 'meta-analysis: ma_convert tool')
  ctx.effect(() => ctx.tools.register(makeMaReportTool()), 'meta-analysis: ma_report tool')
}
