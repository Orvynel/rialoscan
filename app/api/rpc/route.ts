import { NextRequest } from "next/server";
import { stringifyLossless } from "@/lib/json";
import { DEFAULT_NETWORK, NETWORK_IDS, resolveNetwork } from "@/lib/networks";
import { rpc, RpcError, RpcTransportError } from "@/lib/rpc";

/**
 * CORS-safe, batch-capable, precision-preserving JSON-RPC gateway for Rialo.
 *
 * Rialo's own endpoint cannot be called from a browser: it answers preflight
 * with `access-control-allow-methods` and `access-control-allow-headers` but
 * never sends `access-control-allow-origin`, so every fetch from page context
 * fails. It also rejects JSON-RPC batch arrays. This route fixes both, and is
 * deliberately open to any origin so other Rialo projects can use it too.
 *
 * Two behaviours differ from talking to the node directly, both on purpose:
 *
 *  - Integers wider than 2^53-1 are emitted as JSON *strings*. JSON has no
 *    integer type wide enough for u64, and a bare number would silently lose
 *    precision in every JSON parser on the client side.
 *  - Only read methods are accepted. Proxying `sendTransaction`,
 *    `requestAirdrop` or `submitEpochChange` would turn this into an open relay
 *    and a free faucet tap; point those at the node directly from a server you
 *    control.
 */

const READ_METHODS = new Set([
  "getAccountInfo",
  "getAccountsByOwner",
  "getActiveFeatures",
  "getBalance",
  "getBlock",
  "getBlockHeight",
  "getBlocks",
  "getClusterNodes",
  "getConnectedFullNodes",
  "getConnectedValidators",
  "getEpochInfo",
  "getFeeForMessage",
  "getHealth",
  "getInflationReward",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getRecentValidatorConfigHash",
  "getRexMissedDuties",
  "getRexRequests",
  "getSecretSharingPubkey",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getStakeAccount",
  "getSubscription",
  "getTokenAccountBalance",
  "getTransaction",
  "getTransactionCount",
  "getTransactions",
  "getTriggeredTransactions",
  "getValidatorAccounts",
  "getValidatorHealth",
  "getVersion",
  "getWorkflowLineage",
  "isBlockhashValid",
]);

const WRITE_METHODS = new Set(["sendTransaction", "requestAirdrop", "submitEpochChange"]);

/** Bound the fan-out so one request cannot be used to hammer the node. */
const MAX_BATCH = 20;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(stringifyLossless(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  return json({
    service: "rialoscan-rpc-proxy",
    description:
      "CORS-enabled read-only JSON-RPC proxy for Rialo. Adds batching and u64-safe serialisation, which the upstream node does not provide.",
    endpoint: `${origin}/api/rpc`,
    networks: NETWORK_IDS,
    defaultNetwork: DEFAULT_NETWORK,
    usage: {
      single: `POST ${origin}/api/rpc?net=devnet  {"jsonrpc":"2.0","id":1,"method":"getBlockHeight","params":[]}`,
      batch: `POST ${origin}/api/rpc?net=devnet  [{...},{...}]  (max ${MAX_BATCH}, fanned out concurrently)`,
    },
    notes: [
      "Integers above 2^53-1 are returned as decimal strings to preserve u64 precision.",
      "Read methods only; sendTransaction, requestAirdrop and submitEpochChange are refused.",
    ],
    methods: [...READ_METHODS].sort(),
  });
}

type Payload = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown };

async function handleOne(net: ReturnType<typeof resolveNetwork>, payload: Payload) {
  const { id = null, method, params } = payload;

  if (typeof method !== "string") {
    return rpcError(id, -32600, "Invalid Request: `method` must be a string");
  }
  if (WRITE_METHODS.has(method)) {
    return rpcError(id, -32601, `Method '${method}' is not proxied: this gateway is read-only`);
  }
  if (!READ_METHODS.has(method)) {
    return rpcError(id, -32601, `Method '${method}' is not in the allow-list`);
  }
  if (params !== undefined && !Array.isArray(params)) {
    return rpcError(id, -32602, "Invalid params: `params` must be an array");
  }

  try {
    const result = await rpc(net, method, (params as unknown[]) ?? []);
    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    if (error instanceof RpcError) {
      return rpcError(id, error.code, error.details ? `${error.message} (${error.details})` : error.message);
    }
    if (error instanceof RpcTransportError) {
      return rpcError(id, -32000, error.message);
    }
    return rpcError(id, -32603, error instanceof Error ? error.message : "Internal error");
  }
}

export async function POST(request: NextRequest) {
  const net = resolveNetwork(request.nextUrl.searchParams.get("net"));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error: body is not valid JSON"), 400);
  }

  if (Array.isArray(body)) {
    if (body.length === 0) return json(rpcError(null, -32600, "Invalid Request: empty batch"), 400);
    if (body.length > MAX_BATCH) {
      return json(rpcError(null, -32600, `Batch too large: ${body.length} > ${MAX_BATCH}`), 400);
    }
    // Upstream has no batch support, so fan out and reassemble.
    return json(await Promise.all(body.map((entry) => handleOne(net, (entry ?? {}) as Payload))));
  }

  if (typeof body !== "object" || body === null) {
    return json(rpcError(null, -32600, "Invalid Request: expected an object or an array"), 400);
  }

  return json(await handleOne(net, body as Payload));
}
