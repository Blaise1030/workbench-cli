# Benchmark: TypeScript vs Rust Server

**Date:** 2026-05-27

## Goal

Compare the TypeScript (Hono/Node.js) and Rust servers on two dimensions:
1. **Startup time** — time from process spawn to first successful `/api/health` response
2. **Throughput & latency** — req/s, p50, p99, p99.9 under load via `autocannon`

Results are printed as a side-by-side table and written to `bench-results.json`.

## Approach

Use `autocannon` (Node.js, no system install required) as the load testing tool.

## Script: `scripts/benchmark.mjs`

### Flow

1. Check Rust binary exists (`server-rs/target/release/workbench-cli`), exit with hint if not
2. **TypeScript server benchmark:**
   - Spawn `tsx server/index.ts` with a dedicated port (e.g. 4740)
   - Record `t0 = Date.now()`
   - Poll `GET /api/health` every 100ms until OK → `startupMs = Date.now() - t0`
   - Run `autocannon` for 10 seconds, 50 connections against `/api/health`
   - Kill process, collect results
3. **Rust server benchmark:**
   - Spawn `server-rs/target/release/workbench-cli --host 127.0.0.1 --http -p 4741 -y`
   - Same startup timing + autocannon run
   - Kill process, collect results
4. **Output:**
   - Print side-by-side comparison table to stdout
   - Append entry to `bench-results.json` with timestamp + both results

### npm script

```json
"bench": "node scripts/benchmark.mjs"
```

## Endpoints Benchmarked

- `GET /api/health` — unauthenticated, lightweight, good baseline

## Output Format

### Terminal table

```
┌─────────────────┬──────────────┬──────────────┐
│                 │ TypeScript   │ Rust         │
├─────────────────┼──────────────┼──────────────┤
│ Startup (ms)    │ 1234         │ 45           │
│ Req/s           │ 4200         │ 18000        │
│ Latency p50     │ 11ms         │ 2ms          │
│ Latency p99     │ 45ms         │ 8ms          │
│ Latency p99.9   │ 120ms        │ 20ms         │
└─────────────────┴──────────────┴──────────────┘
```

### bench-results.json

```json
[
  {
    "timestamp": "2026-05-27T10:00:00Z",
    "typescript": { "startupMs": 1234, "reqPerSec": 4200, "p50": 11, "p99": 45, "p999": 120 },
    "rust": { "startupMs": 45, "reqPerSec": 18000, "p50": 2, "p99": 8, "p999": 20 }
  }
]
```

## Ports Used

| Server     | Port |
|------------|------|
| TypeScript | 4740 |
| Rust       | 4741 |

(Chosen to avoid conflict with default dev ports)

## Dependencies

- `autocannon` — added as devDependency
- No system-level installs required
