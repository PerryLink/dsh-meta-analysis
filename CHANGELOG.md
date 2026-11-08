# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-11-08

### Changed

- Release-engineering refresh: CHANGELOG accuracy, package metadata and authors; no runtime changes.

## [0.1.0] - 2026-11-08

### Fixed

- `level` is now applied to the pooled and per-study confidence intervals. It
  was accepted (and exposed in config) but the critical value was hard-coded to
  the 95% value, so a `level` other than 0.95 silently produced 95% intervals.
- `ma_report` rejects a malformed `result` payload with `INVALID_INPUT` instead
  of letting a `TypeError` escape the tool boundary.
- Invalid study objects, models and confidence levels raise `RangeError` and are
  reported as `INVALID_INPUT` by the tools. A study CI must be centred on the
  effect (it is required to be symmetric on the analysis scale), and CI bounds
  must be finite.

### Added

- Tests for the requested confidence level, invalid models/levels/studies,
  malformed `ma_report` payloads and the function-plugin mount contract (21
  tests total).

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
