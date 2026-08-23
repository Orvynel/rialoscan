import "server-only";

import { parseLossless } from "./json";
import { NETWORKS, type NetworkId } from "./networks";

/**
 * JSON-RPC transport for Rialo.
 *
 * Three constraints drove this design, all verified against live devnet:
 *
 *  1. The endpoint sends `access-control-allow-methods` and
 *     `-allow-headers` but never `access-control-allow-origin`, so a browser
 *     cannot call it directly. Every read has to originate server-side — hence
 *     `server-only` here and the proxy route in `app/api/rpc`.
 *  2. Batch requests are rejected (`invalid type: map, expected a string`), so
 *     "batching" means a concurrent fan-out of single calls.
 *  3. Response bodies carry bare u64 integers, so the body is read as text and
 *     handed to `parseLossless` — never to `JSON.parse`.
 */

export class RpcError extends Error {
  readonly code: number;
  readonly method: string;
  readonly details?: string;

  constructor(method: string, code: number, message: string, details?: string) {
    super(message);
    this.name = "RpcError";
    this.method = method;
    this.code = code;
    this.details = details;
  }
}

export class RpcTransportError extends Error {
  readonly method: string;
  readonly status?: number;

  constructor(method: string, message: string, status?: number) {
    super(message);
    this.name = "RpcTransportError";
    this.method = method;
    this.status = status;
  }
}

export type RpcOptions = {
  /** Seconds to cache the response. Omit for always-fresh reads. */
  revalidate?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
  signal?: AbortSignal;
};

type JsonRpcEnvelope = {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code?: number; message?: string; data?: { details?: string } };
};

const DEFAULT_TIMEOUT_MS = 12_000;
let requestId = 0;

/** Immutable-once-written data: safe to cache hard. */
export const CACHE_IMMUTABLE: RpcOptions = { revalidate: 3600 };
/** Head-of-chain data: never cache. */
export const CACHE_LIVE: RpcOptions = {};

export async function rpc<T = unknown>(
  network: NetworkId,
  method: string,
  params: unknown[] = [],
  options: RpcOptions = {},
): Promise<T> {
  const endpoint = NETWORKS[network].rpc;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const body = JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params });

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body,
      signal,
      // Next caches fetches only when explicitly told to.
      ...(options.revalidate === undefined
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidate } }),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new RpcTransportError(method, timedOut ? `${method} timed out after ${timeoutMs}ms` : reason);
  }

  const text = await response.text();

  // The node answers 400 with a well-formed JSON-RPC error body, so parse first
  // and only fall back to the HTTP status when there is nothing to read.
  let envelope: JsonRpcEnvelope;
  try {
    envelope = parseLossless<JsonRpcEnvelope>(text);
  } catch {
    throw new RpcTransportError(
      method,
      `${method}: HTTP ${response.status} with unparseable body: ${text.slice(0, 200)}`,
      response.status,
    );
  }

  if (envelope.error) {
    throw new RpcError(
      method,
      envelope.error.code ?? -1,
      envelope.error.message ?? "unknown RPC error",
      envelope.error.data?.details,
    );
  }

  if (!response.ok) {
    throw new RpcTransportError(method, `${method}: HTTP ${response.status}`, response.status);
  }

  return envelope.result as T;
}

/** `rpc`, but resolves to null instead of throwing on an RPC-level error. */
export async function rpcOrNull<T = unknown>(
  network: NetworkId,
  method: string,
  params: unknown[] = [],
  options: RpcOptions = {},
): Promise<T | null> {
  try {
    return await rpc<T>(network, method, params, options);
  } catch {
    return null;
  }
}

export type RpcCall = { method: string; params?: unknown[]; options?: RpcOptions };
export type RpcOutcome<T = unknown> = { ok: true; value: T } | { ok: false; error: string; code?: number };

/**
 * Fan out concurrently. The node has no batch support, so this is as good as it
 * gets — and one slow or failing method must not blank an entire page.
 */
export async function rpcAll(
  network: NetworkId,
  calls: RpcCall[],
  options: RpcOptions = {},
): Promise<RpcOutcome[]> {
  return Promise.all(
    calls.map(async (call): Promise<RpcOutcome> => {
      try {
        return { ok: true, value: await rpc(network, call.method, call.params ?? [], { ...options, ...call.options }) };
      } catch (error) {
        if (error instanceof RpcError) return { ok: false, error: error.message, code: error.code };
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
}

export function unwrap<T>(outcome: RpcOutcome | undefined, fallback: T): T {
  return outcome?.ok ? (outcome.value as T) : fallback;
}

/**
 * Wall clock at the moment a response was assembled, used as the baseline for
 * every "12s ago" on the page.
 *
 * This lives in the data layer rather than in a page body on purpose. React
 * treats a clock read during render as impure — a re-render would silently
 * produce different output — and it is the wrong place conceptually too: the
 * baseline should be when the data was *fetched*, not when it happened to be
 * rendered. Pages pass the result to `TimeAgo` as its `initial` value so the
 * server's HTML and the first client render agree.
 */
export function fetchedAt(): number {
  return Date.now();
}
