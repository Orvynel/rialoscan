import { notFound } from "next/navigation";
import Link from "next/link";
import { Hash } from "@/components/Hash";
import { Logs } from "@/components/Logs";
import { DataBlob } from "@/components/DataBlob";
import { Empty, Notice, Panel, Stat } from "@/components/Panel";
import { WorkflowTree } from "@/components/WorkflowTree";
import { CopyButton } from "@/components/CopyButton";
import {
  formatCompact,
  formatRlo,
  formatUtc,
  formatUtcWithMillis,
  groupDigits,
  looksLikeSignature,
  plural,
  timeAgo,
} from "@/lib/format";
import { getBlock, getTransaction, getWorkflowLineage } from "@/lib/chain";
import { accountRoles, roleLabel } from "@/lib/message";
import { resolvePrograms, type ProgramInfo } from "@/lib/programs";
import { requireNetwork } from "@/lib/host";
import { NETWORKS } from "@/lib/networks";

type Props = {
  params: Promise<{ signature: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { signature } = await params;
  return { title: `Transaction ${signature.slice(0, 12)}…` };
}

export default async function TransactionPage({ params }: Props) {
  const { signature: raw } = await params;
  const net = await requireNetwork();
  const signature = decodeURIComponent(raw);

  if (!looksLikeSignature(signature)) notFound();

  const tx = await getTransaction(net, signature);
  if (!tx) notFound();

  const message = tx.transaction.message;
  const programIndexes = message.instructions.map((ix) => ix.programIdIndex);
  const roles = accountRoles(message.accountKeys, message.header, programIndexes);

  const [lineage, block, programs] = await Promise.all([
    getWorkflowLineage(net, signature),
    // `getTransaction` returns `block_time: null`; the containing block is the
    // only place the timestamp exists.
    tx.blockHeight === null ? Promise.resolve(null) : getBlock(net, tx.blockHeight),
    resolvePrograms(net, programIndexes.map((i) => message.accountKeys[i] ?? "")),
  ]);

  const blockTimeMs = block?.blockTimeMs ?? null;
  const ok = tx.meta?.err === null || tx.meta?.err === undefined;
  const logs = tx.meta?.logMessages ?? [];

  // Resolve the lineage's own program ids too, so tree chips are labelled.
  const lineagePrograms = lineage
    ? await resolvePrograms(net, lineage.nodes.flatMap((n) => n.programIds))
    : new Map<string, ProgramInfo>();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo · {NETWORKS[net].label} · Transaction</div>
          <h1 className="page-title mono" style={{ fontSize: 19, overflowWrap: "anywhere" }}>
            {signature}
          </h1>
          <p className="page-sub">
            {blockTimeMs === null ? "Time not reported by the node" : `${formatUtc(blockTimeMs)} · ${timeAgo(blockTimeMs)} ago`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="badge" data-tone={ok ? "ok" : "error"}>
            {ok ? "success" : "failed"}
          </span>
          <CopyButton value={signature} label="Copy signature" />
        </div>
      </div>

      <div className="stats">
        <Stat label="Status" value={ok ? "Success" : "Failed"} accent={ok} />
        <Stat
          label="Block"
          value={
            tx.blockHeight === null ? (
              "—"
            ) : (
              <Hash value={tx.blockHeight.toString()} kind="block" full />
            )
          }
          note={tx.blockHeight === null ? "not reported" : undefined}
        />
        <Stat
          label="Fee"
          value={`${formatRlo(tx.meta?.fee ?? 0n)} RLO`}
          note={`${groupDigits(tx.meta?.fee ?? 0n)} kelvin`}
        />
        <Stat
          label="Compute units"
          value={formatCompact(tx.meta?.computeUnitsConsumed ?? 0n)}
        />
        <Stat
          label="Instructions"
          value={groupDigits(message.instructions.length)}
          note={`${message.accountKeys.length} ${plural(message.accountKeys.length, "account")}`}
        />
      </div>

      <div className="stack">
        <Panel title="Overview">
          <div className="panel-body">
            <dl className="dl">
              <dt>Signature</dt>
              <dd>
                {signature} <CopyButton value={signature} label="Copy signature" />
              </dd>

              {tx.transaction.signatures.length > 1 ? (
                <>
                  <dt>Other signatures</dt>
                  <dd>
                    {tx.transaction.signatures.slice(1).map((sig) => (
                      <div key={sig}>{sig}</div>
                    ))}
                  </dd>
                </>
              ) : null}

              <dt>Valid from</dt>
              <dd>
                {formatUtcWithMillis(tx.transaction.validFromMs)}
                <div className="dim" style={{ fontSize: 11 }}>
                  Rialo&apos;s replay window. It replaces Solana&apos;s recent blockhash — a transaction is
                  only accepted at or after this instant, paired with a validator config-hash prefix.
                </div>
              </dd>

              <dt>Block time</dt>
              <dd>{blockTimeMs === null ? "— (node returns null for block_time)" : formatUtc(blockTimeMs)}</dd>

              <dt>Fee payer</dt>
              <dd>
                {roles[0] ? <Hash value={roles[0].address} kind="address" full copy /> : "—"}
              </dd>

              <dt>Signers required</dt>
              <dd>
                {message.header.numRequiredSignatures} ·{" "}
                <span className="dim">
                  {message.header.numReadonlySignedAccounts} readonly signed,{" "}
                  {message.header.numReadonlyUnsignedAccounts} readonly unsigned
                </span>
              </dd>

              {!ok ? (
                <>
                  <dt>Error</dt>
                  <dd style={{ color: "var(--error)" }}>{JSON.stringify(tx.meta?.err)}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </Panel>

        <Panel title={`Accounts (${roles.length})`}>
          {roles.length === 0 ? (
            <Empty>No accounts referenced</Empty>
          ) : (
            <div className="rows">
              <div className="row row-role row-head">
                <span>#</span>
                <span>Address</span>
                <span>Role</span>
              </div>
              {roles.map((role) => {
                const program = programs.get(role.address);
                return (
                  <div key={role.index} className="row row-role">
                    <span className="row-secondary">{role.index}</span>
                    <span className="row-primary" style={{ overflow: "hidden" }}>
                      <Hash
                        value={role.address}
                        kind="address"
                        head={14}
                        tail={12}
                        label={program?.label ? `${program.label}` : undefined}
                      />
                      {program?.label ? (
                        <span className="dim" style={{ marginLeft: 8, fontSize: 11 }}>
                          {role.address}
                        </span>
                      ) : null}
                    </span>
                    <span className="row-secondary">{roleLabel(role)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="panel-foot">
            Roles are not stored per account — they are implied by each account&apos;s position in the
            message plus three header counters.
          </div>
        </Panel>

        <Panel title={`Instructions (${message.instructions.length})`}>
          {message.instructions.length === 0 ? (
            <Empty>No instructions</Empty>
          ) : (
            message.instructions.map((ix, index) => {
              const programAddress = message.accountKeys[ix.programIdIndex] ?? "";
              const program = programs.get(programAddress);
              return (
                <div key={index} className="ix">
                  <div className="ix-head">
                    <span className="ix-index">Instruction {index + 1}</span>
                    <span className="chips">
                      <Link
                        className="tag"
                        data-tone="accent"
                        href={`/address/${programAddress}`}
                        title={programAddress}
                      >
                        {program?.label ?? `${programAddress.slice(0, 10)}…`}
                      </Link>
                      {program?.native ? <span className="tag">native</span> : null}
                      <span className="tag">
                        {ix.accounts.length} {plural(ix.accounts.length, "account")}
                      </span>
                    </span>
                  </div>

                  {ix.accounts.length > 0 ? (
                    <div className="chips" style={{ marginBottom: 10 }}>
                      {ix.accounts.map((accountIndex, position) => {
                        const role = roles[accountIndex];
                        return (
                          <span key={position} className="tag" title={role ? roleLabel(role) : undefined}>
                            #{accountIndex}{" "}
                            {role ? (
                              <Hash value={role.address} kind="address" head={4} tail={4} />
                            ) : (
                              "unknown"
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

                  <DataBlob value={ix.data} />
                </div>
              );
            })
          )}
        </Panel>

        {logs.length > 0 ? (
          <Panel title={`Program logs (${logs.length})`}>
            <Logs lines={logs} />
          </Panel>
        ) : null}

        <Panel title="Workflow lineage">
          {lineage && lineage.root ? (
            <>
              <WorkflowTree
                root={lineage.root}
                currentId={signature}
                programs={lineagePrograms}
              />
              <div className="panel-foot">
                {lineage.nodes.length} {plural(lineage.nodes.length, "node")} ·{" "}
                {lineage.leaves.length} {plural(lineage.leaves.length, "leaf", "leaves")}
                {lineage.truncated ? ` · truncated (${lineage.truncationReason})` : " · complete"}
              </div>
            </>
          ) : (
            <div className="panel-body">
              <Notice title="No reactive lineage">
                This transaction was submitted directly and did not register or fulfil an on-chain
                predicate, so it has no causal parent or children. Transactions that use Rialo&apos;s
                reactive execution show their full trigger tree here.
              </Notice>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
