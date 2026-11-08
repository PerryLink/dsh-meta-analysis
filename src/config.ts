/**
 * Config schema and resolution for `dsh-meta-analysis`.
 * @module dsh-meta-analysis/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin config. */
export interface Config {
  enabled?: boolean
  /** Default model when a call does not choose one. */
  model?: string
  /** Default confidence level. */
  level?: number
}

/** Fully resolved config. */
export interface ResolvedConfig {
  readonly enabled: boolean
  readonly model: 'fixed' | 'random' | 'both'
  readonly level: number
}

/** Schemastery schema. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  model: z.string().default('both'),
  level: z.number().default(0.95),
})

/**
 * Validate raw values and fill explicit defaults.
 * @param config - raw plugin config.
 * @returns the fully resolved config.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const model = config.model ?? 'both'
  if (!['fixed', 'random', 'both'].includes(model)) throw new TypeError('model must be fixed, random or both')
  const level = config.level ?? 0.95
  if (!(level > 0 && level < 1)) throw new TypeError('level must be between 0 and 1')
  return { enabled: config.enabled ?? true, model: model as 'fixed' | 'random' | 'both', level }
}
