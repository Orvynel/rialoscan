import { formatDuration, formatUtcWithMillis, groupDigits, plural, shorten } from "@/lib/format";
import { Hash } from "./Hash";
import type { RexRequest } from "@/lib/chain";
import type { NetworkId } from "@/lib/networks";

/**
 * REX requests for one creator.
 *
 * REX (Rialo Extended Execution) runs a WASM component inside a TEE with
 * outbound network access, then feeds the result back on chain. A request is the
 * standing subscription: how often to run, how many validators must attest each
 * duty, and how long to wait before the first run. `duties` is the concrete
 * schedule — each entry names the validators assigned to that run.
 *
 * Three things are shown raw rather than prettified, because prettifying them
 * would mean inventing information:
 *  - `updateFrequency` and `startingTimestamp` arrive double-encoded, as the JSON
 *    *strings* `"{\"Periodic\":30000}"` and `"{\"Timestamp\":0}"`, so both the
 *    decoded value and the literal are shown.
 *  - `createdAt` is a millisecond value that the node formats as seconds,
 *    producing dates in the year 58538. No date is derived from it. The
 *    `targetTimestamp` on each duty *is* formatted correctly, which is how we
 *    know the defect is in that one field.
 */
export function RexRequestList({
  requests,
  net,
  missedDuties,
  validatorNames,
}: {
  requests: RexRequest[];
  net: NetworkId;
  missedDuties?: Map<string, number[]>;
  /** Hex authority key -> hostname, so duty assignments read as validator names. */
  validatorNames?: Map<string, string>;
}) {
  return (
    <>
      {requests.map((request) => {
        const missed = missedDuties?.get(request.nonce);
        const nextDuty = request.duties.find((duty) => duty.targetTimestampMs !== null);

        return (
          <div key={request.nonce} className="ix">
            <div className="ix-head">
              <span className="ix-index">
                {request.description || request.nonceLabel || `nonce ${request.nonce.slice(0, 12)}…`}
              </span>
              <span className="chips">
                <span className="badge" data-tone={request.isActive ? "ok" : undefined}>
                  {request.isActive ? (
                    <>
                      <span className="pulse" aria-hidden="true" />
                      active
                    </>
                  ) : (
                    "inactive"
                  )}
                </span>
                {request.updateFrequency ? (
                  <span className="tag" data-tone="accent">
                    {request.updateFrequency.tag}
                    {request.updateFrequency.ms === null
                      ? ""
                      : ` · ${formatDuration(request.updateFrequency.ms)}`}
                  </span>
                ) : null}
                <span className="tag">
                  {request.duties.length} {plural(request.duties.length, "duty", "duties")}
                </span>
                <span className="tag">
                  {request.validatorsPerDuty} {plural(request.validatorsPerDuty, "validator")}/duty
                </span>
                {missed && missed.length > 0 ? (
                  <span className="tag" data-tone="warn">
                    {missed.length} missed
                  </span>
                ) : null}
              </span>
            </div>

            <dl className="dl">
              <dt>Creator</dt>
              <dd>
                <Hash value={request.creator} net={net} kind="address" full />
              </dd>

              <dt>Nonce</dt>
              <dd>
                {request.nonce}
                {request.nonceLabel ? (
                  <div className="dim" style={{ fontSize: 11 }}>
                    Decodes to ASCII <code>{request.nonceLabel}</code> — the 32-byte nonce is a
                    zero-padded label, not a random value.
                  </div>
                ) : null}
              </dd>

              <dt>Update frequency</dt>
              <dd>
                {request.updateFrequency ? (
                  <>
                    {request.updateFrequency.tag}
                    {request.updateFrequency.ms === null
                      ? ""
                      : ` every ${formatDuration(request.updateFrequency.ms)}`}
                    <div className="dim" style={{ fontSize: 11 }}>
                      wire value: <code>{request.updateFrequency.raw}</code>
                    </div>
                  </>
                ) : (
                  <span className="dim">—</span>
                )}
              </dd>

              <dt>Starting timestamp</dt>
              <dd>
                {request.startingTimestamp ? (
                  <>
                    {request.startingTimestamp.tag}
                    {request.startingTimestamp.ms === 0n ? " 0 — start immediately" : ""}
                    {request.startingTimestamp.ms !== null && request.startingTimestamp.ms > 0n
                      ? ` · ${formatUtcWithMillis(Number(request.startingTimestamp.ms))}`
                      : ""}
                    <div className="dim" style={{ fontSize: 11 }}>
                      wire value: <code>{request.startingTimestamp.raw}</code>
                    </div>
                  </>
                ) : (
                  <span className="dim">—</span>
                )}
              </dd>

              <dt>Request delay</dt>
              <dd>{formatDuration(request.rexRequestDelayMs)}</dd>

              <dt>Created at</dt>
              <dd>
                <code>{request.createdAtRaw || "—"}</code>
                <div className="dim" style={{ fontSize: 11 }}>
                  Shown verbatim. The node reports this in milliseconds but formats it as seconds, yielding
                  a year-58538 date, so no timestamp is derived from it here.
                </div>
              </dd>

              <dt>Missed duties</dt>
              <dd className={missed && missed.length > 0 ? undefined : "dim"}>
                {missed === undefined
                  ? "not checked"
                  : missed.length === 0
                    ? "none"
                    : `${missed.length} ${plural(missed.length, "round")} · most recent ${formatUtcWithMillis(Math.max(...missed))}`}
              </dd>
            </dl>

            {request.duties.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <div className="ix-index" style={{ marginBottom: 8 }}>
                  Scheduled duties
                  {nextDuty ? (
                    <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>
                      {" "}
                      · first at {formatUtcWithMillis(nextDuty.targetTimestampMs)}
                    </span>
                  ) : null}
                </div>
                <div className="rows" style={{ border: "1px solid var(--border)", borderRadius: 3 }}>
                  {request.duties.map((duty, index) => (
                    <div key={index} className="row row-block">
                      <span className="row-secondary">{duty.targetTimestampRaw}</span>
                      <span className="chips">
                        {duty.assignedValidators.map((key) => (
                          <span key={key} className="tag" data-tone="accent" title={key}>
                            {validatorNames?.get(key) ?? shorten(key, 8, 6)}
                          </span>
                        ))}
                      </span>
                      <span className="row-time">
                        {duty.assignedValidators.length}{" "}
                        {plural(duty.assignedValidators.length, "validator")}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="dim" style={{ fontSize: 11, marginTop: 7 }}>
                  Assigned validators are hex-encoded authority keys — the same keys{" "}
                  <code>getClusterNodes</code> returns in base64. RialoScan decodes both to bytes so a duty can
                  be attributed to a named validator.
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function rexCountLabel(count: number): string {
  return `${groupDigits(count)} ${plural(count, "request")}`;
}
