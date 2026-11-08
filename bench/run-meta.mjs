// Benchmark adapter for the synthetic meta-analysis dataset.
//
// Reads dsh-research-bench/data/meta/cases.jsonl, calls this plugin's own
// `pool(studies, { model: 'both' })` once per case and compares the result with
// the generator's independent closed-form expected values. The expected values
// are data, not predictions: this script never recomputes them from plugin
// output.
//
// Writes bench/results-meta.json and bench/results-meta.md. Both are
// deterministic: no timestamps, no environment-dependent fields.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const benchDir = path.resolve(process.env.BENCH_DIR ?? path.join(root, '..', 'dsh-research-bench'))
const outputDir = path.join(root, 'bench')

const EFFECT_TOLERANCE = 1e-6
const Q_TAU_TOLERANCE = 1e-6
const PROBABILITY_TOLERANCE = 1e-9
const INTEGER_TOLERANCE = 0

const fail = message => {
  console.error(`bench:meta: ${message}`)
  process.exit(1)
}

const readJson = file => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
}

const readJsonl = file => {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => {
      try {
        const value = JSON.parse(line)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          fail(`${file}:${index + 1}: each line must be a JSON object`)
        }
        return value
      } catch (error) {
        fail(`${file}:${index + 1}: ${error.message}`)
      }
    })
}

const casesFile = path.join(benchDir, 'data', 'meta', 'cases.jsonl')
const summaryFile = path.join(benchDir, 'data', 'meta', 'SUMMARY.json')
const schemaFile = path.join(benchDir, 'data', 'meta', 'schema.json')
for (const file of [casesFile, summaryFile, schemaFile]) {
  if (!existsSync(file)) fail(`missing ${file}; run dsh-research-bench/scripts/generate-meta.mjs first`)
}

const packageFile = path.join(root, 'package.json')
const pkg = readJson(packageFile)
const summary = readJson(summaryFile)
const schema = readJson(schemaFile)
const cases = readJsonl(casesFile)
if (summary.dataset !== 'meta') fail(`SUMMARY.dataset is ${String(summary.dataset)}, expected "meta"`)
if (summary.synthetic !== true) fail('SUMMARY must declare synthetic: true')
if (summary.total !== cases.length) fail(`SUMMARY.total is ${String(summary.total)}, cases file has ${cases.length}`)
if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail('data/meta/schema.json is not JSON Schema 2020-12')

const poolFile = path.join(root, 'lib', 'pool.js')
if (!existsSync(poolFile)) fail('lib/pool.js is missing; run pnpm run build first')
const { pool } = await import(pathToFileURL(poolFile).href)

/** Absolute-error fields. Integer fields must match exactly. */
const FIELDS = [
  { name: 'fixed.effect', tolerance: EFFECT_TOLERANCE, pick: value => value.fixed?.effect },
  { name: 'fixed.se', tolerance: EFFECT_TOLERANCE, pick: value => value.fixed?.se },
  { name: 'fixed.ciLow', tolerance: EFFECT_TOLERANCE, pick: value => value.fixed?.ciLow },
  { name: 'fixed.ciHigh', tolerance: EFFECT_TOLERANCE, pick: value => value.fixed?.ciHigh },
  { name: 'random.effect', tolerance: EFFECT_TOLERANCE, pick: value => value.random?.effect },
  { name: 'random.se', tolerance: EFFECT_TOLERANCE, pick: value => value.random?.se },
  { name: 'random.ciLow', tolerance: EFFECT_TOLERANCE, pick: value => value.random?.ciLow },
  { name: 'random.ciHigh', tolerance: EFFECT_TOLERANCE, pick: value => value.random?.ciHigh },
  { name: 'Q', tolerance: Q_TAU_TOLERANCE, pick: value => value.Q },
  { name: 'tau2', tolerance: Q_TAU_TOLERANCE, pick: value => value.tau2 },
  { name: 'I2', tolerance: PROBABILITY_TOLERANCE, pick: value => value.I2 },
  { name: 'pQ', tolerance: PROBABILITY_TOLERANCE, pick: value => value.pQ },
  { name: 'k', tolerance: INTEGER_TOLERANCE, pick: value => value.k },
  { name: 'df', tolerance: INTEGER_TOLERANCE, pick: value => value.df },
]

const toleranceTable = {
  effect: EFFECT_TOLERANCE,
  se: EFFECT_TOLERANCE,
  ci: EFFECT_TOLERANCE,
  Q: Q_TAU_TOLERANCE,
  tau2: Q_TAU_TOLERANCE,
  I2: PROBABILITY_TOLERANCE,
  pQ: PROBABILITY_TOLERANCE,
  integers: INTEGER_TOLERANCE,
}

const formatNumber = value => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  if (value === 0) return '0'
  return value.toExponential(3)
}

const perCase = []
for (const item of cases) {
  const expected = item.expected
  const actual = pool(item.studies, { model: 'both' })

  const errors = {}
  const failures = []
  for (const field of FIELDS) {
    const expectedValue = field.pick(expected)
    const actualValue = field.pick(actual)
    if (typeof expectedValue !== 'number' || !Number.isFinite(expectedValue)) {
      fail(`${item.id}: expected.${field.name} is not a finite number`)
    }
    if (typeof actualValue !== 'number' || !Number.isFinite(actualValue)) {
      errors[field.name] = null
      failures.push({ field: field.name, expected: expectedValue, actual: actualValue ?? null, absError: null, tolerance: field.tolerance })
      continue
    }
    const absError = Math.abs(actualValue - expectedValue)
    errors[field.name] = absError
    if (!(absError <= field.tolerance)) {
      failures.push({ field: field.name, expected: expectedValue, actual: actualValue, absError, tolerance: field.tolerance })
    }
  }

  const contractFailures = []
  if (actual.model !== 'both') contractFailures.push(`model is ${String(actual.model)}, expected "both"`)
  if (actual.level !== 0.95) contractFailures.push(`level is ${String(actual.level)}, expected 0.95`)
  if (actual.fixed === undefined) contractFailures.push('result.fixed is missing')
  if (actual.random === undefined) contractFailures.push('result.random is missing')

  const eggerPresent = actual.egger !== undefined
  const egger = {
    expected: expected.egger,
    actual: eggerPresent,
    matched: expected.egger === eggerPresent,
  }
  if (eggerPresent) {
    egger.df = actual.egger.df
    egger.intercept = actual.egger.intercept
    egger.p = actual.egger.p
  }

  const numericErrors = Object.values(errors).filter(value => typeof value === 'number' && Number.isFinite(value))
  perCase.push({
    id: item.id,
    category: item.category,
    k: expected.k,
    pass: failures.length === 0 && contractFailures.length === 0 && egger.matched,
    maxAbsError: numericErrors.length === 0 ? null : Math.max(...numericErrors),
    errors,
    egger,
    ...(failures.length === 0 ? {} : { failures }),
    ...(contractFailures.length === 0 ? {} : { contractFailures }),
  })
}

const fieldMetrics = {}
for (const field of FIELDS) {
  let compared = 0
  let sum = 0
  let max = 0
  let allPass = true
  for (const item of perCase) {
    const value = item.errors[field.name]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      allPass = false
      continue
    }
    compared += 1
    sum += value
    if (value > max) max = value
    if (!(value <= field.tolerance)) allPass = false
  }
  fieldMetrics[field.name] = {
    tolerance: field.tolerance,
    n: compared,
    maxAbsError: compared === 0 ? null : max,
    meanAbsError: compared === 0 ? null : sum / compared,
    pass: allPass && compared === perCase.length,
  }
}

const eggerCases = perCase.filter(item => item.egger.expected)
const passed = perCase.filter(item => item.pass).length
const failures = perCase
  .filter(item => !item.pass)
  .map(item => ({
    id: item.id,
    category: item.category,
    fields: (item.failures ?? []).map(failure => failure.field),
    contractFailures: item.contractFailures ?? [],
    egger: item.egger,
  }))
const eggerSummary = {
  boundaryK: 10,
  expectedRun: eggerCases.length,
  actualRun: perCase.filter(item => item.egger.actual).length,
  matched: perCase.filter(item => item.egger.matched).length,
  missing: perCase.filter(item => item.egger.expected && !item.egger.actual).map(item => item.id),
  unexpected: perCase.filter(item => !item.egger.expected && item.egger.actual).map(item => item.id),
}

const results = {
  dataset: summary.dataset,
  datasetVersion: summary.version,
  plugin: { name: pkg.name, version: pkg.version },
  command: 'pnpm run bench:meta',
  call: "pool(studies, { model: 'both' })",
  confidenceLevel: summary.confidenceLevel,
  cases: cases.length,
  passed,
  failed: cases.length - passed,
  passRate: passed / cases.length,
  tolerances: toleranceTable,
  fields: fieldMetrics,
  egger: eggerSummary,
  failures,
  perCase,
}

const markdownRows = FIELDS.map(field => {
  const metric = fieldMetrics[field.name]
  return `| \`${field.name}\` | ${metric.n} | ${formatNumber(metric.maxAbsError)} | ${formatNumber(metric.meanAbsError)} | ${formatNumber(metric.tolerance)} | ${metric.pass ? 'yes' : 'NO'} |`
})
const eggerRows = eggerCases.map(item => {
  const actual = item.egger.actual ? 'yes' : '**NO**'
  const df = item.egger.actual ? String(item.egger.df) : '—'
  return `| \`${item.id}\` | ${item.k} | ${actual} | ${df} |`
})
const markdown = [
  '# dsh-meta-analysis benchmark: meta',
  '',
  `- Dataset: \`${summary.dataset}\` v${summary.version} (${cases.length} synthetic cases)`,
  `- Plugin: \`${pkg.name}\` v${pkg.version}`,
  `- Call: \`pool(studies, { model: 'both' })\` at level ${summary.confidenceLevel}`,
  '- Command: `pnpm run bench:meta`',
  `- Pass rate: **${passed}/${cases.length} (${(results.passRate * 100).toFixed(2)}%)**`,
  '',
  'Absolute errors against the generator\'s independent closed-form values:',
  '',
  '| Field | n | Max abs error | Mean abs error | Tolerance | Pass |',
  '|---|---:|---:|---:|---:|:---:|',
  ...markdownRows,
  '',
  '`k` and `df` must match exactly; effect/SE/CI/Q/tau2 use 1e-6 and I2/pQ use 1e-9.',
  '',
  '## Egger presence (k >= 10)',
  '',
  `Expected on ${eggerSummary.expectedRun} cases; observed on ${eggerSummary.actualRun}; ` +
    `${eggerSummary.missing.length} missing and ${eggerSummary.unexpected.length} unexpected.`,
  '',
  '| Case | k | Egger present | Egger df |',
  '|---|---:|---|---:|',
  ...eggerRows,
  '',
  `The other ${cases.length - eggerSummary.expectedRun} cases have k < 10 and must not carry an Egger result.`,
  '',
].join('\n')

mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'results-meta.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outputDir, 'results-meta.md'), markdown, 'utf8')

console.log(markdown)
console.log(`bench:meta: ${passed}/${cases.length} cases passed; wrote bench/results-meta.json and bench/results-meta.md`)
if (failures.length > 0) process.exitCode = 1
