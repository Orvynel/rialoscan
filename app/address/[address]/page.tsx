import { notFound } from "next/navigation";
import { Hash } from "@/components/Hash";
import { DataBlob } from "@/components/DataBlob";
import { CopyButton } from "@/components/CopyButton";
import { Empty, Notice, Panel, Stat } from "@/components/Panel";
import { RexRequestList } from "@/components/RexRequestList";
import {
  formatBytes,
  formatRlo,
  formatRloExact,
  formatUtc,
  groupDigits,
  looksLikeAddress,
  plural,
  timeAgo,
} from "@/lib/format";
import {
  ADDRESS_HISTORY_LIMIT,
  NATIVE_LOADER,
  getAccountInfo,
  getRexRequests,
  getSignaturesForAddress,
  nativeProgramName,
} from "@/lib/chain";
import { NETWORKS, resolveNetwork } from "@/lib/networks";

type Props = {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ net?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  return { title: `Account ${address.slice(0, 10)}…` };
}

/** Decode account data to text when it is text — native programs store their name. */
function asPrintableText(base64: string): string | null {
  if (!base64) return null;
  try {
    const text = Buffer.from(base64, "base64").toString("utf8").replace(/\0+$/, "");
    return text.length > 0 && /^[\x20-\x7e\n\t]+$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

export default async function AddressPage({ params, searchParams }: Props) {
  const { address: rawAddress } = await params;
  const net = resolveNetwork((await searchParams).net);
  const address = decodeURIComponent(rawAddress);

  if (!looksLikeAddress(address)) notFound();

  // `getAccountInfo` already carries the balance in `kelvin`, so there is no
  // separate `getBalance` call here — the node has no batching, and a redundant
  // round trip would only slow the page down.
  const [account, signatures, rexRequests] = await Promise.all([
    getAccountInfo(net, address),
    getSignaturesForAddress(net, address).catch(() => []),
    // Any address can be a REX request creator; an empty list is the common case.
    getRexRequests(net, address).catch(() => []),
  ]);

  const programName = nativeProgramName(account);
  const dataText = account ? asPrintableText(account.data[0]) : null;
  const kind = programName
    ? "Native program"
    : account?.executable
      ? "Program"
      : account
        ? "Account"
        : "Unknown account";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            Rialo · {NETWORKS[net].label} · {kind}
          </div>
          <h1 className="page-title mono" style={{ fontSize: 19, overflowWrap: "anywhere" }}>
            {programName ?? address}
          </h1>
          <p className="page-sub mono" style={{ fontSize: 12 }}>
            {programName ? address : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {account?.executable ? <span className="badge" data-tone="ok">executable</span> : null}
          {account?.rentExempt ? <span className="badge">rent exempt</span> : null}
          <CopyButton value={address} label="Copy address" />
        </div>
      </div>

      {!account ? (
        <Notice title="Account not found" tone="warn">
          The node has no account at this address. On Rialo, as on Solana, an address that has never
          received funds simply does not exist on chain — it is not an error.
        </Notice>
      ) : (
        <>
          <div className="stats">
            <Stat
              label="Balance"
              value={`${formatRlo(account.kelvin)} RLO`}
              note={`${groupDigits(account.kelvin)} kelvin`}
              accent
            />
            <Stat
              label="Owner"
              value={
                account.owner === NATIVE_LOADER ? (
                  "Native loader"
                ) : (
                  <Hash value={account.owner} net={net} kind="address" head={6} tail={6} />
                )
              }
            />
            <Stat label="Data size" value={formatBytes(account.space)} note={`${groupDigits(account.space)} bytes`} />
            <Stat
              label="Rent epoch"
              value={account.rentExempt ? "exempt" : account.rentEpoch === null ? "—" : groupDigits(account.rentEpoch)}
              note={account.rentExempt ? "u64::MAX sentinel" : undefined}
            />
            <Stat
              label="History"
              value={groupDigits(signatures.length)}
              note={
                signatures.length >= ADDRESS_HISTORY_LIMIT
                  ? `capped at ${ADDRESS_HISTORY_LIMIT} by the node`
                  : plural(signatures.length, "transaction")
              }
            />
          </div>

          <div className="stack">
            <Panel title="Account">
              <div className="panel-body">
                <dl className="dl">
                  <dt>Address</dt>
                  <dd>
                    {address} <CopyButton value={address} label="Copy address" />
                  </dd>

                  <dt>Balance</dt>
                  <dd>
                    {formatRloExact(account.kelvin)} RLO
                    <div className="dim" style={{ fontSize: 11 }}>
                      1 RLO = 1,000,000,000 kelvin
                    </div>
                  </dd>

                  <dt>Owner</dt>
                  <dd>
                    <Hash value={account.owner} net={net} kind="address" full />
                    {account.owner === NATIVE_LOADER ? (
                      <div className="dim" style={{ fontSize: 11 }}>
                        Owned by the native loader — this program is built into the runtime, not deployed.
                      </div>
                    ) : null}
                  </dd>

                  <dt>Executable</dt>
                  <dd>{account.executable ? "yes" : "no"}</dd>

                  <dt>Allocated</dt>
                  <dd>
                    {groupDigits(account.space)} bytes ({formatBytes(account.space)})
                  </dd>

                  {account.context ? (
                    <>
                      <dt>Read at slot</dt>
                      <dd>{groupDigits(account.context.slot)}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            </Panel>

            {account.data[0] ? (
              <Panel title="Account data">
                <div className="ix">
                  {dataText ? (
                    <>
                      <div className="ix-head">
                        <span className="ix-index">Decoded as UTF-8</span>
                        <span className="chips">
                          <span className="tag" data-tone="accent">
                            {dataText}
                          </span>
                        </span>
                      </div>
                      <div className="dim" style={{ fontSize: 11, marginBottom: 10 }}>
                        Native programs on Rialo store their own name as account data, which is how this
                        explorer labels them without any hardcoded address registry.
                      </div>
                    </>
                  ) : null}
                  <DataBlob value={account.data[0]} encoding={account.data[1]} />
                </div>
              </Panel>
            ) : null}

            {rexRequests.length > 0 ? (
              <Panel title={`REX requests created (${rexRequests.length})`}>
                <RexRequestList requests={rexRequests} net={net} />
              </Panel>
            ) : null}

            <Panel title="Transaction history">
              {signatures.length === 0 ? (
                <Empty>No transactions found for this address</Empty>
              ) : (
                <div className="rows">
                  <div className="row row-sig row-head">
                    <span>Signature</span>
                    <span>Block</span>
                    <span>Age</span>
                  </div>
                  {signatures.map((entry) => (
                    <div key={entry.signature} className="row row-sig">
                      <span className="row-primary" style={{ overflow: "hidden" }}>
                        <Hash value={entry.signature} net={net} kind="tx" head={14} tail={12} />
                      </span>
                      <span className="row-secondary">
                        {entry.blockHeight === null ? (
                          "—"
                        ) : (
                          <Hash value={entry.blockHeight.toString()} net={net} kind="block" full />
                        )}
                      </span>
                      <span className="row-time" title={formatUtc(entry.blockTimeMs)}>
                        {timeAgo(entry.blockTimeMs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="panel-foot">
                The node returns at most {ADDRESS_HISTORY_LIMIT} signatures and ignores <code>limit</code>{" "}
                and <code>before</code>, so older history is not reachable over RPC today. This list is the
                most recent {ADDRESS_HISTORY_LIMIT}, not the complete history.
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
