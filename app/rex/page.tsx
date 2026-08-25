import Link from "next/link";
import { Notice, Panel, Stat } from "@/components/Panel";
import { Hash } from "@/components/Hash";
import { RexRequestList } from "@/components/RexRequestList";
import { formatBytes, groupDigits, looksLikeAddress, plural, shorten } from "@/lib/format";
import { hexEqualsBase64 } from "@/lib/base58";
import {
  REX_PROCESSOR,
  getAccountInfo,
  getCluster,
  getRexMissedDuties,
  getRexRequests,
  getSecretSharingPubkey,
  nativeProgramName,
} from "@/lib/chain";
import { CACHE_IMMUTABLE } from "@/lib/rpc";
import { requireNetwork } from "@/lib/host";
import { NETWORKS } from "@/lib/networks";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "REX",
  description:
    "Rialo Extended Execution: TEE-hosted components that reach the public internet and settle results on chain.",
};

/**
 * A creator with live REX activity on devnet, used as the default so the page is
 * never an empty form. Overridden by `?creator=`.
 */
const SAMPLE_CREATOR = "EP5YsLqRnuztVapKz9QX8cPJ7DrLzcaGVn9dHupYoR3S";

export default async function RexPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string }>;
}) {
  const params = await searchParams;
  const net = await requireNetwork();
  const requested = (params.creator ?? "").trim();
  const creator = looksLikeAddress(requested) ? requested : SAMPLE_CREATOR;
  const invalidInput = requested.length > 0 && !looksLikeAddress(requested);

  const [processor, secret, requests, cluster] = await Promise.all([
    getAccountInfo(net, REX_PROCESSOR, CACHE_IMMUTABLE),
    getSecretSharingPubkey(net).catch(() => null),
    getRexRequests(net, creator).catch(() => []),
    getCluster(net).catch(() => ({ version: 0n, nodes: [] })),
  ]);

  // One call per request; the node has no batching, so they go out in parallel.
  const missedEntries = await Promise.all(
    requests.map(async (request) =>
      [request.nonce, await getRexMissedDuties(net, creator, request.nonce).catch(() => [])] as const,
    ),
  );
  const missedDuties = new Map(missedEntries);

  // Hex authority key -> hostname, resolved by comparing bytes across encodings.
  const validatorNames = new Map<string, string>();
  for (const request of requests) {
    for (const duty of request.duties) {
      for (const key of duty.assignedValidators) {
        if (validatorNames.has(key)) continue;
        const node = cluster.nodes.find((n) => hexEqualsBase64(key, n.authorityPubkey));
        if (node) validatorNames.set(key, node.hostname);
      }
    }
  }

  const active = requests.filter((request) => request.isActive);
  const totalDuties = requests.reduce((sum, request) => sum + request.duties.length, 0);
  const totalMissed = [...missedDuties.values()].reduce((sum, rounds) => sum + rounds.length, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label}</div>
          <h1 className="page-title">REX — Rialo Extended Execution</h1>
          <p className="page-sub">
            The part of Rialo that reaches outside the chain: WASM components running in a trusted execution
            environment, allowed to make HTTP and WebSocket calls, with their results settled on chain.
          </p>
        </div>
      </div>

      <div className="stats">
        <Stat label="Requests" value={groupDigits(requests.length)} note={`for this creator`} accent />
        <Stat
          label="Active"
          value={groupDigits(active.length)}
          note={active.length === 0 ? "none running" : plural(active.length, "subscription")}
        />
        <Stat label="Scheduled duties" value={groupDigits(totalDuties)} note="across all requests" />
        <Stat
          label="Missed duties"
          value={groupDigits(totalMissed)}
          note={totalMissed === 0 ? "clean" : "attestation gaps"}
        />
        <Stat
          label="TEE key epoch"
          value={secret === null ? "—" : groupDigits(secret.epoch)}
          note={secret === null ? "unavailable" : `version ${groupDigits(secret.version)}`}
        />
      </div>

      <div className="stack">
        <Panel title="How it works">
          <div className="panel-body prose">
            <p>
              A normal blockchain program cannot call the outside world: every validator must reach the same
              result from the same inputs, and a web request is not deterministic. Rialo&apos;s answer is to
              move the non-deterministic part into an attested enclave. A component compiled to WASM runs
              inside a TEE, performs the network call, and the enclave&apos;s attestation is what the chain
              verifies — not the response itself.
            </p>
            <p>
              A <strong>REX request</strong> is the standing subscription: a component, an interval, and a
              number of validators that must each independently perform the run. Every scheduled run is a{" "}
              <strong>duty</strong>, assigned to specific validators ahead of time. A validator that fails to
              produce its attestation on time records a <strong>missed duty</strong>, which is queryable —
              so the reliability of an off-chain feed is public rather than a matter of trust.
            </p>
            <p>
              Inputs can be encrypted to the enclave with HPKE using the network&apos;s secret-sharing
              public key, so a request can carry an API credential without publishing it on chain.
            </p>
          </div>
        </Panel>

        <Panel title="On-chain components">
          <div className="panel-body">
            <dl className="dl">
              <dt>REX processor</dt>
              <dd>
                <Hash value={REX_PROCESSOR} kind="address" full copy />
                <div className="dim" style={{ fontSize: 11 }}>
                  {processor === null ? (
                    "Not present on this network."
                  ) : (
                    <>
                      Account data decodes to <code>{nativeProgramName(processor) ?? "—"}</code> ·{" "}
                      {formatBytes(processor.space)} · owned by the native loader, so it is built into the
                      runtime rather than deployed.
                    </>
                  )}
                </div>
              </dd>

              <dt>Secret-sharing key</dt>
              <dd>
                {secret === null ? (
                  <span className="dim">unavailable</span>
                ) : (
                  <>
                    {secret.pubkey}
                    <div className="dim" style={{ fontSize: 11 }}>
                      Epoch {groupDigits(secret.epoch)}, version {groupDigits(secret.version)}. Hex-encoded,
                      unlike the base58 keys used for accounts. This is the key inputs are encrypted to.
                    </div>
                  </>
                )}
              </dd>

              <dt>Validators</dt>
              <dd>
                {cluster.nodes.length} in the set ·{" "}
                <Link className="hash" href="/validators">
                  view validators →
                </Link>
              </dd>
            </dl>
          </div>
        </Panel>

        <Panel title="Look up a creator">
          <div className="panel-body">
            <form className="field" method="get">
              <input
                className="field-input"
                type="text"
                name="creator"
                defaultValue={requested || creator}
                placeholder="Creator address (base58)"
                spellCheck={false}
                autoComplete="off"
                aria-label="REX request creator address"
              />
              <button className="button" type="submit">
                Look up
              </button>
            </form>
            {invalidInput ? (
              <div style={{ marginTop: 10, color: "var(--error)", fontSize: 12 }}>
                &ldquo;{shorten(requested, 12, 8)}&rdquo; is not a base58 address — showing the sample
                creator instead.
              </div>
            ) : null}
            <div className="dim" style={{ marginTop: 10, fontSize: 11 }}>
              Showing <Hash value={creator} kind="address" full />
              {requested === "" ? " — a creator with live activity on devnet, shown so this page is never empty." : ""}
            </div>
          </div>
        </Panel>

        <Panel title={`REX requests (${requests.length})`} live={active.length > 0}>
          {requests.length === 0 ? (
            <div className="panel-body">
              <Notice title="No REX requests" tone="warn">
                This address has not created any REX requests on {NETWORKS[net].label}. Try the sample
                creator, or paste an address you know has registered a component.
              </Notice>
            </div>
          ) : (
            <RexRequestList
              requests={requests}
              missedDuties={missedDuties}
              validatorNames={validatorNames}
            />
          )}
        </Panel>

        <Notice title="Why REX has its own page">
          Every other view in this explorer has a Solana equivalent. This one does not. Reactive
          transactions and TEE-hosted components are the two things Rialo adds to the execution model, and
          the RPC surface exposes both — REX schedules here, and the causal transaction tree on any
          transaction page. An explorer that only showed blocks and balances would be showing the parts of
          Rialo that are least interesting.
        </Notice>
      </div>
    </>
  );
}
