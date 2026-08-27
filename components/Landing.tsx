import { Notice, Panel } from "@/components/Panel";
import { formatCompact, groupDigits } from "@/lib/format";
import { NETWORKS, NETWORK_IDS, SITE_DOMAIN, originFor } from "@/lib/networks";
import { loadNetworkCard } from "@/lib/overview";

/**
 * The bare domain.
 *
 * Rialo has no mainnet, and this is the name a mainnet explorer would have to
 * live at, so the apex serves no chain — it holds the name and points at the
 * networks that do exist. Anyone who lands here by trimming a URL or guessing
 * the domain needs one thing: which hostname to go to.
 *
 * The numbers are read live rather than hardcoded or omitted, because "is this
 * thing actually running" is the other question a visitor arrives with. They
 * come from a deliberately narrow read — see `loadNetworkCard`, which skips the
 * 100-transaction feed the per-network overview uses.
 */
export async function Landing({ host, protocol }: { host: string; protocol: string }) {
  const cards = await Promise.all(NETWORK_IDS.map((id) => loadNetworkCard(id)));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Rialo</div>
          <h1 className="page-title">RialoScan</h1>
          <p className="page-sub">Block explorer for the Rialo network.</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Notice title="Mainnet is not live">
          Rialo has not launched a mainnet, and <code>{SITE_DOMAIN}</code> is being held for one — so this
          page is all it serves. Each network that does exist has its own explorer on its own hostname, which
          means a URL copied out of RialoScan always says which chain it came from.
        </Notice>
      </div>

      <div className="grid-2">
        {cards.map((card) => {
          const network = NETWORKS[card.network];
          const origin = originFor(card.network, host, protocol);
          const hostname = origin.replace(/^https?:\/\//, "");
          const rpcHost = network.rpc.replace(/^https?:\/\//, "");

          return (
            <Panel
              key={card.network}
              title={network.label}
              live={card.reachable && card.health === "ok"}
              action={
                <span className="badge" data-tone={card.health === "ok" ? "ok" : "error"}>
                  {card.health ?? "unreachable"}
                </span>
              }
            >
              <div className="panel-body">
                <dl className="dl">
                  <dt>Block height</dt>
                  <dd>{card.blockHeight === null ? <span className="dim">—</span> : groupDigits(card.blockHeight)}</dd>

                  <dt>Epoch</dt>
                  <dd>{card.epoch === null ? <span className="dim">—</span> : groupDigits(card.epoch.epoch)}</dd>

                  <dt>Transactions</dt>
                  <dd>
                    {card.transactionCount === null ? (
                      <span className="dim">—</span>
                    ) : (
                      <>
                        {formatCompact(card.transactionCount)}
                        <span className="dim"> · {groupDigits(card.transactionCount)} total</span>
                      </>
                    )}
                  </dd>

                  <dt>Validators</dt>
                  <dd>
                    {card.validatorsTotal === 0 ? (
                      <span className="dim">—</span>
                    ) : (
                      `${card.validatorsOnline}/${card.validatorsTotal} connected`
                    )}
                  </dd>

                  <dt>Node</dt>
                  <dd>{card.apiVersion ?? <span className="dim">—</span>}</dd>

                  <dt>Reads from</dt>
                  <dd>{rpcHost}</dd>
                </dl>
              </div>

              <div
                className="panel-foot"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}
              >
                <span>{network.note}</span>
                <a className="button" href={origin} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                  {hostname} →
                </a>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="prose" style={{ marginTop: 22 }}>
        <p>
          Both explorers read the network directly over JSON-RPC on every request — there is no indexer and no
          cached copy of the chain, so a number shown here is a number the node returned a moment ago. The same
          reads are available to anyone through <a href="/api/rpc">the CORS-safe RPC proxy</a>, which the
          Rialo endpoints do not provide themselves.
        </p>
      </div>
    </>
  );
}
