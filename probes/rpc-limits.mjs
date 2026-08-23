/**
 * Re-verifies the RPC limitations claimed in RIALO-FINDINGS.md against live
 * devnet, so the document is evidence rather than recollection.
 *
 * Run: node rpc-limits.mjs
 */

const URL_ = "https://devnet.rialo.io";

async function rpc(method, params = []) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

/**
 * Results come back wrapped as `{ context, value }` on most methods, bare on a
 * few (`getClusterNodes` -> `{ version, nodes }`, `getRexRequests` ->
 * `{ rex_requests }`). This unwraps whichever shape arrived.
 */
function pluck(result, key) {
  if (result === null || typeof result !== "object") return result;
  if ("value" in result) return result.value;
  if (key && key in result) return result[key];
  return result;
}

async function raw(body) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, text: text.slice(0, 200) };
  }
}

const line = (s) => console.log(s);

// --- 1. JSON-RPC batching -------------------------------------------------
const batch = await raw([
  { jsonrpc: "2.0", id: 1, method: "getBlockHeight", params: [] },
  { jsonrpc: "2.0", id: 2, method: "getTransactionCount", params: [] },
]);
line("1. BATCHING");
line(`   HTTP ${batch.status}`);
line(`   ${JSON.stringify(batch.json ?? batch.text).slice(0, 220)}`);
line(`   -> array response: ${Array.isArray(batch.json)}`);

// --- 2. getAllAccounts ----------------------------------------------------
const all = await rpc("getAllAccounts", []);
line("\n2. getAllAccounts");
line(`   ${JSON.stringify(all.error ?? all.result).slice(0, 220)}`);

// --- 3. getSignaturesForAddress: limit / before ---------------------------
const addr = "EP5YsLqRnuztVapKz9QX8cPJ7DrLzcaGVn9dHupYoR3S";
const s1 = await rpc("getSignaturesForAddress", [{ address: addr }]);
const s2 = await rpc("getSignaturesForAddress", [{ address: addr, limit: 3 }]);
const list1 = pluck(s1.result) ?? [];
const list2 = pluck(s2.result) ?? [];
line("\n3. getSignaturesForAddress");
line(`   no limit    -> ${list1.length} signatures`);
line(`   limit: 3    -> ${list2.length} signatures  (honoured: ${list2.length === 3})`);
if (list1.length > 1) {
  const oldest = list1[list1.length - 1];
  const sigOf = (e) => (typeof e === "string" ? e : (e.signature ?? JSON.stringify(e).slice(0, 40)));
  const s3 = await rpc("getSignaturesForAddress", [{ address: addr, before: sigOf(oldest) }]);
  const list3 = pluck(s3.result) ?? [];
  line(`   before oldest -> ${list3.length} signatures`);
  line(`   first sig identical to unpaged first: ${sigOf(list3[0] ?? {}) === sigOf(list1[0])}`);
}

// --- 4. getTransactions: signatures / limit / before ---------------------
const t1 = await rpc("getTransactions", [{}]);
const feed = pluck(t1.result) ?? [];
line("\n4. getTransactions");
line(`   no params      -> ${feed.length} transactions`);
const t2 = await rpc("getTransactions", [{ limit: 2 }]);
const feed2 = pluck(t2.result) ?? [];
line(`   limit: 2       -> ${feed2.length}  (honoured: ${feed2.length === 2})`);
if (feed.length > 0) {
  const one = feed[0].transaction?.signatures?.[0] ?? feed[0].signature;
  const t3 = await rpc("getTransactions", [{ signatures: [one] }]);
  const feed3 = pluck(t3.result) ?? [];
  line(`   signatures:[1] -> ${feed3.length}  (filtered: ${feed3.length === 1})`);
}

// --- 5. getTransaction over raw RPC (the SDK-only bug) -------------------
if (feed.length > 0) {
  const sig = feed[0].transaction?.signatures?.[0] ?? feed[0].signature;
  const one = await rpc("getTransaction", [{ signature: sig }]);
  const tx = pluck(one.result);
  line("\n5. getTransaction over raw RPC");
  line(`   error: ${JSON.stringify(one.error ?? null)}`);
  line(`   returned an object: ${tx !== null && typeof tx === "object"}`);
  line(`   block_time field: ${JSON.stringify(one.result?.block_time ?? one.result?.blockTime ?? null)}`);
}

// --- 6. REX createdAt ----------------------------------------------------
const rex = await rpc("getRexRequests", [{ creator: addr }]);
const list = pluck(rex.result, "rex_requests") ?? [];
line("\n6. REX createdAt");
for (const r of list.slice(0, 2)) {
  line(`   created_at: ${JSON.stringify(r.created_at ?? r.createdAt)}`);
  const duty = (r.duties ?? [])[0];
  if (duty) line(`   duties[0].target_timestamp: ${JSON.stringify(duty.target_timestamp ?? duty.targetTimestamp)}`);
}

// --- 7. Ports: cluster vs on-chain account ------------------------------
const cluster = await rpc("getClusterNodes", []);
const accounts = await rpc("getValidatorAccounts", []);
const nodes = pluck(cluster.result, "nodes") ?? [];
const accs = pluck(accounts.result) ?? [];
line("\n7. PORTS");
line(`   getClusterNodes[0].address: ${JSON.stringify(nodes[0]?.address ?? nodes[0]?.multiaddr ?? null)}`);
line(`   getValidatorAccounts[0].address (base64): ${JSON.stringify(accs[0]?.address ?? null)}`);
line(`   getValidatorAccounts[0].subdag_sync_address: ${JSON.stringify(accs[0]?.subdag_sync_address ?? null)}`);
line(`   account keys are base58, cluster keys are base64:`);
line(`     account.network_key   = ${JSON.stringify(accs[0]?.network_key ?? null)}`);
line(`     cluster.networkPubkey = ${JSON.stringify(nodes[0]?.networkPubkey ?? null)}`);
