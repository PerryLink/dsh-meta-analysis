# dsh-meta-analysis benchmark: meta

- Dataset: `meta` v0.1.0 (20 synthetic cases)
- Plugin: `dsh-meta-analysis` v0.1.1
- Call: `pool(studies, { model: 'both' })` at level 0.95
- Command: `pnpm run bench:meta`
- Pass rate: **20/20 (100.00%)**

Absolute errors against the generator's independent closed-form values:

| Field | n | Max abs error | Mean abs error | Tolerance | Pass |
|---|---:|---:|---:|---:|:---:|
| `fixed.effect` | 20 | 1.110e-16 | 6.939e-18 | 1.000e-6 | yes |
| `fixed.se` | 20 | 6.939e-18 | 8.674e-19 | 1.000e-6 | yes |
| `fixed.ciLow` | 20 | 1.110e-16 | 2.220e-17 | 1.000e-6 | yes |
| `fixed.ciHigh` | 20 | 1.110e-16 | 2.706e-17 | 1.000e-6 | yes |
| `random.effect` | 20 | 5.551e-17 | 9.714e-18 | 1.000e-6 | yes |
| `random.se` | 20 | 2.776e-17 | 2.602e-18 | 1.000e-6 | yes |
| `random.ciLow` | 20 | 1.110e-16 | 4.372e-17 | 1.000e-6 | yes |
| `random.ciHigh` | 20 | 2.220e-16 | 6.523e-17 | 1.000e-6 | yes |
| `Q` | 20 | 8.527e-14 | 7.577e-15 | 1.000e-6 | yes |
| `tau2` | 20 | 8.327e-17 | 6.722e-18 | 1.000e-6 | yes |
| `I2` | 20 | 2.220e-16 | 1.943e-17 | 1.000e-9 | yes |
| `pQ` | 20 | 1.665e-15 | 1.959e-16 | 1.000e-9 | yes |
| `k` | 20 | 0 | 0 | 0 | yes |
| `df` | 20 | 0 | 0 | 0 | yes |

`k` and `df` must match exactly; effect/SE/CI/Q/tau2 use 1e-6 and I2/pQ use 1e-9.

## Egger presence (k >= 10)

Expected on 11 cases; observed on 11; 0 missing and 0 unexpected.

| Case | k | Egger present | Egger df |
|---|---:|---|---:|
| `meta-0004` | 10 | yes | 8 |
| `meta-0005` | 12 | yes | 10 |
| `meta-0008` | 10 | yes | 8 |
| `meta-0009` | 12 | yes | 10 |
| `meta-0010` | 10 | yes | 8 |
| `meta-0011` | 10 | yes | 8 |
| `meta-0012` | 10 | yes | 8 |
| `meta-0013` | 12 | yes | 10 |
| `meta-0014` | 12 | yes | 10 |
| `meta-0015` | 12 | yes | 10 |
| `meta-0017` | 10 | yes | 8 |

The other 9 cases have k < 10 and must not carry an Egger result.
