import { AutoRefresh } from "@/components/AutoRefresh";
import { Hash } from "@/components/Hash";
import { Empty, Notice, Panel, Stat } from "@/components/Panel";
import { formatDuration, formatRlo, formatUtc, groupDigits, plural } from "@/lib/format";
import { sameKey } from "@/lib/base58";
import { multiaddrText } from "@/lib/multiaddr";
import {
  getCluster,
  getConnectedFullNodes,
  getConnectedValidators,
  getValidatorAccounts,
  getValidatorHealth,
} from "@/lib/chain";
import { requireNetwork } from "@/lib/host";
import { NETWORKS } from "@/lib/networks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Validators" };

export default async function ValidatorsPage() {
  const net = await requireNetwork();

  const [cluster, accounts, connected, fullNodes, health] = await Promise.all([
    getCluster(net).catch(() => ({ version: 0n, nodes: [] })),
    getValidatorAccounts(net).catch(() => []),
    getConnectedValidators(net).catch(() => []),
    getConnectedFullNodes(net).catch(() => []),
    getValidatorHealth(net).catch(() => null),
  ]);

  const nodes = cluster.nodes;
  const online = new Set(connected);
  const byHostname = new Map(accounts.map((account) => [account.hostname, account]));

  const totalStake = nodes.reduce((sum, node) => sum + node.stake, 0n);
  const totalCommission = accounts.reduce((sum, account) => sum + account.commission, 0n);
  const rounds = nodes.map((node) => node.lastCommittedRound).filter((r): r is bigint => r !== null);
  const topRound = rounds.length > 0 ? rounds.reduce((a, b) => (a > b ? a : b)) : null;
  const unbonding = accounts[0]?.unbondingPeriods[0]?.ms ?? null;

  return (
    <>
      <AutoRefresh intervalMs={8000} />

      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label}</div>
          <h1 className="page-title">Validators</h1>
          <p className="page-sub">
            The validator set as the node reports it, joined from two endpoints that describe the same
            machines differently.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="badge" data-tone={health === "ok" ? "ok" : "error"}>
            {health === "ok" ? <span className="pulse" aria-hidden="true" /> : null}
            {health ?? "unreachable"}
          </span>
          <span className="badge">cluster v{groupDigits(cluster.version)}</span>
        </div>
      </div>

      <div className="stats">
        <Stat
          label="Validators"
          value={nodes.length === 0 ? "—" : `${online.size}/${nodes.length}`}
          note={`${online.size} ${plural(online.size, "connection")}`}
          accent
        />
        <Stat label="Total stake" value={groupDigits(totalStake)} note="stake units, not kelvin" />
        <Stat
          label="Accrued commission"
          value={`${formatRlo(totalCommission)} RLO`}
          note={`${groupDigits(totalCommission)} kelvin`}
        />
        <Stat
          label="Consensus round"
          value={topRound === null ? "—" : groupDigits(topRound)}
          note="highest committed"
        />
        <Stat
          label="Full nodes"
          value={groupDigits(fullNodes.length)}
          note={fullNodes.length === 0 ? "none connected" : "connected"}
        />
      </div>

      <div className="stack">
        <Panel title={`Validator set (${nodes.length})`} live>
          {nodes.length === 0 ? (
            <Empty>No validators returned</Empty>
          ) : (
            <div className="rows">
              <div className="row row-val row-head">
                <span>Node</span>
                <span>Identity</span>
                <span>Round</span>
                <span>Status</span>
              </div>
              {nodes.map((node, index) => {
                const account = byHostname.get(node.hostname);
                const isOnline = online.has(index);
                const behind = topRound !== null && node.lastCommittedRound !== null
                  ? topRound - node.lastCommittedRound
                  : null;
                return (
                  <div key={node.hostname || index} className="row row-val">
                    <span className="row-primary" style={{ minWidth: 0 }}>
                      {node.hostname || `node ${index}`}
                      <div className="row-secondary" style={{ whiteSpace: "normal" }}>
                        {node.address}
                      </div>
                    </span>
                    <span className="row-secondary" style={{ minWidth: 0, whiteSpace: "normal" }}>
                      {account ? (
                        <Hash value={account.pubkey} kind="address" head={8} tail={8} />
                      ) : (
                        <span className="dim">no on-chain account</span>
                      )}
                      <div className="dim" style={{ fontSize: 10.5 }}>
                        stake {groupDigits(node.stake)}
                        {account ? ` · commission ${formatRlo(account.commission)} RLO` : ""}
                      </div>
                    </span>
                    <span className="row-secondary">
                      {node.lastCommittedRound === null ? "—" : groupDigits(node.lastCommittedRound)}
                      {behind !== null && behind > 0n ? (
                        <div className="dim" style={{ fontSize: 10.5 }}>−{groupDigits(behind)}</div>
                      ) : null}
                    </span>
                    <span className="row-secondary">
                      <span className="badge" data-tone={isOnline ? "ok" : "warn"}>
                        {isOnline ? "online" : "not connected"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="panel-foot">
            <code>getConnectedValidators</code> returns indices into the cluster node list, not public
            keys, so &ldquo;online&rdquo; is resolved positionally.
          </div>
        </Panel>

        {accounts.length > 0 ? (
          <Panel title="On-chain validator accounts">
            {accounts.map((account) => {
              const node = nodes.find((n) => n.hostname === account.hostname);
              const keysMatch = node ? sameKey(account.networkKey, node.networkPubkey) : false;
              return (
                <div key={account.pubkey} className="ix">
                  <div className="ix-head">
                    <span className="ix-index">{account.hostname || "validator"}</span>
                    <span className="chips">
                      <span className="tag" data-tone="accent">
                        stake {groupDigits(account.stake)}
                      </span>
                      <span className="tag">rate {groupDigits(account.commissionRate)}</span>
                      {account.newCommissionRate !== null ? (
                        <span className="tag" data-tone="warn">
                          pending rate {groupDigits(account.newCommissionRate)}
                        </span>
                      ) : null}
                      {account.earliestShutdown !== null ? (
                        <span className="tag" data-tone="warn">shutdown scheduled</span>
                      ) : null}
                    </span>
                  </div>

                  <dl className="dl">
                    <dt>Validator account</dt>
                    <dd>
                      <Hash value={account.pubkey} kind="address" full copy />
                    </dd>

                    <dt>Registered address</dt>
                    <dd>
                      {multiaddrText(account.addressRaw)}
                      {node && node.address !== multiaddrText(account.addressRaw) ? (
                        <div className="dim" style={{ fontSize: 11 }}>
                          <code>getClusterNodes</code> reports {node.address} for the same validator — the
                          consensus port and the registered port are different ports, not a mismatch.
                        </div>
                      ) : null}
                    </dd>

                    <dt>Subdag sync</dt>
                    <dd>{multiaddrText(account.subdagSyncAddressRaw)}</dd>

                    <dt>Signing key</dt>
                    <dd>{account.signingKey}</dd>

                    <dt>Withdrawal key</dt>
                    <dd>
                      {account.withdrawalKey}
                      {account.withdrawalKey === account.signingKey ? (
                        <div className="dim" style={{ fontSize: 11 }}>
                          Same as the signing key on this network.
                        </div>
                      ) : null}
                    </dd>

                    <dt>Network key</dt>
                    <dd>
                      {account.networkKey}
                      {node ? (
                        <div className="dim" style={{ fontSize: 11 }}>
                          {keysMatch ? "Identical to" : "Does not match"} <code>networkPubkey</code>{" "}
                          <code>{node.networkPubkey}</code> from <code>getClusterNodes</code> — the same 32
                          bytes, base58 in one endpoint and base64 in the other.
                        </div>
                      ) : null}
                    </dd>

                    <dt>Protocol key</dt>
                    <dd>{account.protocolKey}</dd>

                    <dt>Commission</dt>
                    <dd>
                      {formatRlo(account.commission)} RLO accrued ·{" "}
                      {groupDigits(account.commission)} kelvin
                      <div className="dim" style={{ fontSize: 11 }}>
                        Rate is reported as the integer {groupDigits(account.commissionRate)}; the node does
                        not state its unit, so it is shown unscaled rather than guessed as a percentage.
                      </div>
                    </dd>

                    <dt>Unbonding</dt>
                    <dd>
                      {account.unbondingPeriods.length === 0
                        ? "—"
                        : account.unbondingPeriods
                            .map((period) => `epoch ${period.epoch}: ${formatDuration(period.ms)}`)
                            .join(" · ")}
                    </dd>

                    <dt>Registered</dt>
                    <dd className={account.registrationTimeMs === null ? "dim" : undefined}>
                      {account.registrationTimeMs === null
                        ? "0 — genesis validator, never re-registered"
                        : formatUtc(account.registrationTimeMs)}
                    </dd>
                  </dl>
                </div>
              );
            })}
          </Panel>
        ) : null}

        <Notice title="Two views of one validator">
          <code>getClusterNodes</code> describes live gossip state — the consensus multiaddr and the last
          round each node committed. <code>getValidatorAccounts</code> describes on-chain registration —
          stake, commission, unbonding, and the addresses the validator itself published. The two disagree
          on encoding (base64 vs base58 for identical keys) and on port
          {unbonding !== null ? `, and the unbonding period is ${formatDuration(unbonding)}` : ""}. RialoScan
          joins them on hostname, which is the only field that is stable across both.
        </Notice>
      </div>
    </>
  );
}
