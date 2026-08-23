import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash } from "@/components/Hash";
import { Logs } from "@/components/Logs";
import { Empty, Notice, Panel, Stat } from "@/components/Panel";
import { DataBlob } from "@/components/DataBlob";
import { formatCompact, formatRlo, formatUtc, groupDigits, plural, timeAgo } from "@/lib/format";
import { getBlock, getBlockHeight } from "@/lib/chain";
import { resolvePrograms } from "@/lib/programs";
import { resolveNetwork, withNetwork, NETWORKS } from "@/lib/networks";
import type { BlockTransaction } from "@/lib/chain";

type Props = {
  params: Promise<{ height: string }>;
  searchParams: Promise<{ net?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { height } = await params;
  return { title: `Block ${height}` };
}

/** Program address for an instruction, resolved through the message's account table. */
function programOf(tx: BlockTransaction, programIdIndex: number): string {
  return tx.transaction.message.accountKeys[programIdIndex] ?? "";
}

export default async function BlockPage({ params, searchParams }: Props) {
  const { height: heightParam } = await params;
  const net = resolveNetwork((await searchParams).net);

  if (!/^\d+$/.test(heightParam)) notFound();
  const height = BigInt(heightParam);

  const [block, tip] = await Promise.all([
    getBlock(net, height),
    getBlockHeight(net).catch(() => null),
  ]);
  if (!block) notFound();

  const txs = block.transactions;
  const totalFees = txs.reduce((sum, tx) => sum + (tx.meta?.fee ?? 0n), 0n);
  const totalCompute = txs.reduce((sum, tx) => sum + (tx.meta?.computeUnitsConsumed ?? 0n), 0n);
  const failed = txs.filter((tx) => tx.meta?.err !== null && tx.meta?.err !== undefined).length;

  const programs = await resolvePrograms(
    net,
    txs.flatMap((tx) => tx.transaction.message.instructions.map((ix) => programOf(tx, ix.programIdIndex))),
  );

  const hasPrev = height > 0n;
  const hasNext = tip === null || height < tip;

  // Logs are per-transaction, but a single-transaction block reads better with
  // them inline than behind another click.
  const soleTx = txs.length === 1 ? txs[0] : null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label} · Block</div>
          <h1 className="page-title mono">{groupDigits(block.blockHeight)}</h1>
          <p className="page-sub">
            {formatUtc(block.blockTimeMs)} · {timeAgo(block.blockTimeMs)} ago
          </p>
        </div>
        <div className="pager">
          {hasPrev ? (
            <Link className="pager-link" href={withNetwork(`/block/${height - 1n}`, net)}>
              ← {groupDigits(height - 1n)}
            </Link>
          ) : (
            <span className="pager-link" aria-disabled="true">
              ← start of chain
            </span>
          )}
          {hasNext ? (
            <Link className="pager-link" href={withNetwork(`/block/${height + 1n}`, net)}>
              {groupDigits(height + 1n)} →
            </Link>
          ) : (
            <span className="pager-link" aria-disabled="true">
              head of chain →
            </span>
          )}
        </div>
      </div>

      <div className="stats">
        <Stat label="Height" value={groupDigits(block.blockHeight)} accent />
        <Stat
          label="Transactions"
          value={groupDigits(txs.length)}
          note={failed > 0 ? `${failed} failed` : txs.length > 0 ? "all succeeded" : undefined}
        />
        <Stat
          label="Fees"
          value={`${formatRlo(totalFees)} RLO`}
          note={`${groupDigits(totalFees)} kelvin`}
        />
        <Stat
          label="Compute units"
          value={formatCompact(totalCompute)}
          note={txs.length > 0 ? `${groupDigits(totalCompute / BigInt(txs.length))} avg` : undefined}
        />
        <Stat
          label="Block time"
          value={block.blockTimeMs === null ? "—" : timeAgo(block.blockTimeMs)}
          note={block.blockTimeMs === null ? "not reported" : "ago"}
        />
      </div>

      <div className="stack">
        <Panel title={`Transactions (${txs.length})`}>
          {txs.length === 0 ? (
            <Empty>This block contains no transactions</Empty>
          ) : (
            <div className="rows">
              <div className="row row-ix row-head">
                <span>Signature</span>
                <span>Programs</span>
                <span>Fee</span>
                <span>Status</span>
              </div>
              {txs.map((tx, index) => {
                const signature = tx.transaction.signatures[0] ?? "";
                const ixPrograms = [
                  ...new Set(tx.transaction.message.instructions.map((ix) => programOf(tx, ix.programIdIndex))),
                ];
                const ok = tx.meta?.err === null || tx.meta?.err === undefined;
                return (
                  <div key={signature || index} className="row row-ix">
                    <span className="row-primary" style={{ overflow: "hidden" }}>
                      {signature ? (
                        <Hash value={signature} net={net} kind="tx" head={12} tail={10} />
                      ) : (
                        <span className="dim">unsigned</span>
                      )}
                    </span>
                    <span className="chips">
                      {ixPrograms.map((address) => (
                        <Link
                          key={address}
                          className="tag"
                          data-tone="accent"
                          href={withNetwork(`/address/${address}`, net)}
                          title={address}
                        >
                          {programs.get(address)?.label ?? `${address.slice(0, 8)}…`}
                        </Link>
                      ))}
                    </span>
                    <span className="row-secondary">{formatRlo(tx.meta?.fee ?? 0n)}</span>
                    <span className="row-secondary">
                      <span className="badge" data-tone={ok ? "ok" : "error"}>
                        {ok ? "ok" : "failed"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="panel-foot">
            {txs.length} {plural(txs.length, "transaction")} · fees are a flat 5,000 kelvin per signature on
            Rialo today
          </div>
        </Panel>

        {soleTx && soleTx.meta && soleTx.meta.logMessages.length > 0 ? (
          <Panel title="Program logs">
            <Logs lines={soleTx.meta.logMessages} />
          </Panel>
        ) : null}

        {soleTx && soleTx.transaction.message.instructions.length === 1 ? (
          <Panel title="Instruction data">
            <div className="ix">
              <DataBlob value={soleTx.transaction.message.instructions[0].data} />
            </div>
          </Panel>
        ) : null}

        <Notice title="On block identity">
          Rialo blocks carry no <code>recentBlockhash</code>. Replay protection is per transaction instead:
          a <code>validFrom</code> timestamp paired with a validator config-hash prefix. There are also no
          pre/post balance arrays, so per-account deltas cannot be shown for a block.
        </Notice>
      </div>
    </>
  );
}
