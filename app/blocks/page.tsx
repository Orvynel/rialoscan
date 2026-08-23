import { AutoRefresh } from "@/components/AutoRefresh";
import { Hash } from "@/components/Hash";
import { TimeAgo } from "@/components/TimeAgo";
import { Empty, Panel, Stat } from "@/components/Panel";
import { formatRate, groupDigits, plural, timeAgo } from "@/lib/format";
import { getBlockHeight, getBlocks, getRecentTransactions } from "@/lib/chain";
import { fetchedAt } from "@/lib/rpc";
import { NETWORKS, resolveNetwork } from "@/lib/networks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Blocks" };

const WINDOW = 50;

export default async function BlocksPage({ searchParams }: { searchParams: Promise<{ net?: string }> }) {
  const net = resolveNetwork((await searchParams).net);

  const tip = await getBlockHeight(net).catch(() => null);

  const [heights, recent] = await Promise.all([
    tip === null ? Promise.resolve([]) : getBlocks(net, Number(tip) - (WINDOW - 1), Number(tip)),
    getRecentTransactions(net).catch(() => []),
  ]);

  const now = fetchedAt();

  // The transaction feed is the only cheap source of per-block counts and times:
  // fetching 50 blocks would be 50 round trips for data we already have.
  const summaries = new Map<string, { count: number; timeMs: number | null }>();
  for (const tx of recent) {
    if (tx.blockHeight === null) continue;
    const key = tx.blockHeight.toString();
    const existing = summaries.get(key);
    if (existing) {
      existing.count += 1;
      if (tx.blockTimeMs !== null && (existing.timeMs === null || tx.blockTimeMs > existing.timeMs)) {
        existing.timeMs = tx.blockTimeMs;
      }
    } else {
      summaries.set(key, { count: 1, timeMs: tx.blockTimeMs });
    }
  }

  const ordered = [...heights].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const covered = ordered.filter((h) => summaries.has(h.toString()));
  const times = recent.map((tx) => tx.blockTimeMs).filter((t): t is number => t !== null);
  const windowMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : null;
  const blockRate =
    windowMs && windowMs > 0 && covered.length > 1
      ? (Number(covered[0]) - Number(covered[covered.length - 1])) / (windowMs / 1000)
      : null;

  return (
    <>
      <AutoRefresh intervalMs={6000} />

      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label}</div>
          <h1 className="page-title">Blocks</h1>
          <p className="page-sub">
            The last {WINDOW} block heights, taken from <code>getBlocks</code> so the sequence is
            authoritative even where the transaction feed does not reach.
          </p>
        </div>
      </div>

      <div className="stats">
        <Stat label="Head" value={tip === null ? "—" : groupDigits(tip)} accent />
        <Stat label="Window" value={groupDigits(ordered.length)} note={`${plural(ordered.length, "block")} listed`} />
        <Stat
          label="Block rate"
          value={blockRate === null ? "—" : formatRate(blockRate)}
          note={blockRate === null ? "not enough samples" : "blocks/s"}
        />
        <Stat
          label="Detail coverage"
          value={ordered.length === 0 ? "—" : `${covered.length}/${ordered.length}`}
          note="blocks in the tx feed"
        />
      </div>

      <Panel title="Recent blocks" live>
        {ordered.length === 0 ? (
          <Empty>No blocks returned</Empty>
        ) : (
          <div className="rows">
            <div className="row row-block row-head">
              <span>Height</span>
              <span>Transactions</span>
              <span>Age</span>
            </div>
            {ordered.map((height) => {
              const summary = summaries.get(height.toString());
              return (
                <div key={height.toString()} className="row row-block">
                  <span className="row-primary">
                    <Hash value={height.toString()} net={net} kind="block" full />
                  </span>
                  <span className="row-secondary">
                    {summary ? `${summary.count} ${plural(summary.count, "tx", "txs")}` : <span className="dim">—</span>}
                  </span>
                  <span className="row-time">
                    {summary && summary.timeMs !== null ? (
                      <TimeAgo epochMs={summary.timeMs} initial={timeAgo(summary.timeMs, now)} />
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="panel-foot">
          Transaction counts and times come from the latest 100 transactions, which covers roughly{" "}
          {covered.length} of these blocks. A dash means the block exists but falls outside that window —
          not that it is empty. Open a block to read its transactions directly.
        </div>
      </Panel>
    </>
  );
}
