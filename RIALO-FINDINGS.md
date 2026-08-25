# Rialo — verified technical findings

Investigated 2026-08-23. Every claim below was checked against a live endpoint,
a published package, or a GitHub API response. Items I could not verify are
marked UNVERIFIED.

## 1. What Rialo is

Layer 1 by **Subzero Labs** (subzero.xyz), backed by Pantera. Positioned for
"real-world finance" and the agent economy. Mainnet slated for 2026 (per Cboe
spotlight, May 2026).

**It is a Solana fork with a different VM.** Evidence: the dependency list in
`rialo-examples/Cargo.toml` contains ~120 crates named `rialo-s-*` that map
1:1 onto Solana's `solana-*` crates (`rialo-s-sdk`, `rialo-s-pubkey`,
`rialo-s-program-runtime`, `rialo-s-spl-token-2022`, ...), plus `rialo-sol-*`
crates that map onto Anchor (`rialo-sol-lang`, `rialo-sol-derive-accounts`,
`rialo-sol-attribute-program`). SPL Token-2022, PDAs, Borsh, base58 Ed25519
keys and the `11111111111111111111111111111111` system program are all present.

Differences from Solana:
- **VM**: PolkaVM (RISC-V), not SBF/BPF. Programs deploy as `.polkavm` blobs.
  `polkavm = "0.26.0"` in the workspace.
- **Venus PDK**: programs are written inside a `rialo! {}` Rust macro.
- **REX** (Rialo Extended Execution): WASM components (WIT-defined) running in
  a TEE. Host API gives programs outbound HTTP/WebSocket access.
- **Reactive transactions**: on-chain predicates evaluated at end of block by
  all validators; matching predicates enqueue transactions automatically.
  Replaces keepers/bots/cron.
- **Currency**: RLO. 1 RLO = 1e9 *kelvin*.
- **HD derivation**: BIP44 coin type **756**, path `m/44'/756'/{i}'/0'`.
- **Replay protection**: every transaction must carry a fresh
  `configHashPrefix` from `getRecentValidatorConfigHash`. Not a blockhash.

## 2. Live network (confirmed working)

| | |
|---|---|
| devnet | `https://devnet.rialo.io` (443) and `http://devnet.rialo.io:4100` |
| testnet | `https://testnet.rialo.io` (443) and `http://testnet.rialo.io:4100` |
| localnet | `http://localhost:4104` (per SDK constants) |

Port 4101 is HTTPS-only (plain HTTP there returns nginx 400). Port 4104 is not
open on the public hosts.

Observed 2026-08-23:
- devnet: blockHeight ~16,463,000, epoch 27, ~45.7M txs, node `0.17.0-alpha.0`
- testnet: blockHeight ~830,000, epoch 2, ~1.63M txs
- `getEpochInfo.slotsInEpoch` = u64::MAX -> epochs are effectively unbounded
- Transfer fee: exactly **5000 kelvin**
- Faucet: `requestAirdrop` works over plain RPC, no captcha. CLI caps at 1 RLO
  per request (per AGENTS.md); RPC accepted 1 RLO.

38 RPC methods. Solana-shaped but **not** Solana-compatible: no `getSlot`,
no `getGenesisHash`, no `getLatestBlockhash`. Rialo-only methods:
`getRexRequests`, `getRexMissedDuties`, `getTriggeredTransactions`,
`getWorkflowLineage`, `getSubscription`, `getSecretSharingPubkey`,
`getRecentValidatorConfigHash`, `getConnectedFullNodes`,
`getConnectedValidators`, `getValidatorHealth`, `submitEpochChange`,
`getActiveFeatures`, `getStakeAccount`, `getValidatorAccounts`.

Full list: getAccountInfo, getAccountsByOwner, getActiveFeatures,
getAllAccounts, getBalance, getBlock, getBlockHeight, getBlocks,
getClusterNodes, getConnectedFullNodes, getConnectedValidators, getEpochInfo,
getFeeForMessage, getHealth, getInflationReward,
getMinimumBalanceForRentExemption, getMultipleAccounts,
getRecentValidatorConfigHash, getRexMissedDuties, getRexRequests,
getSecretSharingPubkey, getSignatureStatuses, getSignaturesForAddress,
getStakeAccount, getSubscription, getTokenAccountBalance, getTransaction,
getTransactionCount, getTransactions, getTriggeredTransactions,
getValidatorAccounts, getValidatorHealth, getVersion, getWorkflowLineage,
isBlockhashValid, requestAirdrop, sendTransaction, submitEpochChange.

## 3. Published SDKs (public, no gate)

npm, published by `subzerolabs`:
- `@rialo/ts-cdk@0.18.1` (2026-08-18) — core SDK, 107 exports
- `@rialo/frost@0.18.1`, `@rialo/frost-core@0.18.1` — React wallet adapter
- `@rialo/spl-token@0.18.1` — SPL Token-2022 client
- `@rialo/wallet-standard@0.1.1`
- `@rialo/explorer@0.1.4` (2025-12-12) — Next.js explorer, stale

crates.io: `rialo-cdk@0.18.1` and ~200 `rialo-*` crates.
PyPI: **nothing**. `rialo-py-cdk` is referenced in the ts-cdk README's
"See also" but is not published. Gap.

## 4. Access barriers

- `docs.rialo.io` — **entirely behind Cloudflare Access**, including
  `/user/latest/llms-full.txt` and `/llms.txt`. Sign-in required.
- `rialo.io/docs` and `/blog` — Webflow CMS shells; render "No items found"
  server-side. Real posts live at `www.rialo.io/posts/<slug>`.
- `rialo.io/robots.txt` blocks automated crawlers by name and sets
  `Content-Signal: ai-train=no, use=reference`. No page copy is reproduced here
  as a result — only findings derived from reading it.
- `github.com/rialo` — 404, does not exist.
- `github.com/SubzeroLabs/rialo` (the monorepo) — **404, private.**

## 5. Contribution surface — the hard part

`SubzeroLabs` has **5 public repos**: `rialo-examples`, `rialo-testnet`
(genesis pubkey sync), `deterministic-simulator`, `tokio-msim-fork`,
`test-repo`. The protocol monorepo is private.

`rialo-examples` states in its own README and AGENTS.md:

> This repository is a **generated, read-only mirror** ... Every sync wipes and
> rewrites the whole tree, so pull requests against this repository are lost;
> to change an example, contribute in the monorepo.

The monorepo is private, so that instruction is not actionable from outside.

Empirically confirmed: 4 open PRs (#18, #19, #20, #21), from
`samsamtrum`, `yappermoar-boop` x2, `sanjeebdas1979`. **Zero human replies on
any of them** — the only comments are Vercel authorization bots. #18 has been
open since 2026-06-19. Repo last pushed 2026-06-12, pinned to crates 0.10.1
while the published CDK is 0.18.1.

Conclusion: upstream code contribution is currently closed. Building
*alongside* the chain is open.

## 6. Verified defects in `@rialo/ts-cdk@0.18.1`

All three reproduced against live devnet with Node v22.22.1. Repro scripts in [`probes/`](probes/).

### Bug 1 — RPC returns raw bytes where `.d.ts` promises `Signature`

`index.d.ts` declares:
```ts
sendTransaction(transaction: Uint8Array, options?): Promise<Signature>
requestAirdrop(pubkey: PublicKey, amount: Kelvin): Promise<Signature>
```

At runtime both return a plain `Uint8Array(64)`:
```
LOCAL kp.sign()      -> ctor _Signature, instanceof Signature = true,  toBytes = function
RPC requestAirdrop() -> ctor Uint8Array, instanceof Signature = false, toBytes = undefined
```

Impact: `sig.toString()` silently yields `"250,239,228,77,..."` (Uint8Array's
default join) instead of base58. TypeScript cannot catch it — the declared
type is a lie. Anyone logging, storing, or building an explorer link from a
returned signature writes corrupt data. A locally-signed `Signature` *does*
render base58 correctly, so the bug is isolated to the RPC return path.

Workaround: `Signature.fromBytes(raw)` rehydrates correctly.

### Bug 2 — `getTransaction()` is broken for every input shape

```
Signature obj -> radix.encode input should be Uint8Array
base58 string -> radix.encode input should be Uint8Array
Uint8Array    -> Cannot read properties of undefined (reading 'map')
number[]      -> radix.encode input should be Uint8Array
```
`confirmTransaction()` and `getSignaturesForAddress()` work fine on the same
signature, so this is specific to `getTransaction`.

**Scope correction (2026-08-23):** this is an SDK defect only. The same call
over raw JSON-RPC works correctly:

```
getTransaction { signature } -> returns an object, error: null
```

So the method itself is sound and the fault is entirely in the client's
parameter encoding. This is why RialoScan talks to the RPC directly rather than
through `@rialo/ts-cdk` — see §7.

### Bug 3 — u64 precision loss (correctness bug)

The client parses u64 JSON numbers through a JS double before widening to
BigInt. Any value above 2^53 is silently corrupted.

```
wire  slotsInEpoch: 18446744073709551615   (u64::MAX)
SDK   slotsInEpoch: 18446744073709551616   (2^64)
```
Also affects `rentEpoch`, `blockTime`, `transactionCount`, and — critically —
any balance above 2^53 kelvin (~9,007,199 RLO). Fix requires a BigInt-aware
JSON parse (lossless-json / reviver on raw text), not `BigInt(Number(x))`.

## 7. Verified limitations in the node's own RPC

Distinct from §6: these are not client bugs. They reproduce over raw JSON-RPC
with `fetch`, so any explorer, indexer or wallet built on Rialo today inherits
them. Repro: `node probes/rpc-limits.mjs`, `node probes/before.mjs` and
`node probes/blocks.mjs`.

### 7.1 — `getTransactions` ignores every filter parameter

```
no params      -> 100 transactions
limit: 2       -> 100   (not honoured)
signatures:[…] -> 100   (not filtered)
```

The method is a fixed window of the latest 100 transactions, network-wide.
`signatures`, `limit` and `before` are accepted without error and discarded.
Consequence: there is no way to fetch a specific set of transactions in one
call, and no way to page backwards. An explorer cannot offer transaction
pagination without implying history it cannot retrieve.

### 7.2 — `getSignaturesForAddress` is capped at 20 and ignores `limit`/`before`

```
no limit        -> 20 signatures
limit: 3        -> 20 signatures   (not honoured)
before: <oldest of page 1> -> 20 signatures, 16 of which are ON page 1
```

The `before` result was checked against a control, because this address
receives new signatures every second and natural churn could be mistaken for
paging. Two identical back-to-back calls differ by 2 of 20. A working `before`
would return **zero** overlap with page 1; it returned 16. So `before` is
discarded, not merely lossy.

Consequence: **account history older than the last 20 signatures is not
reachable over RPC at all.** This is the single hardest limit on what an
explorer can show, and it cannot be worked around client-side — only by
indexing blocks continuously from the outside.

### 7.3 — No JSON-RPC batching

A standard batch (a top-level JSON array of request objects) is rejected:

```
HTTP 400
-32602  Invalid JSON: invalid type: map, expected a string at line 1 column 1
```

The server does not implement the batch form of the JSON-RPC 2.0 spec — the
array is fed to a single-request deserialiser. Consequence: N pieces of data
cost N round trips. Any view that resolves many accounts (for example, naming
the programs referenced by a block) must fan out concurrent requests and
deduplicate aggressively.

### 7.4 — `getAllAccounts` is advertised but not implemented

It appears in the SDK's method list. The node answers:

```
-32601  Method 'getAllAccounts' not found
```

### 7.5 — `getTransaction` returns `block_time: null`

The method works over raw RPC (§6, Bug 2) but carries no timestamp:

```
getTransaction -> block_time: null
```

The containing block is the only place a transaction's time exists, so
displaying "when" requires a second call to `getBlock`.

### 7.6 — REX `created_at` is formatted as seconds from a millisecond value

```
created_at: "+58538-12-18 13:57:44.000 UTC"
created_at: "+58538-12-18 05:00:48.000 UTC"
```

Year 58538. The value is milliseconds rendered through a seconds formatter.
The defect is **scoped to this one field** — `duties[].target_timestamp` on the
same object formats correctly as `2026-08-23 04:22:27.700 UTC`, which is how we
know it is a formatting bug and not a bad stored value. RialoScan shows
`created_at` verbatim rather than deriving a date from it.

### 7.7 — `getBlock` has no lightweight form, and devnet answers it in ~4.9 s

Solana's `getBlock` takes `transactionDetails: "none" | "signatures" | "full"`
so a caller can ask for a block's shape without its payload. Rialo's does not.
Sending it — or `rewards: false`, or `maxSupportedTransactionVersion: 0` — is
accepted silently and changes nothing; the response is byte-identical to the
baseline, always the complete block:

```
block 17738959 (devnet), same request with each extra field:
  transactionDetails:signatures      93593 B   4607 ms
  transaction_details:none           93593 B   4901 ms
  rewards:false                      93593 B   8744 ms
  maxSupportedTransactionVersion:0   93593 B   8609 ms
```

Unknown fields are ignored rather than rejected, so there is no error to
discover this from — only the identical byte counts.

Devnet's latency is also a floor, not congestion. Five sequential calls:
`4906 4897 4903 4905 4902` ms — a ~4.9 s constant. Ten in parallel finish in
8.3 s, so concurrency helps but the floor dominates. Testnet answers the same
call in 144–577 ms.

Consequence for an explorer: a block *list* cannot fetch the blocks it lists.
Fifty devnet blocks would be 4.5 MB and well past any sane request budget.
`/blocks` therefore derives per-block counts from the 100-transaction feed and
sizes its window to how far that feed actually reaches — about 35 blocks on
devnet at 3 transactions each, but only 3 on testnet at 20–90.

### 7.8 — The two networks run different node builds, and `getVersion` does not report them

`getVersion` does not return a version. It returns a bare git commit SHA as a
plain string — not Solana's `{"solana-core": …}` object, and not wrapped in
`{context, value}` like almost every other method:

```
devnet   getVersion -> "16173485029a3d9e8892fc67964ac133b1fdf897"
testnet  getVersion -> "2e1fdefe31cc6569006a4d5a96a2316d3ecc6c93"
```

The readable build number is only ever present as `context.api_version`, riding
along on any wrapped response:

```
devnet   getValidatorAccounts.context.api_version -> 0.17.0-alpha.0
testnet  getValidatorAccounts.context.api_version -> 0.18.1
```

So the two networks are on different builds, and **testnet is ahead of devnet**,
which is the reverse of the usual order. Every finding above was confirmed on
both unless stated otherwise, and no decoder depends on a version string — but
it means devnet is not a preview of testnet, and a shape verified on one is not
evidence about the other. Two SHAs cannot be compared for ordering, which is why
RialoScan displays `api_version` and treats `getVersion` as an opaque build
identifier (`lib/chain.ts`).

### 7.9 — `getBlockHeight` is a snapshot of a fast-moving head

Not a defect, but it invalidates the obvious way to build a block list. Devnet
advances ~6–18 blocks per second. Read the height first and the transaction feed
second, and the feed comes back describing blocks *above* the height just
observed:

```
getBlockHeight = 17740822
feed newest    = 17740856   (34 heights further on)
feed oldest    = 17740821
```

Issued in the same round trip, `getBlockHeight`, `getEpochInfo.blockHeight` and
the feed's newest height agree to within two blocks. So the 34-block gap is
elapsed time, not a lagging counter. Anchoring a 50-block window to the earlier
value puts the window almost entirely below the feed's coverage, which produced
a list of dashes on a chain that had transactions in every block. `/blocks`
reads the height and the feed concurrently and anchors to whichever saw further.

## 8. The same key in three encodings across three endpoints

Not a bug, but an interoperability trap that silently produces empty joins.

A validator's keys are returned in a different encoding depending on which
method you ask:

| Source | Encoding | Example |
|---|---|---|
| `getValidatorAccounts.network_key` | base58 | `ESmYnLKZdZpeRBHkxGTNZJW8mSQgsAe7hSPmjKDPDXWn` |
| `getClusterNodes.networkPubkey` | base64 | `x8HSIGeWHeEFsVrLsYtjsBfnQRd2gabGAKzhdUGJgzc=` |
| `getRexRequests[].duties[].assigned_validators` | hex (96-byte authority keys) | `3e4eca…` |

These are the *same bytes*. A client that joins `getValidatorAccounts` against
`getClusterNodes` on key equality matches zero rows. The only correct approach
is to decode all three to bytes and compare. RialoScan does this in
`lib/base58.ts` (`sameKey`, `hexEqualsBase64`) — which is what turns
192 characters of hex on a REX duty into the label `validator-0`.

The two endpoints also disagree on ordering (`getClusterNodes[0]` is `node0`,
`getValidatorAccounts[0]` is `node2`), so RialoScan joins them on hostname.

### 8.1 — `address` and `subdag_sync_address` are base64-wrapped binary multiaddrs

`getValidatorAccounts` returns these as base64, not as text:

```
address:              "NRVub2RlMi5kZXZuZXQucmlhbG8uaW+RAg+g"
subdag_sync_address:  "NRVub2RlMi5kZXZuZXQucmlhbG8uaW+RAhBo"
```

Base64-decoded, these are binary multiaddrs. Decoded properly:

```
address              -> /dns/node2.devnet.rialo.io/udp/4000
subdag_sync_address  -> /dns/node2.devnet.rialo.io/udp/4200
```

`getClusterNodes` reports a *third* port for the same validator, as plain text
rather than base64. **Three different ports per node, all legitimate:** the
gossip port from `getClusterNodes`, the registered port (4000) and subdag sync
(4200) from the on-chain account. This reads as a data mismatch until the
multiaddrs are decoded, at which point it is simply three services. Decoder:
`lib/multiaddr.ts`.

The gossip port is the one value here that is not stable, and it is not even the
same across networks: it was 4070 when first probed, is **4090** on all four
devnet nodes as of 2026-08-25, and **4040** on all four testnet nodes on the same
day, while the two on-chain ports (4000, 4200) have not moved on either network.
Devnet is redeployed without notice, so nothing in this document treats a port as
a constant — `lib/multiaddr.ts` reads whatever the node reports and never
compares against a hardcoded number.

### 8.2 — Units are unlabelled in two places

- `getValidatorAccounts[].stake` is `1` per validator on devnet. This is stake
  *units*, not kelvin — treating it as kelvin would report 1 billionth of an
  RLO staked.
- **`commission` and `commission_rate` are two different fields on the same
  object**, and only one of them is a rate. `commission` is accrued commission in
  kelvin and is large (4,490,200 on devnet and 4,510,080 on testnet as of
  2026-08-25); `commission_rate` is `0` on every validator on both networks, with
  no stated denominator, alongside a third field `new_commission_rate`. Reading
  `commission` as a rate reports a 4.5-million-percent fee; reading
  `commission_rate` as the earned amount reports zero income. RialoScan shows the
  first as RLO and the second unscaled, labelled as an integer, rather than
  guessing whether it is a percentage or a basis-point value.

## 9. Reproducing

```bash
cd probes && npm install

# SDK defects (§6)
node probe.mjs        # airdrop + transfer, end to end
node root.mjs         # bug 1 root cause
node bug2.mjs         # bug 2
node u64.mjs          # bug 3

# Node RPC limitations (§7)
node rpc-limits.mjs   # batching, getAllAccounts, filter params, REX created_at
node before.mjs       # `before` is ignored, with a churn control
node blocks.mjs       # no lightweight getBlock, node builds, head vs feed (both networks)

# Encodings and addresses (§8)
node validators.mjs   # multiaddr decode, cross-encoding key identity
```

## 10. Ecosystem state

`github.com/search?q=rialo` returns 852 repos, essentially all solo, ~0 stars,
mostly TypeScript/HTML. A large share are landing pages, chatbots, or apps
that say "on Rialo" while actually deploying to **Ethereum Sepolia** — i.e.
Rialo-themed, not Rialo-integrated. No published third-party tooling that
talks to the real RPC.

## 11. What was built from this

This repository — a block explorer for Rialo devnet and testnet, built directly on
the JSON-RPC surface documented above. Every limitation in §7 and §8 is either
handled or stated in the UI rather than hidden:

| Finding | How RialoScan handles it |
|---|---|
| §6 Bugs 1–3 (SDK) | Does not use `@rialo/ts-cdk` for reads. Talks to the RPC directly and parses u64 fields from raw JSON text into `BigInt`, so no value passes through a double. |
| §7.1 no tx filters | `/txs` has no pagination controls, and says why. |
| §7.2 20-signature cap | `/address` states the cap in a footnote instead of showing an empty page as "no history". |
| §7.3 no batching | Program names are resolved with a deduplicated concurrent fan-out (`lib/programs.ts`), because one block references the same program in every transaction. |
| §7.5 `block_time: null` | The transaction page fetches its containing block for the timestamp. |
| §7.6 year-58538 `created_at` | Shown verbatim, with a note that no date is derived from it. |
| §8 three encodings | `lib/base58.ts` decodes all three so REX duties resolve to validator hostnames. |
| §8.1 binary multiaddrs | `lib/multiaddr.ts` decodes them; the three ports are explained on `/validators` as three services, not a mismatch. |
| §8.2 unlabelled units | `stake` is labelled "stake units, not kelvin"; `commission_rate` is shown unscaled. |

It also surfaces the two things Rialo adds to the execution model, which no
Solana-derived explorer has a view for:

- **REX** — `/rex` shows requests, their duty schedules, the TEE secret-sharing
  key, and per-validator missed-duty counts.
- **Reactive transactions** — every transaction page renders its
  `getWorkflowLineage` causal tree.

The RPC is not CORS-enabled (no `access-control-allow-origin` header), so a
server-side proxy is mandatory for any browser client. RialoScan's data layer is
`server-only` for this reason.

