/**
 * Re-verifies §7.7, §7.8 and §7.9 of RIALO-FINDINGS.md against both live
 * networks: that `getBlock` has no lightweight form, what it costs, that the two
 * networks run different node builds, and that a block list cannot anchor its
 * window to a separately-fetched height.
 *
 * Run: node blocks.mjs
 */

const NETWORKS = {
  devnet: "https://devnet.rialo.io",
  testnet: "https://testnet.rialo.io",
};

async function call(url, method, params = []) {
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  return { ms: Date.now() - started, bytes: text.length, json: JSON.parse(text) };
}

/** Most methods wrap their result as `{ context, value }`. */
const pluck = (r) => (r !== null && typeof r === "object" && "value" in r ? r.value : r);

/** The readable build number only exists on a wrapped response's context (§7.8). */
const apiVersion = (r) =>
  r !== null && typeof r === "object" && r.context ? r.context.api_version : undefined;

const line = (s = "") => console.log(s);

/** §7.7 — every documented "give me less" parameter is silently ignored. */
const DETAIL_VARIANTS = [
  ["baseline", {}],
  ["transactionDetails:none", { transactionDetails: "none" }],
  ["transactionDetails:signatures", { transactionDetails: "signatures" }],
  ["transaction_details:none", { transaction_details: "none" }],
  ["rewards:false", { rewards: false }],
  ["maxSupportedTransactionVersion:0", { maxSupportedTransactionVersion: 0 }],
];

async function detailLevels(url, height) {
  line(`  §7.7  getBlock(${height}) with each "give me less" parameter:`);
  const sizes = new Set();
  for (const [label, extra] of DETAIL_VARIANTS) {
    const r = await call(url, "getBlock", [{ blockHeight: height, ...extra }]);
    if (r.json.error) {
      line(`          ${label.padEnd(34)} ERROR ${r.json.error.message.slice(0, 60)}`);
      continue;
    }
    const block = pluck(r.json.result) ?? {};
    sizes.add(r.bytes);
    line(
      `          ${label.padEnd(34)} ${String(r.bytes).padStart(7)} B  ${String(r.ms).padStart(5)} ms  ` +
        `txs=${(block.transactions ?? []).length}`,
    );
  }
  line(
    sizes.size === 1
      ? `          -> all responses identical in size: no lightweight form exists.`
      : `          -> sizes differ (${[...sizes].join(", ")}): a parameter took effect. Re-read §7.7.`,
  );
}

async function latency(url, tip) {
  const seq = [];
  for (let i = 10; i < 15; i++) {
    const r = await call(url, "getBlock", [{ blockHeight: tip - i }]);
    seq.push(r.json.error ? "ERR" : `${r.ms}ms/${(r.bytes / 1024).toFixed(0)}K`);
  }
  line(`  §7.7  five sequential getBlock: ${seq.join("  ")}`);

  const heights = Array.from({ length: 10 }, (_, i) => tip - 20 - i);
  const started = Date.now();
  const rs = await Promise.all(heights.map((h) => call(url, "getBlock", [{ blockHeight: h }])));
  const kib = rs.reduce((sum, r) => sum + r.bytes, 0) / 1024;
  line(`  §7.7  ten in parallel:          ${Date.now() - started}ms total, ${kib.toFixed(0)} KiB`);
}

/** §7.9 — sequential reads disagree; concurrent reads agree. */
async function headAnchor(url) {
  const seqHeight = Number((await call(url, "getBlockHeight")).json.result);
  const seqFeed = pluck((await call(url, "getTransactions", [{ signatures: [] }])).json.result) ?? [];
  const seqMax = Math.max(...seqFeed.map((t) => Number(t.blockHeight)).filter(Number.isFinite));
  line(`  §7.9  read one after the other: height=${seqHeight}  feed newest=${seqMax}  gap=${seqMax - seqHeight}`);

  const [h, e, f] = await Promise.all([
    call(url, "getBlockHeight"),
    call(url, "getEpochInfo"),
    call(url, "getTransactions", [{ signatures: [] }]),
  ]);
  const height = Number(h.json.result);
  const epoch = pluck(e.json.result) ?? {};
  const feed = pluck(f.json.result) ?? [];
  const hs = feed.map((t) => Number(t.blockHeight)).filter(Number.isFinite);
  const max = Math.max(...hs);
  line(
    `  §7.9  read concurrently:         height=${height}  epochInfo=${epoch.blockHeight}  ` +
      `feed newest=${max}  gap=${max - height}`,
  );
  line(`          feed spans ${max - Math.min(...hs) + 1} heights for ${feed.length} transactions`);
}

for (const [net, url] of Object.entries(NETWORKS)) {
  // §7.8 — getVersion is a bare commit SHA; the semver rides on any wrapped
  // response's context. Read both so the difference is visible, not assumed.
  const sha = pluck((await call(url, "getVersion")).json.result);
  const features = (await call(url, "getActiveFeatures")).json.result;
  const semver = apiVersion(features);
  const tip = Number((await call(url, "getBlockHeight")).json.result);

  line();
  line(`=== ${net} ===`);
  line(`  §7.8  getVersion          -> ${JSON.stringify(sha)}`);
  line(`  §7.8  context.api_version -> ${semver ?? "(absent)"}`);
  line(`        head               -> ${tip}`);
  await detailLevels(url, tip - 5);
  await latency(url, tip);
  await headAnchor(url);
}

line();
line("Claims checked: §7.7 no lightweight getBlock and its cost, §7.8 getVersion is");
line("a commit SHA while api_version carries the build, §7.9 why a block window");
line("cannot anchor to a separately-fetched height.");
