/**
 * Tool surface: schemas, execution, forest data, failure branch.
 * @module test/tools.spec
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'
import type { PoolResult } from '../src/pool.ts'
import { makeMaConvertTool } from '../src/tools/ma-convert.ts'
import { makeMaPoolTool } from '../src/tools/ma-pool.ts'
import { makeMaReportTool } from '../src/tools/ma-report.ts'
import { VERSION } from '../src/version.ts'

const EXEC = {} as never
const CONFIG = resolveConfig({})

describe('tools', () => {
  it('declares names and schemas', () => {
    for (const [tool, name] of [
      [makeMaPoolTool(CONFIG), 'ma_pool'],
      [makeMaConvertTool(), 'ma_convert'],
      [makeMaReportTool(), 'ma_report'],
    ] as const) {
      expect(tool.name).toBe(name)
      expect(Object.keys(tool.parameters).length).toBeGreaterThan(0)
      expect(tool.output.schema).toBeDefined()
    }
  })

  it('pools and reports forest data end to end', async () => {
    const pooled = (await makeMaPoolTool(CONFIG).execute(
      { studies: [{ label: 'A', effect: 0.2, se: 0.1 }, { label: 'B', effect: 0.4, se: 0.1 }, { label: 'C', effect: 0.6, se: 0.1 }] },
      EXEC,
    )) as { ok: true; result: PoolResult }
    expect(pooled.ok).toBe(true)

    const report = (await makeMaReportTool().execute({ result: pooled.result, measure: 'log OR' }, EXEC)) as {
      ok: true
      forest: { rows: unknown[]; pooled: { effect: number }; measure: string }
      markdown: string
      sarif: { version: string }
    }
    expect(report.forest.rows).toHaveLength(3)
    expect(report.forest.pooled.effect).toBeCloseTo(0.4, 6)
    expect(report.forest.measure).toBe('log OR')
    expect(report.markdown).toContain('Meta-analysis')
    expect(report.sarif.version).toBe('2.1.0')
  })

  it('converts and rejects bad input', async () => {
    const converted = (await makeMaConvertTool().execute({ conversion: 'd-to-r', value: 0.5 }, EXEC)) as { ok: true; result: { value: number } }
    expect(converted.result.value).toBeCloseTo(0.242536, 5)
    const failure = (await makeMaConvertTool().execute({ conversion: 'or-to-logor', value: 0 }, EXEC)) as { ok: false; error: { code: string } }
    expect(failure.ok).toBe(false)
    expect(failure.error.code).toBe('INVALID_INPUT')
    const badPool = (await makeMaPoolTool(CONFIG).execute({ studies: [{ label: 'A', effect: 0.1 }] }, EXEC)) as { ok: false; error: { code: string } }
    expect(badPool.ok).toBe(false)
  })
})

describe('package', () => {
  it('VERSION matches package.json and the manifest declares a bundle patch', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    expect(pkg['version']).toBe(VERSION)
    expect(pkg['dsh']).toEqual({ manifestVersion: 1, bundle: { patch: './cordis.patch.yml' } })
    expect(pkg['dependencies']).toEqual({})
  })
})
