import { AutoRefresh } from "@/components/AutoRefresh";
import { Hash } from "@/components/Hash";
import { TimeAgo } from "@/components/TimeAgo";
import { Empty, Notice, Panel, Stat } from "@/components/Panel";
import { formatRate, formatUtc, groupDigits, plural, timeAgo } from "@/lib/format";
import { getRecentTransactions, getTransactionCount } from "@/lib/chain";
import { fetchedAt } from "@/lib/rpc";
import { requireNetwork } from "@/lib/host";
import { NETWORKS } from "@/lib/networks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const net = await requireNetwork();

  const [recent, total] = await Promise.all([
    getRecentTransactions(net).catch(() => []),
    getTransactionCount(net).catch(() => null),
  ]);

  const now = fetchedAt();

  const times = recent.map((tx) => tx.blockTimeMs).filter((t): t is number => t !== null);
  const windowMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : null;
  const rate = windowMs && windowMs > 0 ? (recent.length - 1) / (windowMs / 1000) : null;
  const blocks = new Set(recent.map((tx) => tx.blockHeight?.toString()).filter(Boolean));

  return (
    <>
      <AutoRefresh intervalMs={5000} />

      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label}</div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-sub">
            The live tail of the chain, newest first. This is the node&apos;s full transaction feed — it is
            not filtered or paginated, by design of the endpoint rather than by choice.
          </p>
        </div>
      </div>

      <div className="stats">
        <Stat
          label="Total transactions"
          value={total === null ? "—" : groupDigits(total.count)}
          accent
        />
        <Stat label="In feed" value={groupDigits(recent.length)} note="latest, newest first" />
        <Stat
          label="Throughput"
          value={rate === null ? "—" : formatRate(rate)}
          note={windowMs === null ? "not enough samples" : `tx/s over ${(windowMs / 1000).toFixed(1)}s`}
        />
        <Stat label="Distinct blocks" value={groupDigits(blocks.size)} note="in this window" />
      </div>

      <div className="stack">
        <Panel title="Live feed" live>
          {recent.length === 0 ? (
            <Empty>No transactions returned</Empty>
          ) : (
            <div className="rows">
              <div className="row row-sig row-head">
                <span>Signature</span>
                <span>Block</span>
                <span>Age</span>
              </div>
              {recent.map((tx) => (
                <div key={tx.signature} className="row row-sig">
                  <span className="row-primary" style={{ overflow: "hidden" }}>
                    <Hash value={tx.signature} kind="tx" head={16} tail={12} />
                  </span>
                  <span className="row-secondary">
                    {tx.blockHeight === null ? (
                      "—"
                    ) : (
                      <Hash value={tx.blockHeight.toString()} kind="block" full />
                    )}
                  </span>
                  <span className="row-time" title={formatUtc(tx.blockTimeMs)}>
                    <TimeAgo epochMs={tx.blockTimeMs} initial={timeAgo(tx.blockTimeMs, now)} />
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="panel-foot">
            {recent.length} {plural(recent.length, "transaction")} across {blocks.size}{" "}
            {plural(blocks.size, "block")}
          </div>
        </Panel>

        <Notice title="Why there is no pagination here" tone="warn">
          <code>getTransactions</code> accepts <code>signatures</code>, <code>limit</code> and{" "}
          <code>before</code>, but the node currently ignores all three: a real signature, an empty array
          and a bogus signature all return the same latest 100 transactions. Paging controls would imply
          history that cannot be fetched, so there are none. Look up a specific signature through search
          instead — <code>getTransaction</code> works correctly.
        </Notice>
      </div>
    </>
  );
}
