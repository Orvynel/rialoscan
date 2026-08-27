# RialoScan

A block explorer for [Rialo](https://rialo.io), built directly on the node's
JSON-RPC surface.

| | |
|---|---|
| **[devnet.rialoscan.org](https://devnet.rialoscan.org)** | Devnet explorer |
| **[testnet.rialoscan.org](https://testnet.rialoscan.org)** | Testnet explorer |
| [rialoscan.org](https://rialoscan.org) | Held for mainnet; serves a holding page only |

Rialo is a Layer 1 from Subzero Labs, currently on devnet and testnet. It shares
Solana's account model but replaces the VM (PolkaVM instead of SBF) and adds two
things to the execution model that no Solana-derived explorer has a view for:
**REX**, which runs WASM components inside a TEE with real internet access, and
**reactive transactions**, which are on-chain predicates that enqueue further
transactions automatically. RialoScan shows both.

- Zero dependencies beyond Next.js and React.
- No client-side data fetching, no wallet connection, no analytics, no tracking.
- Every number on screen comes from a live RPC call, decoded here.

## Why not the official SDK

RialoScan does not use `@rialo/ts-cdk` for reads. Three defects were reproduced
against live devnet, one of which is a silent correctness bug:

- `sendTransaction` and `requestAirdrop` are typed `Promise<Signature>` but
  return a bare `Uint8Array`, so `.toString()` yields `"250,239,228,…"` instead
  of base58. TypeScript cannot catch it — the declared type is wrong.
- `getTransaction` throws for every input shape. The method itself is fine over
  raw RPC; the fault is in the client's parameter encoding.
- u64 values are parsed through a JS double before widening to `BigInt`, so
  anything above 2^53 is silently corrupted. `u64::MAX` comes back as 2^64. This
  affects balances above ~9,007,199 RLO.

RialoScan reads u64 fields out of the raw JSON *text* into `BigInt` before any
number conversion happens (`lib/json.ts`), so no on-chain integer passes through
a double. Full write-up with repro scripts: [`RIALO-FINDINGS.md`](RIALO-FINDINGS.md).

## What the node will and will not give you

These are limits of the chain's RPC, not of this explorer. RialoScan states them
in the interface rather than papering over them, because an explorer that
silently shows less than the truth is worse than one that explains the gap:

- **Account history stops at 20 signatures.** `getSignaturesForAddress` is
  capped at 20 and discards `limit` and `before` (verified against a churn
  control — a working `before` returns zero overlap; it returned 16 of 20).
  Older history is unreachable over RPC.
- **The transaction feed is a fixed window of 100.** `getTransactions` accepts
  `signatures`, `limit` and `before` and ignores all three. RialoScan therefore
  offers no transaction pagination — paging controls would imply history that
  cannot be fetched.
- **No JSON-RPC batching.** A batch array is rejected with `-32602`. N pieces of
  data cost N round trips, so views that resolve many accounts deduplicate first
  and fan out concurrently.
- **A block cannot be fetched without its transactions.** `getBlock` ignores
  Solana's `transactionDetails`, `rewards` and `maxSupportedTransactionVersion`
  — unknown fields are accepted silently and the response is always the full
  block. What that costs is not fixed: a devnet block was 91 KB and took ~4.9 s
  on node `0.17.0-alpha.0`, and ~1 KB in ~150 ms on `0.19.0-alpha.0` later the
  same day. So `/blocks` does not fetch the blocks it lists; per-block counts
  come from the transaction feed, and the window follows how far that feed
  reaches.
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
multiaddrs. Decoded (`lib/multiaddr.ts`), they reveal three ports per node — the
gossip port from `getClusterNodes` (4090 on devnet and 4040 on testnet as of
2026-08-25), the registered port 4000, and subdag sync on 4200. That looks like a
data mismatch until you decode it, so `/validators` says so explicitly. Nothing
compares against a hardcoded port; the gossip port has already moved once across
a devnet redeploy and is not even the same number on both networks.

## Routes

| Route | Shows |
|---|---|
| `/` | Network overview: height, epoch, throughput, validators, latest blocks and transactions. On the apex: the mainnet holding page |
| `/blocks` | Recent blocks, joined against the transaction feed for per-block counts |
| `/block/[height]` | One block: fees, compute, transactions, program chips |
| `/txs` | The 100-transaction live feed |
| `/tx/[signature]` | One transaction: accounts and their derived roles, per-instruction data, program logs, and the reactive workflow lineage tree |
| `/address/[address]` | Account state, decoded native program name, history, and any REX requests created by it |
| `/validators` | The validator set, joined across `getClusterNodes` and `getValidatorAccounts` on hostname |
| `/rex` | REX requests, duty schedules, missed-duty counts per validator, and the TEE secret-sharing key |

## One network per hostname

Each network is a separate site. `devnet.rialoscan.org` serves devnet and
nothing else; `testnet.rialoscan.org` serves testnet and nothing else. There is
no network parameter and no default — the network is the first DNS label, and a
hostname that names no known network returns 404 rather than guessing. Guessing
is the one failure an explorer must not have: rendering one chain's data under
another chain's URL is worse than an error page.

The consequence is that every URL is self-describing. A signature pasted into
chat says which chain it came from, and no link in the interface has to carry a
network along with it.

The bare domain is reserved for mainnet, which does not exist yet, so it serves
one holding page listing both networks with their live heights. Explorer paths
arriving there are redirected (308) to a network host — including old
`?net=` URLs, which are honoured once as the redirect target and then dropped,
so previously shared links still resolve. `proxy.ts` is the only file that does
this, and the only one that changes when mainnet ships.

Two escape hatches, both for deployments where DNS labels are not available:
`RIALOSCAN_NETWORK` pins an entire deployment to one network (Vercel preview
URLs, where `devnet.<preview-url>` would not resolve), and `RIALO_DEVNET_RPC` /
`RIALO_TESTNET_RPC` override the endpoints.

In development the same mechanism works unchanged, because nothing resolves the
network against a hardcoded domain:

```
http://devnet.localhost:3000     http://testnet.localhost:3000
http://localhost:3000            the holding page
```

## Layout

```
proxy.ts                    one network per hostname; apex redirects
app/
  api/rpc/route.ts        server-side RPC proxy (the node sends no CORS header)
  page.tsx                overview on a network host, holding page on the apex
  robots.ts sitemap.ts    per-hostname, since each host is a separate site
  blocks/ block/[height]/ txs/ tx/[signature]/ address/[address]/
  validators/ rex/ not-found.tsx
  globals.css             all styling; no CSS framework
  icon.svg favicon.ico    the mark, sized for a browser tab and a search result
components/               presentational only, no fetching
lib/
  networks.ts             network identity and hostname arithmetic
  host.ts                 resolves the network from the request's Host header
  rpc.ts                  transport, caching, error shapes
  json.ts                 BigInt-safe JSON parsing from raw source text
  chain.ts                every RPC method, decoded into typed values
  message.ts              derives account roles from message header counters
  programs.ts             resolves program names from the chain, no hardcoded table
  base58.ts               cross-encoding key identity
  multiaddr.ts            binary multiaddr decoding
  format.ts               locale-free formatting (kelvin/RLO, UTC, byte sizes)
  theme.ts                the pre-paint theme script and the cookie it reads
  overview.ts
scripts/make-icons.py       redraws the raster icons from icon.svg's geometry
```

`lib/chain.ts` is `server-only`. The Rialo RPC sends no
`access-control-allow-origin` header, so a browser cannot call it directly; all
requests go through `app/api/rpc/route.ts`.

## Running it

```bash
npm install
npm run dev
```

Then open <http://devnet.localhost:3000> or <http://testnet.localhost:3000> —
`*.localhost` resolves to loopback in every current browser, so the hostname
mechanism needs no `/etc/hosts` entry. <http://localhost:3000> is the apex
holding page. No environment variables and no API keys — the public endpoints
(`https://devnet.rialo.io`, `https://testnet.rialo.io`) need neither.

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

**Light and dark, with no flash of the wrong one.** The palette is a single block
of custom properties, so the light theme overrides that block and nothing else —
which is why every colour in `globals.css` is a token, including the tints. A
literal `rgba()` would survive the swap and be wrong in one of the two themes.
Light is not an inversion: inverting gives a cold page and a mint accent at
1.3:1 against it, so instead the two materials trade places — parchment becomes
the ground, near-black becomes the ink — and the mint darkens until it carries
text. The choice lives in `<html data-theme>` and is applied by a blocking inline
script before first paint; anything waiting for hydration would paint the default
palette and correct it a moment later. The toggle holds no React state and its
two glyphs are picked by CSS from that same attribute, so the button is also
right on the first paint rather than after mounting. The cookie is scoped to the
apex rather than the origin, because one network per hostname would otherwise
mean the theme was forgotten every time someone used the network switcher.

**Truncation is always labelled.** The largest instruction payload observed on
devnet is 89,350 base58 characters — a PolkaVM program blob being deployed.
Rendering that inline freezes the page; cutting it off silently makes a
truncated value look complete. `components/DataBlob.tsx` shows the true length,
a bounded preview, and an expand toggle.

## Status

Both networks are live and neither is a preview of the other: they run different
node builds, and which one leads changes. On the morning of 2026-08-25 testnet
led with `0.18.1` against devnet's `0.17.0-alpha.0`; by that evening devnet had
been wiped and redeployed as `0.19.0-alpha.0`, its height reset from 17.7M to
2.7M, while testnet had not moved. Transaction density moved independently of
the build over the same day — devnet went from 3 transactions per block to 1,
and testnet from 20–90 to 1 without changing version at all.

Nothing here is calibrated against those numbers. Every decoder in `lib/chain.ts`
was written against a live probe rather than from documentation and tolerates
missing fields instead of throwing, which is what lets one codebase read both
builds; `/blocks` measures the transaction feed's reach on each request instead
of assuming a density. When Rialo ships changes, the scripts in
[`probes/`](probes/) re-run in seconds and show what moved.

Not affiliated with Subzero Labs.
