# Glacier

A block explorer for [Rialo](https://rialo.io), built directly on the node's
JSON-RPC surface.

Rialo is a Layer 1 from Subzero Labs, currently on devnet and testnet. It shares
Solana's account model but replaces the VM (PolkaVM instead of SBF) and adds two
things to the execution model that no Solana-derived explorer has a view for:
**REX**, which runs WASM components inside a TEE with real internet access, and
**reactive transactions**, which are on-chain predicates that enqueue further
transactions automatically. Glacier shows both.

- Zero dependencies beyond Next.js and React.
- No client-side data fetching, no wallet connection, no analytics, no tracking.
- Every number on screen comes from a live RPC call, decoded here.

## Why not the official SDK

Glacier does not use `@rialo/ts-cdk` for reads. Three defects were reproduced
against live devnet, one of which is a silent correctness bug:

- `sendTransaction` and `requestAirdrop` are typed `Promise<Signature>` but
  return a bare `Uint8Array`, so `.toString()` yields `"250,239,228,…"` instead
  of base58. TypeScript cannot catch it — the declared type is wrong.
- `getTransaction` throws for every input shape. The method itself is fine over
  raw RPC; the fault is in the client's parameter encoding.
- u64 values are parsed through a JS double before widening to `BigInt`, so
  anything above 2^53 is silently corrupted. `u64::MAX` comes back as 2^64. This
  affects balances above ~9,007,199 RLO.

Glacier reads u64 fields out of the raw JSON *text* into `BigInt` before any
number conversion happens (`lib/json.ts`), so no on-chain integer passes through
a double. Full write-up with repro scripts: [`RIALO-FINDINGS.md`](RIALO-FINDINGS.md).

## What the node will and will not give you

These are limits of the chain's RPC, not of this explorer. Glacier states them
in the interface rather than papering over them, because an explorer that
silently shows less than the truth is worse than one that explains the gap:

- **Account history stops at 20 signatures.** `getSignaturesForAddress` is
  capped at 20 and discards `limit` and `before` (verified against a churn
  control — a working `before` returns zero overlap; it returned 16 of 20).
  Older history is unreachable over RPC.
- **The transaction feed is a fixed window of 100.** `getTransactions` accepts
  `signatures`, `limit` and `before` and ignores all three. Glacier therefore
  offers no transaction pagination — paging controls would imply history that
  cannot be fetched.
- **No JSON-RPC batching.** A batch array is rejected with `-32602`. N pieces of
  data cost N round trips, so views that resolve many accounts deduplicate first
  and fan out concurrently.
- **`getTransaction` carries no timestamp.** `block_time` is always `null`; the
  containing block is the only source, so transaction pages fetch it.
- **REX `created_at` renders as the year 58538** — milliseconds through a seconds
  formatter. Shown verbatim; no date is derived from it. The `target_timestamp`
  on each duty is correct, which is how the bug's scope was established.

## Reading the same key in three encodings

A validator's keys come back base58 from `getValidatorAccounts`, base64 from
`getClusterNodes`, and hex from REX duty assignments — the same bytes, three
ways. Joining those endpoints on key equality matches zero rows.
`lib/base58.ts` decodes all three to bytes, which is what lets a REX duty show
`validator-0` instead of 192 characters of hex, and lets `/validators` prove
that two endpoints are describing the same machine.

Similarly, `address` and `subdag_sync_address` are base64-wrapped *binary*
multiaddrs. Decoded (`lib/multiaddr.ts`), they reveal three ports per node —
4070 consensus, 4000 registered, 4200 subdag sync. That looks like a data
mismatch until you decode it, so `/validators` says so explicitly.

## Routes

| Route | Shows |
|---|---|
| `/` | Network overview: height, epoch, throughput, validators, latest blocks and transactions |
| `/blocks` | Recent blocks, joined against the transaction feed for per-block counts |
| `/block/[height]` | One block: fees, compute, transactions, program chips |
| `/txs` | The 100-transaction live feed |
| `/tx/[signature]` | One transaction: accounts and their derived roles, per-instruction data, program logs, and the reactive workflow lineage tree |
| `/address/[address]` | Account state, decoded native program name, history, and any REX requests created by it |
| `/validators` | The validator set, joined across `getClusterNodes` and `getValidatorAccounts` on hostname |
| `/rex` | REX requests, duty schedules, missed-duty counts per validator, and the TEE secret-sharing key |

Add `?net=testnet` to any route, or use the switcher in the header.

## Layout

```
app/
  api/rpc/route.ts        server-side RPC proxy (the node sends no CORS header)
  page.tsx                overview
  blocks/ block/[height]/ txs/ tx/[signature]/ address/[address]/
  validators/ rex/ not-found.tsx
  globals.css             all styling; no CSS framework
components/               presentational only, no fetching
lib/
  rpc.ts                  transport, caching, error shapes
  json.ts                 BigInt-safe JSON parsing from raw source text
  chain.ts                every RPC method, decoded into typed values
  message.ts              derives account roles from message header counters
  programs.ts             resolves program names from the chain, no hardcoded table
  base58.ts               cross-encoding key identity
  multiaddr.ts            binary multiaddr decoding
  format.ts               locale-free formatting (kelvin/RLO, UTC, byte sizes)
  networks.ts overview.ts
```

`lib/chain.ts` is `server-only`. The Rialo RPC sends no
`access-control-allow-origin` header, so a browser cannot call it directly; all
requests go through `app/api/rpc/route.ts`.

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. No environment variables and no API keys —
the public endpoints (`https://devnet.rialo.io`, `https://testnet.rialo.io`) need
neither.

To build:

```bash
npm run build
```

## Design notes

**Account roles are derived, not stored.** A Rialo transaction message does not
label its accounts. Signer, writable and fee-payer status is implied by each
account's index position combined with three header counters
(`num_required_signatures`, `num_readonly_signed_accounts`,
`num_readonly_unsigned_accounts`). `lib/message.ts` reconstructs this;
`/tx/[signature]` footnotes it so the roles are not mistaken for chain data.

**No recent blockhash.** Rialo's replay protection is a `configHashPrefix` from
`getRecentValidatorConfigHash` paired with a `validFrom` millisecond timestamp —
a transaction is accepted at or after that instant. There is no
`recentBlockhash` field to display, and no `preBalances`/`postBalances` arrays,
so per-account balance deltas cannot be shown.

**Kelvin, not lamports.** 1 RLO = 1,000,000,000 kelvin, and the balance field is
literally named `kelvin`. The transfer fee is exactly 5000 kelvin.

**Formatting is locale-free.** Every timestamp renders as explicit UTC and every
number groups digits manually, so server and client output are byte-identical
and hydration never mismatches.

**Truncation is always labelled.** The largest instruction payload observed on
devnet is 89,350 base58 characters — a PolkaVM program blob being deployed.
Rendering that inline freezes the page; cutting it off silently makes a
truncated value look complete. `components/DataBlob.tsx` shows the true length,
a bounded preview, and an expand toggle.

## Status

Devnet state is wiped without notice and the node is `0.17.0-alpha.0`, so
decoded shapes can change under us. Every decoder in `lib/chain.ts` was written
against a live probe rather than from documentation, and tolerates missing
fields instead of throwing. When Rialo ships changes, the scripts in
[`probes/`](probes/) re-run in seconds and show what moved.

Not affiliated with Subzero Labs.
