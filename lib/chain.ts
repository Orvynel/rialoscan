import "server-only";

import { u64, u64OrNull, U64_MAX } from "./json";
import { CACHE_IMMUTABLE, rpc, rpcOrNull, type RpcOptions } from "./rpc";
import type { NetworkId } from "./networks";

/**
 * Typed wrappers over Rialo's JSON-RPC surface.
 *
 * Every decoder here was written against a live devnet response captured on
 * 2026-08-23, not against documentation. The API is Solana-shaped but diverges
 * in ways that will bite anyone who assumes otherwise:
 *
 *  - Four different response envelopes: bare value, `{context, value}`,
 *    `{version, context, value}`, and method-specific keys (`nodes`,
 *    `rex_requests`, `lineage`, `configHashPrefix`).
 *  - Casing is inconsistent *within* the same API: `getBlock` returns
 *    `blockHeight`/`blockTime`, `getTransaction` returns `block_height`/
 *    `block_time`, and `getValidatorAccounts` is entirely snake_case.
 *  - Parameter key names disagree across methods: `getAccountInfo` takes
 *    `address`, `getStakeAccount` takes `pubkey`,
 *    `getMinimumBalanceForRentExemption` takes `data_length`.
 *  - Timestamp units are mixed. `getBlock.blockTime` is seconds; the
 *    `blockTime` in `getTransactions` and `getSignaturesForAddress` is
 *    milliseconds. Everything is normalised to ms here, at the boundary.
 *  - The same validator keys come back base58 from `getValidatorAccounts` and
 *    base64 from `getClusterNodes`, so the two endpoints are joined on hostname,
 *    not on key equality.
 *  - Balances are denominated in *kelvin*, not lamports.
 */

export const KELVIN_PER_RLO = 1_000_000_000n;
export const NATIVE_LOADER = "NativeLoader1111111111111111111111111111111";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const bool = (value: unknown): boolean => value === true;
const int = (value: unknown, fallback = 0): number => {
  const n = u64OrNull(value);
  return n === null ? fallback : Number(n);
};

/** Unwrap `{context, value}` / `{version, context, value}`; pass anything else through. */
function pluck(raw: unknown): unknown {
  return isObj(raw) && "value" in raw ? raw.value : raw;
}

export type ChainContext = { slot: bigint; apiVersion: string };

function context(raw: unknown): ChainContext | null {
  if (!isObj(raw) || !isObj(raw.context)) return null;
  const slot = u64OrNull(raw.context.slot);
  if (slot === null) return null;
  return { slot, apiVersion: str(raw.context.api_version) };
}

/**
 * Normalise a chain timestamp to epoch milliseconds.
 *
 * Necessary because the same logical field arrives in different units from
 * different methods. Values below 1e11 are seconds (a millisecond timestamp
 * that small would be 1973); sentinels and u64::MAX become null.
 */
export function toEpochMs(value: unknown): number | null {
  const n = u64OrNull(value);
  if (n === null || n === 0n || n >= 1_000_000_000_000_000n) return null;
  const num = Number(n);
  return num < 1e11 ? num * 1000 : num;
}

// ---------------------------------------------------------------- chain status

export const getBlockHeight = (net: NetworkId, options?: RpcOptions) =>
  rpc(net, "getBlockHeight", [], options).then((r) => u64(r, "blockHeight"));

export const getHealth = (net: NetworkId, options?: RpcOptions) =>
  rpc(net, "getHealth", [], options).then(str);

export const getValidatorHealth = (net: NetworkId, options?: RpcOptions) =>
  rpc(net, "getValidatorHealth", [], options).then(str);

/** Returns a git commit SHA, not a semver string. The semver lives in `context.api_version`. */
export const getVersion = (net: NetworkId, options?: RpcOptions) =>
  rpc(net, "getVersion", [], options).then(str);

export type EpochInfo = {
  absoluteSlot: bigint;
  blockHeight: bigint;
  epoch: bigint;
  slotIndex: bigint;
  /** u64::MAX on every live network — epochs are effectively unbounded. */
  slotsInEpoch: bigint;
  slotsInEpochUnbounded: boolean;
  transactionCount: bigint;
};

export async function getEpochInfo(net: NetworkId, options?: RpcOptions): Promise<EpochInfo> {
  const raw = await rpc<Obj>(net, "getEpochInfo", [], options);
  const slotsInEpoch = u64OrNull(raw.slotsInEpoch) ?? U64_MAX;
  return {
    absoluteSlot: u64OrNull(raw.absoluteSlot) ?? 0n,
    blockHeight: u64OrNull(raw.blockHeight) ?? 0n,
    epoch: u64OrNull(raw.epoch) ?? 0n,
    slotIndex: u64OrNull(raw.slotIndex) ?? 0n,
    slotsInEpoch,
    slotsInEpochUnbounded: slotsInEpoch === U64_MAX,
    transactionCount: u64OrNull(raw.transactionCount) ?? 0n,
  };
}

export type TransactionCountResult = { count: bigint; apiVersion: string | null };

/**
 * Total transactions, plus the node's semver.
 *
 * `getVersion` returns a bare git commit SHA, so the only place the readable
 * build number appears is `context.api_version` on a wrapped response. This is
 * the cheapest wrapped response available, so it carries both.
 */
export async function getTransactionCount(net: NetworkId, options?: RpcOptions): Promise<TransactionCountResult> {
  const raw = await rpc(net, "getTransactionCount", [], options);
  return { count: u64(pluck(raw), "transactionCount"), apiVersion: context(raw)?.apiVersion ?? null };
}

export type ActiveFeature = { name: string; snapshotSlot: bigint | null };

export async function getActiveFeatures(net: NetworkId, options?: RpcOptions): Promise<ActiveFeature[]> {
  const raw = await rpc(net, "getActiveFeatures", [], options);
  return asArray(pluck(raw))
    .filter(isObj)
    .map((f) => ({ name: str(f.name), snapshotSlot: u64OrNull(f.snapshot_slot) }));
}

export async function getRecentConfigHashPrefix(net: NetworkId, options?: RpcOptions): Promise<bigint | null> {
  const raw = await rpcOrNull<Obj>(net, "getRecentValidatorConfigHash", [], options);
  return raw ? u64OrNull(raw.configHashPrefix) : null;
}

// ------------------------------------------------------------ blocks and txs

export type InstructionView = { programIdIndex: number; accounts: number[]; data: string };

export type MessageView = {
  accountKeys: string[];
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  };
  instructions: InstructionView[];
};

export type TransactionMeta = {
  err: unknown;
  fee: bigint;
  logMessages: string[];
  innerInstructions: unknown[];
  computeUnitsConsumed: bigint;
};

export type TransactionCore = {
  signatures: string[];
  message: MessageView;
  /** Milliseconds. Rialo's replay window replaces Solana's recent blockhash. */
  validFromMs: number | null;
};

export type BlockTransaction = { transaction: TransactionCore; meta: TransactionMeta | null };

export type Block = {
  blockHeight: bigint;
  /** Normalised to milliseconds (the wire value is seconds). */
  blockTimeMs: number | null;
  transactions: BlockTransaction[];
  context: ChainContext | null;
};

function decodeMessage(raw: unknown): MessageView {
  const m = isObj(raw) ? raw : {};
  const header = isObj(m.header) ? m.header : {};
  return {
    accountKeys: asArray(m.accountKeys).map(str),
    header: {
      numRequiredSignatures: int(header.numRequiredSignatures),
      numReadonlySignedAccounts: int(header.numReadonlySignedAccounts),
      numReadonlyUnsignedAccounts: int(header.numReadonlyUnsignedAccounts),
    },
    instructions: asArray(m.instructions)
      .filter(isObj)
      .map((ix) => ({
        programIdIndex: int(ix.programIdIndex),
        accounts: asArray(ix.accounts).map((a) => int(a)),
        data: str(ix.data),
      })),
  };
}

function decodeMeta(raw: unknown): TransactionMeta | null {
  if (!isObj(raw)) return null;
  return {
    err: raw.err ?? null,
    fee: u64OrNull(raw.fee) ?? 0n,
    logMessages: asArray(raw.logMessages).map(str),
    innerInstructions: asArray(raw.innerInstructions),
    computeUnitsConsumed: u64OrNull(raw.computeUnitsConsumed) ?? 0n,
  };
}

function decodeTransactionCore(raw: unknown): TransactionCore {
  const t = isObj(raw) ? raw : {};
  return {
    signatures: asArray(t.signatures).map(str),
    message: decodeMessage(t.message),
    validFromMs: toEpochMs(t.validFrom),
  };
}

export async function getBlock(net: NetworkId, blockHeight: bigint | number): Promise<Block | null> {
  // Finalised blocks never change, so they are safe to cache hard.
  const raw = await rpcOrNull(net, "getBlock", [{ blockHeight: Number(blockHeight) }], CACHE_IMMUTABLE);
  const value = pluck(raw);
  if (!isObj(value)) return null;
  return {
    blockHeight: u64OrNull(value.blockHeight) ?? BigInt(blockHeight),
    blockTimeMs: toEpochMs(value.blockTime),
    transactions: asArray(value.transactions)
      .filter(isObj)
      .map((t) => ({ transaction: decodeTransactionCore(t.transaction), meta: decodeMeta(t.meta) })),
    context: context(raw),
  };
}

/** `getBlocks` takes positional integers, unlike every other block method. */
export async function getBlocks(net: NetworkId, start: number, end: number): Promise<bigint[]> {
  const raw = await rpcOrNull(net, "getBlocks", [start, end], CACHE_IMMUTABLE);
  return asArray(raw)
    .map((v) => u64OrNull(v))
    .filter((v): v is bigint => v !== null);
}

export type TransactionDetail = {
  signature: string;
  blockHeight: bigint | null;
  blockTimeMs: number | null;
  transaction: TransactionCore;
  meta: TransactionMeta | null;
  context: ChainContext | null;
};

export async function getTransaction(net: NetworkId, signature: string): Promise<TransactionDetail | null> {
  const raw = await rpcOrNull<Obj>(net, "getTransaction", [{ signature }], CACHE_IMMUTABLE);
  if (!isObj(raw) || !isObj(raw.transaction)) return null;
  const core = decodeTransactionCore(raw.transaction);
  return {
    signature: core.signatures[0] ?? signature,
    blockHeight: u64OrNull(raw.block_height),
    // `block_time` is null in practice; the containing block carries the real time.
    blockTimeMs: toEpochMs(raw.block_time),
    transaction: core,
    meta: decodeMeta(raw.meta),
    context: context(raw),
  };
}

export type RecentTransaction = {
  signature: string;
  slot: bigint | null;
  blockHeight: bigint | null;
  blockTimeMs: number | null;
  version: string;
};

/**
 * Latest confirmed transactions, newest first.
 *
 * Named `getTransactions` upstream and documented as taking a `signatures`
 * filter, but the node ignores it: a real signature, an empty array and a bogus
 * signature all return the same latest 100, and the requested signature is
 * absent from the result. `limit` and `before` are ignored too. So this is only
 * usable as a firehose — which is exactly what a live feed wants. Use
 * `getTransaction` when you need a specific signature.
 */
export async function getRecentTransactions(net: NetworkId, options?: RpcOptions): Promise<RecentTransaction[]> {
  const raw = await rpcOrNull(net, "getTransactions", [{ signatures: [] }], options);
  return asArray(pluck(raw))
    .filter(isObj)
    .map((t) => ({
      signature: str(t.signature),
      slot: u64OrNull(t.slot),
      blockHeight: u64OrNull(t.blockHeight),
      blockTimeMs: toEpochMs(t.blockTime),
      version: str(t.version) || "legacy",
    }));
}

export type SignatureStatus = { slot: bigint | null; err: unknown; executed: boolean };

export async function getSignatureStatuses(net: NetworkId, signatures: string[]): Promise<SignatureStatus[]> {
  const raw = await rpcOrNull(net, "getSignatureStatuses", [{ signatures }]);
  return asArray(pluck(raw))
    .filter(isObj)
    .map((s) => ({ slot: u64OrNull(s.slot), err: s.err ?? null, executed: bool(s.executed) }));
}

// -------------------------------------------------------------------- accounts

export type AccountInfo = {
  address: string;
  kelvin: bigint;
  owner: string;
  /** `[payload, encoding]`, e.g. `["cmV4X3Byb2Nlc3Nvcg==", "base64"]`. */
  data: [string, string];
  executable: boolean;
  rentEpoch: bigint | null;
  rentExempt: boolean;
  space: bigint;
  context: ChainContext | null;
};

function decodeAccount(address: string, raw: unknown, ctx: ChainContext | null): AccountInfo | null {
  if (!isObj(raw)) return null;
  const data = asArray(raw.data).map(str);
  const rentEpoch = u64OrNull(raw.rentEpoch);
  return {
    address,
    kelvin: u64OrNull(raw.kelvin) ?? 0n,
    owner: str(raw.owner),
    data: [data[0] ?? "", data[1] ?? "base64"],
    executable: bool(raw.executable),
    rentEpoch,
    // u64::MAX in the rentEpoch field is the "never collect rent" sentinel.
    rentExempt: rentEpoch === U64_MAX,
    space: u64OrNull(raw.space) ?? 0n,
    context: ctx,
  };
}

export async function getAccountInfo(
  net: NetworkId,
  address: string,
  options?: RpcOptions,
): Promise<AccountInfo | null> {
  const raw = await rpcOrNull(net, "getAccountInfo", [{ address }], options);
  return decodeAccount(address, pluck(raw), context(raw));
}

export const getBalance = (net: NetworkId, address: string) =>
  rpcOrNull(net, "getBalance", [{ address }]).then((r) => u64OrNull(pluck(r)) ?? 0n);

export type OwnedAccount = { pubkey: string; account: AccountInfo | null };

export async function getAccountsByOwner(net: NetworkId, owner: string): Promise<OwnedAccount[]> {
  const raw = await rpcOrNull(net, "getAccountsByOwner", [{ owner }]);
  const ctx = context(raw);
  return asArray(pluck(raw))
    .filter(isObj)
    .map((entry) => {
      const pubkey = str(entry.pubkey);
      return { pubkey, account: decodeAccount(pubkey, entry.account, ctx) };
    });
}

export type AddressSignature = { signature: string; blockHeight: bigint | null; blockTimeMs: number | null };

/**
 * Transaction history for an address, newest first.
 *
 * The node caps this at 20 entries and ignores both `limit` and `before`, so
 * deeper history is not reachable over RPC today. Say so in the UI rather than
 * implying the list is complete.
 */
export async function getSignaturesForAddress(net: NetworkId, address: string): Promise<AddressSignature[]> {
  const raw = await rpcOrNull(net, "getSignaturesForAddress", [{ address }]);
  return asArray(pluck(raw))
    .filter(isObj)
    .map((s) => ({
      signature: str(s.signature),
      blockHeight: u64OrNull(s.blockHeight),
      blockTimeMs: toEpochMs(s.blockTime),
    }));
}

export const ADDRESS_HISTORY_LIMIT = 20;

/**
 * Native programs publish their own name: the account is owned by NativeLoader
 * and its data is the UTF-8 program name (`system_program`, `rex_processor`).
 * That makes a hardcoded program registry unnecessary.
 */
export function nativeProgramName(account: AccountInfo | null): string | null {
  if (!account || !account.executable || account.owner !== NATIVE_LOADER) return null;
  try {
    const name = Buffer.from(account.data[0], "base64").toString("utf8").replace(/\0+$/, "");
    return /^[\x20-\x7e]+$/.test(name) ? name : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ validators

export type ClusterNode = {
  hostname: string;
  /** Human multiaddr, e.g. `/dns/node0.devnet.rialo.io/udp/4070`. */
  address: string;
  stake: bigint;
  /** base64, unlike the base58 keys in `getValidatorAccounts`. */
  authorityPubkey: string;
  protocolPubkey: string;
  networkPubkey: string;
  lastCommittedRound: bigint | null;
};

export type ClusterNodes = { version: bigint; nodes: ClusterNode[] };

export async function getClusterNodes(net: NetworkId, options?: RpcOptions): Promise<ClusterNode[]> {
  return (await getCluster(net, options)).nodes;
}

export async function getCluster(net: NetworkId, options?: RpcOptions): Promise<ClusterNodes> {
  const raw = await rpcOrNull<Obj>(net, "getClusterNodes", [], options);
  const nodes = isObj(raw) ? raw.nodes : null;
  return {
    version: (isObj(raw) ? u64OrNull(raw.version) : null) ?? 0n,
    nodes: asArray(nodes)
      .filter(isObj)
      .map((n) => ({
        hostname: str(n.hostname),
        address: str(n.address),
        stake: u64OrNull(n.stake) ?? 0n,
        authorityPubkey: str(n.authorityPubkey),
        protocolPubkey: str(n.protocolPubkey),
        networkPubkey: str(n.networkPubkey),
        lastCommittedRound: u64OrNull(n.lastCommittedRound),
      })),
  };
}

export type ValidatorAccount = {
  pubkey: string;
  hostname: string;
  stake: bigint;
  /** Accrued commission in kelvin, distinct from `commissionRate`. */
  commission: bigint;
  commissionRate: bigint;
  newCommissionRate: bigint | null;
  signingKey: string;
  withdrawalKey: string;
  /** base58 here; the same bytes are base64 in `getClusterNodes`. */
  protocolKey: string;
  networkKey: string;
  /** base64 in both endpoints, and byte-identical between them. */
  authorityKey: string;
  /** base64 binary multiaddrs — decoded for display, kept raw for fidelity. */
  addressRaw: string;
  subdagSyncAddressRaw: string;
  registrationTimeMs: number | null;
  lastUpdateMs: number | null;
  /** Epoch -> unbonding duration in milliseconds, e.g. `{0: 172800000}` = 48h. */
  unbondingPeriods: { epoch: string; ms: bigint }[];
  lockupPeriod: bigint;
  earliestShutdown: bigint | null;
};

/** The only endpoint that is entirely snake_case. */
export async function getValidatorAccounts(net: NetworkId, options?: RpcOptions): Promise<ValidatorAccount[]> {
  const raw = await rpcOrNull(net, "getValidatorAccounts", [], options);
  return asArray(pluck(raw))
    .filter(isObj)
    .map((v) => ({
      pubkey: str(v.pubkey),
      hostname: str(v.hostname),
      stake: u64OrNull(v.stake) ?? 0n,
      commission: u64OrNull(v.commission) ?? 0n,
      commissionRate: u64OrNull(v.commission_rate) ?? 0n,
      newCommissionRate: u64OrNull(v.new_commission_rate),
      signingKey: str(v.signing_key),
      withdrawalKey: str(v.withdrawal_key),
      protocolKey: str(v.protocol_key),
      networkKey: str(v.network_key),
      authorityKey: str(v.authority_key),
      addressRaw: str(v.address),
      subdagSyncAddressRaw: str(v.subdag_sync_address),
      registrationTimeMs: toEpochMs(v.registration_time),
      lastUpdateMs: toEpochMs(v.last_update),
      unbondingPeriods: isObj(v.unbonding_periods)
        ? Object.entries(v.unbonding_periods).map(([epoch, ms]) => ({ epoch, ms: u64OrNull(ms) ?? 0n }))
        : [],
      lockupPeriod: u64OrNull(v.lockup_period) ?? 0n,
      earliestShutdown: u64OrNull(v.earliest_shutdown),
    }));
}

/** Indices into `getClusterNodes().nodes`, not pubkeys. */
export const getConnectedValidators = (net: NetworkId, options?: RpcOptions) =>
  rpcOrNull(net, "getConnectedValidators", [], options).then((r) => asArray(r).map((v) => int(v, -1)));

export const getConnectedFullNodes = (net: NetworkId, options?: RpcOptions) =>
  rpcOrNull(net, "getConnectedFullNodes", [], options).then((r) => asArray(r).map((v) => int(v, -1)));

// ------------------------------------------------------------------------ REX

/** `{"Periodic":30000}` arrives as a JSON *string*, double-encoded. */
export type TaggedInterval = { tag: string; ms: bigint | null; raw: string };

function decodeTagged(value: unknown): TaggedInterval | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { tag: value, ms: null, raw };
    }
  }
  if (typeof parsed === "string") return { tag: parsed, ms: null, raw };
  if (!isObj(parsed)) return { tag: raw, ms: null, raw };
  const [tag, inner] = Object.entries(parsed)[0] ?? ["", null];
  return { tag, ms: u64OrNull(inner), raw };
}

/** The 32-byte nonce is a zero-padded ASCII label ("read", "close", "connect"). */
export function decodeNonceLabel(hex: string): string | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  try {
    const label = Buffer.from(hex, "hex").toString("utf8").replace(/\0+$/, "");
    return label.length > 0 && /^[\x20-\x7e]+$/.test(label) ? label : null;
  } catch {
    return null;
  }
}

export type RexDuty = {
  /** Wire format is a formatted string, e.g. `2026-08-23 04:12:56.300 UTC`. */
  targetTimestampRaw: string;
  targetTimestampMs: number | null;
  /** Hex-encoded 96-byte authority keys — a third encoding of the same key. */
  assignedValidators: string[];
};

/**
 * `"2026-08-23 04:12:56.300 UTC"` -> epoch ms.
 *
 * REX duties carry an already-formatted timestamp rather than a number, and it
 * is not ISO 8601, so it has to be reshaped before parsing. Unlike `createdAt`
 * on the parent request, this one is formatted correctly.
 */
export function parseUtcStamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s*UTC$/.exec(value.trim());
  if (!match) return null;
  const ms = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    Number((match[7] ?? "0").padEnd(3, "0")),
  );
  return Number.isNaN(ms) ? null : ms;
}

function decodeDuty(raw: unknown): RexDuty | null {
  if (!isObj(raw)) return null;
  const stamp = str(raw.targetTimestamp);
  return {
    targetTimestampRaw: stamp,
    targetTimestampMs: parseUtcStamp(stamp),
    assignedValidators: asArray(raw.assignedValidators).map(str),
  };
}

export type RexRequest = {
  creator: string;
  nonce: string;
  nonceLabel: string | null;
  description: string;
  isActive: boolean;
  updateFrequency: TaggedInterval | null;
  startingTimestamp: TaggedInterval | null;
  /**
   * Upstream renders this as a year-58538 date: a millisecond value formatted
   * as if it were seconds. Kept verbatim so the UI can flag it rather than
   * present a fabricated date. Note that `duties[].targetTimestamp` on the same
   * object *is* formatted correctly, so the defect is specific to this field.
   */
  createdAtRaw: string;
  validatorsPerDuty: number;
  rexRequestDelayMs: bigint;
  duties: RexDuty[];
};

export async function getRexRequests(net: NetworkId, creator: string): Promise<RexRequest[]> {
  const raw = await rpcOrNull<Obj>(net, "getRexRequests", [{ creator }]);
  const list = isObj(raw) ? raw.rex_requests : null;
  return asArray(list)
    .filter(isObj)
    .map((r) => {
      const nonce = str(r.nonce);
      return {
        creator: str(r.creator) || creator,
        nonce,
        nonceLabel: decodeNonceLabel(nonce),
        description: str(r.description),
        isActive: bool(r.isActive),
        updateFrequency: decodeTagged(r.updateFrequency),
        startingTimestamp: decodeTagged(r.startingTimestamp),
        createdAtRaw: str(r.createdAt),
        validatorsPerDuty: int(r.validatorsPerDuty),
        rexRequestDelayMs: u64OrNull(r.rexRequestDelayMs) ?? 0n,
        duties: asArray(r.duties)
          .map(decodeDuty)
          .filter((d): d is RexDuty => d !== null),
      };
    });
}

/** Proposal rounds where a duty was missed, as epoch milliseconds. */
export async function getRexMissedDuties(net: NetworkId, creator: string, nonce: string): Promise<number[]> {
  const raw = await rpcOrNull<Obj>(net, "getRexMissedDuties", [{ creator, nonce }]);
  const rounds = isObj(raw) ? raw.missedDutiesAtProposalRounds : null;
  return asArray(rounds)
    .map((v) => toEpochMs(v))
    .filter((v): v is number => v !== null);
}

export type WorkflowNode = {
  id: string;
  depth: number;
  blockHeight: bigint | null;
  timestampMs: number | null;
  success: boolean;
  instructionCount: number;
  programIds: string[];
  subscriptions: unknown[];
  children: WorkflowNode[];
  hasMoreChildren: boolean;
};

export type WorkflowLineage = {
  root: WorkflowNode | null;
  nodes: WorkflowNode[];
  leaves: string[];
  truncated: boolean;
  truncationReason: string;
};

function decodeWorkflowNode(raw: unknown, depth = 0): WorkflowNode | null {
  if (!isObj(raw)) return null;
  const data = isObj(raw.data) ? raw.data : {};
  return {
    id: str(raw.id),
    depth: int(raw.depth, depth),
    blockHeight: u64OrNull(data.blockHeight),
    timestampMs: toEpochMs(data.timestamp),
    success: bool(data.success),
    instructionCount: int(data.instructionCount),
    programIds: asArray(data.instructionProgramIds).map(str),
    subscriptions: asArray(raw.subscriptions),
    children: asArray(raw.workflowChildren)
      .map((child) => decodeWorkflowNode(child, depth + 1))
      .filter((n): n is WorkflowNode => n !== null),
    hasMoreChildren: bool(raw.hasMoreChildren),
  };
}

/**
 * Causal ancestry of a reactive transaction: which transaction triggered which.
 * Rialo-specific, and the reason a Rialo explorer cannot just be a Solana
 * explorer with the labels changed.
 */
export async function getWorkflowLineage(net: NetworkId, signature: string): Promise<WorkflowLineage | null> {
  const raw = await rpcOrNull<Obj>(net, "getWorkflowLineage", [{ signature }], CACHE_IMMUTABLE);
  if (!isObj(raw)) return null;
  const lineage = isObj(raw.lineage) ? raw.lineage : {};
  const nodes = asArray(lineage.workflowNodes)
    .map((n) => decodeWorkflowNode(n))
    .filter((n): n is WorkflowNode => n !== null);
  return {
    root: nodes[0] ?? null,
    nodes,
    leaves: asArray(raw.leaves).map(str),
    truncated: bool(raw.truncated),
    truncationReason: str(raw.truncationReason) || "none",
  };
}

export type SecretSharingKey = { epoch: bigint; version: bigint; pubkey: string };

/** TEE key used for HPKE-encrypted inputs to REX components. Hex, 32 bytes. */
export async function getSecretSharingPubkey(net: NetworkId): Promise<SecretSharingKey | null> {
  const raw = await rpcOrNull<Obj>(net, "getSecretSharingPubkey", [{}]);
  if (!isObj(raw)) return null;
  const pubkey = strOrNull(raw.pubkey);
  return pubkey
    ? { epoch: u64OrNull(raw.epoch) ?? 0n, version: u64OrNull(raw.version) ?? 0n, pubkey }
    : null;
}

export const REX_PROCESSOR = "Qrac1eProcessor1111111111111111111111111111";
