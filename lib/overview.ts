import "server-only";

import {
  getClusterNodes,
  getConnectedValidators,
  getEpochInfo,
  getHealth,
  getBlockHeight,
  getRecentTransactions,
  getTransactionCount,
  getValidatorAccounts,
  getVersion,
  type ClusterNode,
  type EpochInfo,
  type RecentTransaction,
  type ValidatorAccount,
} from "./chain";
import { fetchedAt } from "./rpc";
import type { NetworkId } from "./networks";

/** Resolve, or fall back and record why, so one dead method cannot blank a page. */
async function safe<T>(label: string, work: Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await work;
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

export type BlockSummary = {
  height: bigint;
  blockTimeMs: number | null;
  transactionCount: number;
};

export type NetworkRates = {
  blocksPerSecond: number | null;
  transactionsPerSecond: number | null;
  /** Milliseconds of chain time the measurement covers. */
  windowMs: number | null;
  sampleSize: number;
};

/**
 * Derive production rates from the recent-transaction window.
 *
 * Block heights are monotonic, so `(maxHeight - minHeight) / windowSeconds` is
 * the true block rate whether or not every block in the range carried a
 * transaction. The transaction rate uses intervals rather than the raw count,
 * since N samples bound only N-1 gaps.
 *
 * Note the window is short — 100 transactions is a couple of seconds on devnet
 * — so these are instantaneous rates, not averages.
 */
export function deriveRates(recent: RecentTransaction[]): NetworkRates {
  const stamped = recent.filter((tx) => tx.blockTimeMs !== null && tx.blockHeight !== null);
  if (stamped.length < 2) {
    return { blocksPerSecond: null, transactionsPerSecond: null, windowMs: null, sampleSize: stamped.length };
  }

  const times = stamped.map((tx) => tx.blockTimeMs as number);
  const heights = stamped.map((tx) => tx.blockHeight as bigint);
  const windowMs = Math.max(...times) - Math.min(...times);
  if (windowMs <= 0) {
    return { blocksPerSecond: null, transactionsPerSecond: null, windowMs, sampleSize: stamped.length };
  }

  const seconds = windowMs / 1000;
  const heightSpan = Number(heights.reduce((a, b) => (b > a ? b : a)) - heights.reduce((a, b) => (b < a ? b : a)));

  return {
    blocksPerSecond: heightSpan / seconds,
    transactionsPerSecond: (stamped.length - 1) / seconds,
    windowMs,
    sampleSize: stamped.length,
  };
}

/**
 * Collapse the transaction feed into per-block summaries, newest first.
 *
 * Cheaper and kinder to the node than fetching N full blocks — a single Rialo
 * block can exceed 90 KB because REX instruction payloads are inlined as
 * base58. The trade-off is that a block with no transactions never appears
 * here, which the UI states rather than papering over.
 */
export function groupIntoBlocks(recent: RecentTransaction[], limit = 12): BlockSummary[] {
  const byHeight = new Map<string, BlockSummary>();

  for (const tx of recent) {
    if (tx.blockHeight === null) continue;
    const key = tx.blockHeight.toString();
    const existing = byHeight.get(key);
    if (existing) {
      existing.transactionCount += 1;
      if (tx.blockTimeMs !== null && (existing.blockTimeMs === null || tx.blockTimeMs < existing.blockTimeMs)) {
        existing.blockTimeMs = tx.blockTimeMs;
      }
    } else {
      byHeight.set(key, { height: tx.blockHeight, blockTimeMs: tx.blockTimeMs, transactionCount: 1 });
    }
  }

  return [...byHeight.values()].sort((a, b) => (b.height > a.height ? 1 : b.height < a.height ? -1 : 0)).slice(0, limit);
}

export type Overview = {
  network: NetworkId;
  blockHeight: bigint | null;
  epoch: EpochInfo | null;
  transactionCount: bigint | null;
  health: string | null;
  /** Semver of the node build, read from any wrapped response's context. */
  apiVersion: string | null;
  /** `getVersion` returns a git commit SHA, not a semver. */
  commit: string | null;
  rates: NetworkRates;
  recent: RecentTransaction[];
  blocks: BlockSummary[];
  nodes: ClusterNode[];
  validators: ValidatorAccount[];
  connectedValidators: number[];
  errors: string[];
  /** Server clock at render time, so relative timestamps hydrate consistently. */
  renderedAt: number;
};

export type NetworkCard = {
  network: NetworkId;
  blockHeight: bigint | null;
  epoch: EpochInfo | null;
  transactionCount: bigint | null;
  health: string | null;
  apiVersion: string | null;
  validatorsOnline: number;
  validatorsTotal: number;
  /** Answered the most basic read there is. Distinguishes "quiet" from "down". */
  reachable: boolean;
  renderedAt: number;
};

/**
 * The subset of `loadOverview` a summary card needs, for the apex page that
 * shows both networks at once.
 *
 * Deliberately does not call `getTransactions`: that returns 100 full
 * transactions with base58 REX payloads inlined and can run to tens of
 * kilobytes, which is a lot to fetch twice over for two numbers. The cost is
 * that a card cannot show tx/s, since the rate is derived from that window.
 */
export async function loadNetworkCard(network: NetworkId): Promise<NetworkCard> {
  const errors: string[] = [];

  const [blockHeight, epoch, txCount, health, nodes, connected] = await Promise.all([
    safe("getBlockHeight", getBlockHeight(network), null as bigint | null, errors),
    safe("getEpochInfo", getEpochInfo(network), null as EpochInfo | null, errors),
    safe(
      "getTransactionCount",
      getTransactionCount(network),
      { count: null, apiVersion: null } as { count: bigint | null; apiVersion: string | null },
      errors,
    ),
    safe("getHealth", getHealth(network), null as string | null, errors),
    safe("getClusterNodes", getClusterNodes(network), [] as ClusterNode[], errors),
    safe("getConnectedValidators", getConnectedValidators(network), [] as number[], errors),
  ]);

  return {
    network,
    blockHeight,
    epoch,
    transactionCount: txCount.count,
    health,
    apiVersion: txCount.apiVersion,
    validatorsOnline: connected.length,
    validatorsTotal: Math.max(nodes.length, connected.length),
    reachable: blockHeight !== null,
    renderedAt: fetchedAt(),
  };
}

export async function loadOverview(network: NetworkId): Promise<Overview> {
  const errors: string[] = [];

  const [blockHeight, epoch, txCount, health, commit, recent, nodes, validators, connectedValidators] =
    await Promise.all([
      safe("getBlockHeight", getBlockHeight(network), null as bigint | null, errors),
      safe("getEpochInfo", getEpochInfo(network), null as EpochInfo | null, errors),
      safe(
        "getTransactionCount",
        getTransactionCount(network),
        { count: null, apiVersion: null } as { count: bigint | null; apiVersion: string | null },
        errors,
      ),
      safe("getHealth", getHealth(network), null as string | null, errors),
      safe("getVersion", getVersion(network), null as string | null, errors),
      safe("getTransactions", getRecentTransactions(network), [] as RecentTransaction[], errors),
      safe("getClusterNodes", getClusterNodes(network), [] as ClusterNode[], errors),
      safe("getValidatorAccounts", getValidatorAccounts(network), [] as ValidatorAccount[], errors),
      safe("getConnectedValidators", getConnectedValidators(network), [] as number[], errors),
    ]);

  return {
    network,
    blockHeight,
    epoch,
    transactionCount: txCount.count,
    health,
    apiVersion: txCount.apiVersion,
    commit,
    rates: deriveRates(recent),
    recent,
    blocks: groupIntoBlocks(recent),
    nodes,
    validators,
    connectedValidators,
    errors,
    renderedAt: fetchedAt(),
  };
}
