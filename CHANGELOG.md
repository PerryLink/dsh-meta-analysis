# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-08

First release: meta-analysis arithmetic.

### Added

- `ma_pool`: fixed-effect and DerSimonian–Laird random-effects pooling with
  95% CIs, Q/df/p, I², τ², per-study weights and warnings; SE may be supplied
  directly or derived from a symmetric CI (a disagreement > 5% is rejected).
- `ma_convert`: OR/RR log conversion with CI-derived SE, d⇄r, d⇄OR (logistic
  approximation), SMD from two means, and SE from a CI — each with the formula
  it used.
- `ma_report`: forest-plot data plus Markdown and SARIF 2.1.0.
- Egger test at k ≥ 10, labelled a screening aid.
- Dependency-free χ²/t/Φ⁻¹ special functions with documented accuracy.
- 16 tests including hand-calculated pooled estimates.

### Notes

- No REML/Paule–Mandel, meta-regression, subgroup automation, trim-and-fill or
  plots.
- Pure arithmetic: no files are written, so there is no REP record.
