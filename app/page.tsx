import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Hash } from "@/components/Hash";
import { Empty, Notice, Panel, Stat } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import { formatCompact, formatRate, groupDigits, plural, timeAgo } from "@/lib/format";
import { NETWORKS, resolveNetwork, withNetwork } from "@/lib/networks";
import { loadOverview } from "@/lib/overview";

// Head-of-chain data: never serve a cached copy.
export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ net?: string }> }) {
  const net = resolveNetwork((await searchParams).net);
  const o = await loadOverview(net);
  const now = o.renderedAt;

  const healthy = o.health === "ok";
  const online = o.connectedValidators.length;
  const total = Math.max(o.nodes.length, o.validators.length, online);

  return (
    <>
      <AutoRefresh intervalMs={6000} />

      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label}</div>
          <h1 className="page-title">Network overview</h1>
          <p className="page-sub">{NETWORKS[net].note}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="badge" data-tone={healthy ? "ok" : "error"}>
            {healthy ? <span className="pulse" aria-hidden="true" /> : null}
            {o.health ?? "unreachable"}
          </span>
          {o.apiVersion ? <span className="badge">node {o.apiVersion}</span> : null}
        </div>
      </div>

      {o.errors.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <Notice title="Partial data" tone="warn">
            {o.errors.length} {plural(o.errors.length, "method")} failed on this render: {o.errors.join("; ")}
          </Notice>
        </div>
      ) : null}

      <div className="stats">
        <Stat
          label="Block height"
          value={o.blockHeight === null ? "—" : groupDigits(o.blockHeight)}
          note={o.rates.blocksPerSecond === null ? "rate unavailable" : `${formatRate(o.rates.blocksPerSecond)} blocks/s`}
          accent
        />
        <Stat
          label="Epoch"
          value={o.epoch === null ? "—" : groupDigits(o.epoch.epoch)}
          note={
            o.epoch === null
              ? undefined
              : o.epoch.slotsInEpochUnbounded
                ? "unbounded length"
                : `slot ${groupDigits(o.epoch.slotIndex)} of ${groupDigits(o.epoch.slotsInEpoch)}`
          }
        />
        <Stat
          label="Transactions"
          value={o.transactionCount === null ? "—" : formatCompact(o.transactionCount)}
          note={o.transactionCount === null ? undefined : `${groupDigits(o.transactionCount)} total`}
        />
        <Stat
          label="Throughput"
          value={o.rates.transactionsPerSecond === null ? "—" : formatRate(o.rates.transactionsPerSecond)}
          note={
            o.rates.windowMs === null
              ? "not enough samples"
              : `tx/s over last ${(o.rates.windowMs / 1000).toFixed(1)}s`
          }
        />
        <Stat
          label="Validators"
          value={total === 0 ? "—" : `${online}/${total}`}
          note={total === 0 ? undefined : `${online} connected`}
        />
      </div>

      <div className="grid-2">
        <Panel
          title="Latest blocks"
          live
          action={
            <Link className="panel-action" href={withNetwork("/blocks", net)}>
              View all →
            </Link>
          }
        >
          {o.blocks.length === 0 ? (
            <Empty>No recent blocks</Empty>
          ) : (
            <div className="rows">
              {o.blocks.map((block) => (
                <div key={block.height.toString()} className="row row-block">
                  <span className="row-primary">
                    <Hash value={block.height.toString()} net={net} kind="block" full />
                  </span>
                  <span className="row-secondary">
                    {block.transactionCount} {plural(block.transactionCount, "tx", "txs")}
                  </span>
                  <span className="row-time">
                    <TimeAgo epochMs={block.blockTimeMs} initial={timeAgo(block.blockTimeMs, now)} />
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="panel-body" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <span className="row-secondary">
              Derived from the latest {o.rates.sampleSize} transactions, so blocks with no transactions are not listed.
            </span>
          </div>
        </Panel>

        <Panel
          title="Latest transactions"
          live
          action={
            <Link className="panel-action" href={withNetwork("/txs", net)}>
              View all →
            </Link>
          }
        >
          {o.recent.length === 0 ? (
            <Empty>No recent transactions</Empty>
          ) : (
            <div className="rows">
              {o.recent.slice(0, 12).map((tx) => (
                <div key={tx.signature} className="row row-tx">
                  <span className="row-primary" style={{ overflow: "hidden" }}>
                    <Hash value={tx.signature} net={net} kind="tx" head={10} tail={8} />
                  </span>
                  <span className="row-secondary">
                    {tx.blockHeight === null ? "—" : groupDigits(tx.blockHeight)}
                  </span>
                  <span className="row-time">
                    <TimeAgo epochMs={tx.blockTimeMs} initial={timeAgo(tx.blockTimeMs, now)} />
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="panel-body" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <span className="row-secondary">
              The node returns the latest 100 transactions and ignores filter arguments.
            </span>
          </div>
        </Panel>
      </div>
    </>
  );
}
