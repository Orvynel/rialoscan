import { AutoRefresh } from "@/components/AutoRefresh";
import { Hash } from "@/components/Hash";
import { TimeAgo } from "@/components/TimeAgo";
import { Empty, Panel, Stat } from "@/components/Panel";
import { formatRate, groupDigits, plural, timeAgo } from "@/lib/format";
import { getBlockHeight, getBlocks, getRecentTransactions } from "@/lib/chain";
import { fetchedAt } from "@/lib/rpc";
import { requireNetwork } from "@/lib/host";
import { NETWORKS } from "@/lib/networks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Blocks" };

/**
 * How many heights to list. Rialo has no lightweight block query — `getBlock`
 * always returns every transaction in full — so per-block detail cannot be
 * fetched for a list. It comes from the transaction feed instead, and the feed
 * only reaches as far back as its last 100 transactions. How far that is depends
 * entirely on transaction density, which is not stable: within one day devnet
 * went from 3 transactions per block (36 heights of reach) to 1 (100 heights),
 * and testnet from ~65 to 1 without even changing node build. So the window is
 * measured per request rather than assumed, and never pads the page with rows
 * nothing can describe.
 */
const WINDOW_MAX = 50;
const WINDOW_MIN = 16;
/** Heights to show below the feed's reach, so the list reads as a sequence. */
const WINDOW_TAIL = 8;

function maxOf(values: bigint[]): bigint | null {
  return values.length === 0 ? null : values.reduce((a, b) => (b > a ? b : a));
}

function minOf(values: bigint[]): bigint | null {
  return values.length === 0 ? null : values.reduce((a, b) => (b < a ? b : a));
}

export default async function BlocksPage() {
  const net = await requireNetwork();

  // Read the height and the feed together. Devnet produces blocks fast enough
  // that awaiting the height first and the feed second leaves the feed
  // describing blocks above the window the height anchored — which is why this
  // page used to show a column of dashes on a chain doing 3 txs per block.
  const [tip, recent] = await Promise.all([
    getBlockHeight(net).catch(() => null),
    getRecentTransactions(net).catch(() => []),
  ]);

  const feedHeights = recent
    .map((tx) => tx.blockHeight)
    .filter((h): h is bigint => h !== null);
  const feedMax = maxOf(feedHeights);
  const feedMin = minOf(feedHeights);

  // Whichever source saw further. They are read in the same round trip, so they
  // normally agree to within a block or two; taking the max keeps the newest
  // rows describable no matter which one landed first.
  const head = maxOf([tip, feedMax].filter((h): h is bigint => h !== null));

  const reach = feedMax !== null && feedMin !== null ? Number(feedMax - feedMin) + 1 : 0;
  const windowSize = Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, reach + WINDOW_TAIL));

  const heights =
    head === null ? [] : await getBlocks(net, Number(head) - (windowSize - 1), Number(head));

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
            The most recent {ordered.length} block heights, taken from <code>getBlocks</code> so the
            sequence is authoritative even where the transaction feed does not reach.
          </p>
        </div>
      </div>

      <div className="stats">
        <Stat label="Head" value={head === null ? "—" : groupDigits(head)} accent />
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
                    <Hash value={height.toString()} kind="block" full />
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
          Transaction counts and times come from the latest 100 transactions, which reach back{" "}
          {reach === 0 ? "no blocks" : `${reach} ${plural(reach, "block")}`} and cover {covered.length} of
          these {ordered.length}. A dash means the block falls outside that window — not that it is empty.
          Rialo has no way to ask for a block without its full transaction list, so covering the rest would
          cost one whole-block request per row — which has meant anything from a kilobyte to 91 KB and five
          seconds per block, depending on the node build. Open a block to read its transactions directly.
        </div>
      </Panel>
    </>
  );
}
