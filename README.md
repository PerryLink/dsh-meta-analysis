# dsh-meta-analysis

**Pool the effect sizes — with arithmetic you can check line by line.**

*Effect-size conversion with named formulas, fixed-effect and DerSimonian–Laird random-effects pooling, Q / I² / τ², forest-plot data, Markdown + SARIF, and a light Egger test that refuses to run on fewer than ten studies.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24.9-brightgreen.svg)]()

English · [简体中文](README-zh.md)

---

## What it does

- **`ma_pool`** — inverse-variance pooling on one analysis scale. Fixed: `w = 1/v`, pooled `Σwθ/Σw`, `SE = 1/√Σw`. Random: DerSimonian–Laird `τ²`, weights `1/(v+τ²)`. Reports Q, df, p, I², τ², per-study weights and the pooled CI/p.
- **`ma_convert`** — OR⇄logOR, RR⇄logRR (SE from a CI), d⇄r, d⇄OR (logistic approximation), SMD from two means, SE from a CI. Every result names the formula and any approximation.
- **`ma_report`** — renderer-agnostic forest data (effect, CI, weight % + pooled row), Markdown, SARIF 2.1.0.
- **Egger** — only at k ≥ 10: OLS of θᵢ/SEᵢ on 1/SEᵢ; the intercept tests small-study effects. Labelled a screening aid, not proof of reporting bias.

## What it does not do

- **No model fitting beyond DL.** No REML/Paule–Mandel, no meta-regression, no subgroup or leave-one-out automation (the inputs are yours to vary), no trim-and-fill.
- **No risk-of-bias judgement.** Weights do not encode study quality.
- **No data extraction.** Effect sizes and SEs must be supplied on one scale; `ma_convert` helps produce them.
- **No plots.** Forest data is provided; drawing belongs to the host or another tool.
- **No evidence store.** This plugin is pure arithmetic: nothing is written to disk, and the README says so instead of pretending there is a REP record.

## Formulas

| Quantity | Formula |
|---|---|
| Fixed pooled | `Σwᵢθᵢ / Σwᵢ`, `wᵢ = 1/vᵢ` |
| Random pooled | same with `wᵢ* = 1/(vᵢ + τ²)` |
| Q | `Σ wᵢ(θᵢ − θ_FE)²`, df = k−1 |
| I² | `max(0, (Q − df)/Q)` |
| τ² (DL) | `max(0, (Q − df)/(Σw − Σw²/Σw))` |
| SE from CI | `(high − low)/(2·z)` |
| d→r | `d/√(d²+4)` |
| d⇄OR | `exp(d·π/√3)` / `log(OR)·√3/π` |
| SMD | `(m₁−m₂)/s_pooled`, SE `√(1/n₁+1/n₂+d²/(2(n₁+n₂)))` |
| Egger | OLS intercept of `θᵢ/SEᵢ` on `1/SEᵢ`, t with df = k−2 |

Normal-tail p uses an A&S 7.1.26 approximation (~1e-7); χ² and t use regularized incomplete gamma/beta continued fractions (~1e-10). Both are implemented in `src/math.ts` with no dependencies.

## Tools

### `ma_pool`

`{ studies: [{label, effect, se?, ciLow?, ciHigh?}], model?, level? }` → `{ ok, result }`.

### `ma_convert`

`{ conversion, value?, low?, high?, level?, mean1?, sd1?, n1?, mean2?, sd2?, n2? }` → `{ ok, result }`.

### `ma_report`

`{ result, measure? }` → `{ ok, forest, markdown, sarif }`.

### Error codes

`INVALID_INPUT` (non-finite values, non-positive SE/OR/RR, |r| ≥ 1, SE/CI disagreement, k < 2).

## Compatibility & install

| | |
|---|---|
| DeepSeek Harness | **`dsh-v0.2.1-rc.5`** (verified 2026-11-08); peer `>=0.2.1-0 <0.3.0 \|\| >=0.2.2-0 <0.3.0` |
| Node | `^22.19.0 \|\| >=24.9.0` (tested `24.22.1`), ESM only |
| Peers | `@perrylink/dsh-research-core ^0.1.0`, `@deepseek-ai/cordis ^4.0.5-alpha.1`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery ^3.18.5-alpha.1` |
| Runtime dependencies | **zero** |

```sh
dsh plugin --profile <name> add @perrylink/dsh-research-core dsh-meta-analysis
dsh --profile <name> --dump-config | grep dsh-meta-analysis
```

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | `false` mounts nothing |
| `model` | `both` | default pooling model (`fixed` / `random` / `both`) |
| `level` | `0.95` | default confidence level |

## Evaluation

**16 tests**: special functions against known critical values (χ²(8,2)=0.9817, t(2.306,8)≈0.05, z(1.96)≈0.05, Φ⁻¹(0.975)), conversions (logOR+SE, d⇄r, d⇄OR, SMD, impossible inputs), pooling (hand-calculated fixed/random estimates, Q=8, I²=0.75, τ²=0.03 from three studies), CI-derived SE and SE/CI disagreement rejection, Egger gating at k=10, heterogeneity warnings, tool schemas, end-to-end report, package contract.

No benchmark is claimed: this is closed-form arithmetic whose correctness is checked against hand calculations and published critical values, not against a labelled corpus.

## Known limitations (v0.1)

- One analysis scale per call; multi-scale harmonisation is the caller's job.
- DL τ² is known to be biased at small k; the plugin warns when k < 5.
- The Egger test assumes a normal distribution of effects and is underpowered below ~10 studies.
- No prediction interval (could be added without changing the interface).

## License

Apache-2.0. No third-party runtime code.
