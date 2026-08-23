# Probes

Reproduction scripts for every claim in [`../RIALO-FINDINGS.md`](../RIALO-FINDINGS.md).
They run against live Rialo devnet and print what the node actually returned, so
each finding can be re-checked rather than taken on trust.

```bash
npm install
```

Only the four SDK scripts need the dependency. The rest use `fetch` and can run
with no install at all.

| Script | Verifies | Needs the SDK |
|---|---|---|
| `probe.mjs` | Airdrop and transfer, end to end | yes |
| `root.mjs` | §6 Bug 1 — RPC returns `Uint8Array` where the types promise `Signature` | yes |
| `bug2.mjs` | §6 Bug 2 — `getTransaction` throws for every input shape | yes |
| `u64.mjs` | §6 Bug 3 — u64 precision loss through a JS double | yes |
| `rpc-limits.mjs` | §7 — no batching, `getAllAccounts` missing, ignored filter params, REX `created_at` | no |
| `before.mjs` | §7.2 — `before` is ignored, measured against a churn control | no |
| `validators.mjs` | §8 — multiaddr decoding and cross-encoding key identity | no |

Run any of them directly:

```bash
node rpc-limits.mjs
```

Devnet state is wiped without notice, so exact heights and balances will differ
from the values quoted in the findings document. The behaviours will not.

## Why `before.mjs` has a control

The address used receives new signatures every second. A naive check —
"did the first result change when I passed `before`?" — would report success
purely from that churn. So the script also issues the same call twice with no
cursor and reports how much the feed moves on its own. Only the *overlap* figure
is evidence: a working `before` returns zero overlap with the previous page.

This is the pattern for every claim in the findings document. Where a result
could have an innocent explanation, the probe measures the innocent explanation
too.
