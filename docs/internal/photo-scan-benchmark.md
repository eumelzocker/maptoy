# Photo scan limits benchmark

Measured on 2026-08-31 to select the Phase 5 Photo defaults and configuration
ceilings. The benchmark exercises the real server scan path, including SQLite,
fingerprinting, Sharp decoding and WebP preview generation, ExifTool, progress
checkpoints, and retained per-file diagnostics.

## Environment

- AMD Ryzen 9 3900X, 12 cores / 24 threads
- 64 GiB RAM
- Linux 6.18.48, x86-64
- Node.js 24.19.0, pnpm 11.21.0
- Sharp 0.35.3, ExifTool 13.59
- ext4 on local NVMe for source photos and application data

RSS was sampled every 5 ms inside a fresh Node.js process. `Peak delta` is peak RSS
minus the process RSS immediately before creating the scan Job. Results describe
this machine and synthetic workload; they are a reproducible sizing reference, not
a throughput guarantee for other hardware or real photo collections.

## Mixed decoding workload

The generated directory contains 27 entries with a logical total size of
320,750,629 bytes (305.9 MiB):

- 16 noisy JPEGs at 2048 × 1536 (3.1 MP, about 1.4 MiB each)
- 6 noisy JPEGs at 6000 × 4000 (24 MP, about 10.7 MiB each)
- 2 noisy JPEGs at 10000 × 8000 (80 MP, about 35.6 MiB each)
- 1 noisy JPEG at 12000 × 9000 (108 MP, about 48.1 MiB)
- 1 malformed JPEG and 1 sparse file of 100 MiB + 1 byte

With the 100 MiB and 100 MP defaults, 24 files complete and the three deliberate
limit/decoder cases fail individually. The Job itself completes, retains three
diagnostics, and reports `completed + skipped + failed == total`.

### Decoder concurrency and batch size

All rows use a 640 px preview edge and the 100 MP decoded-pixel limit.

| Concurrency | Batch | Runtime | Files/s | Peak RSS delta |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 25 | 5.337 s | 5.06 | 108.9 MiB |
| 2 | 25 | 3.476 s | 7.77 | 123.9 MiB |
| 2 | 100 | 3.498 s | 7.72 | 125.1 MiB |
| 4 | 100 | 2.004 s | 13.47 | 158.8 MiB |

Two decoders improve throughput by roughly 53% over one with a modest measured RSS
increase. Four are useful as an explicit ceiling on stronger machines, but are not
the default because real-world decoder memory, storage latency, and concurrent
server traffic vary. Batch sizes 25 and 100 differ by less than 1% here; 100 remains
the default to bound scheduling/checkpoint windows without adding overhead.

### Preview edge

All rows use concurrency 2, batch size 100, and the 100 MP decoded-pixel limit.

| Preview edge | Runtime | Files/s | Peak RSS delta |
| ---: | ---: | ---: | ---: |
| 320 px | 3.160 s | 8.54 | 119.8 MiB |
| 640 px | 3.498 s | 7.72 | 125.1 MiB |
| 1280 px | 5.589 s | 4.83 | 180.8 MiB |
| 2048 px | 9.751 s | 2.77 | 326.1 MiB |

The 640 px default costs little over 320 px while providing useful popup/detail
previews. Larger previews increase both time and memory sharply. 2048 px is retained
only as the configurable hard ceiling.

### Decoded-pixel ceiling

Raising the test limit from 100 MP to 150 MP admits the 108 MP JPEG. At concurrency
2 and a 640 px preview edge, 25 files complete, 2 deliberate failures remain, the
run takes 3.932 s (6.87 files/s), and peak RSS delta is 153.9 MiB. This supports
150 MP as the configuration ceiling while retaining 100 MP as the safer default.

## Directory enumeration workload

The scanner currently enumerates and sorts paths before decoding. Empty `.jpg`
files spread over directories isolate that cost:

| Entries | Runtime | Peak RSS delta |
| ---: | ---: | ---: |
| 100,000 | 0.530 s | 66.2 MiB |
| 250,000 | 1.231 s | 156.5 MiB |

100,000 remains the default scan limit. 250,000 is the configurable ceiling; beyond
that, path-list memory alone becomes too large for a conservative self-hosted
default and catalog/UI costs dominate regardless of decoder throughput.

## Selected limits

| Setting | Default | Configuration ceiling | Reason |
| --- | ---: | ---: | --- |
| File bytes | 100 MiB | 256 MiB | Reject exceptional inputs before hashing/decoding; decoded pixels remain independently bounded. |
| Decoded pixels | 100,000,000 | 150,000,000 | Accepts the measured 80 MP workload by default; 108 MP was measured only for the explicit ceiling. |
| Preview edge | 640 px | 2048 px | 640 px has near-320 px cost; 2048 px already adds about 326 MiB peak RSS in this workload. |
| Scan batch | 100 | 1,000 | Measured batch sizes do not affect decoding throughput; keep scheduling windows finite. |
| Decoder concurrency | 2 | 4 | Good default throughput/RSS balance; four is measured and opt-in. |
| Files per scan | 100,000 | 250,000 | Directly measured enumeration cost is 66 MiB and 157 MiB respectively. |

The server validates these ceilings at startup. A file exceeding the configured byte
or pixel limit, or a malformed image, becomes a `PHOTO_PROCESSING_FAILED` Asset and
Job diagnostic without aborting other files. Diagnostic messages name the relevant
`MAPTOY_PHOTOS_*` setting where applicable and replace absolute source paths with the
catalog-relative path.

## Reproduction

Use empty directories for every preparation and run:

```sh
pnpm exec tsx apps/server/scripts/photo-scan-benchmark.ts prepare \
  --photos /tmp/maptoy-photo-benchmark/photos
pnpm exec tsx apps/server/scripts/photo-scan-benchmark.ts run \
  --photos /tmp/maptoy-photo-benchmark/photos \
  --data /tmp/maptoy-photo-benchmark/data-c2 \
  --concurrency 2 --batch 100 --preview-edge 640 --max-pixels 100000000

pnpm exec tsx apps/server/scripts/photo-scan-benchmark.ts prepare-listing \
  --photos /tmp/maptoy-photo-benchmark/listing --count 100000
pnpm exec tsx apps/server/scripts/photo-scan-benchmark.ts list \
  --photos /tmp/maptoy-photo-benchmark/listing
```
