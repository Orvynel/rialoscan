// Probe: validator topology. Answers two questions the UI depends on:
//  1. Do getClusterNodes and getValidatorAccounts agree on ports/keys?
//  2. What exactly is the base64 `address` field on a validator account?
const RPC = process.argv[2] ?? "https://devnet.rialo.io";

async function call(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return JSON.parse(await r.text());
}

// Minimal binary-multiaddr reader: enough for /dns/<name>/udp/<port>.
const PROTO = { 4: "ip4", 6: "tcp", 41: "ip6", 53: "dns", 54: "dns4", 55: "dns6", 56: "dnsaddr", 273: "udp", 421: "p2p" };

function varint(buf, i) {
  let value = 0, shift = 0, byte;
  do {
    byte = buf[i++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return [value, i];
}

function decodeMultiaddr(base64) {
  const buf = Buffer.from(base64, "base64");
  let i = 0;
  const out = [];
  while (i < buf.length) {
    let code;
    [code, i] = varint(buf, i);
    const name = PROTO[code] ?? `proto${code}`;
    if (name.startsWith("dns")) {
      let len;
      [len, i] = varint(buf, i);
      out.push(`/${name}/${buf.subarray(i, i + len).toString("utf8")}`);
      i += len;
    } else if (name === "udp" || name === "tcp") {
      out.push(`/${name}/${buf.readUInt16BE(i)}`);
      i += 2;
    } else if (name === "ip4") {
      out.push(`/ip4/${[...buf.subarray(i, i + 4)].join(".")}`);
      i += 4;
    } else {
      out.push(`/${name}?+${buf.length - i}b`);
      break;
    }
  }
  return out.join("");
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of s) {
    const idx = B58.indexOf(c);
    if (idx < 0) return null;
    n = n * 58n + BigInt(idx);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let lead = 0;
  for (const c of s) { if (c === "1") lead++; else break; }
  return Buffer.concat([Buffer.alloc(lead), Buffer.from(hex, "hex")]);
}

const cluster = await call("getClusterNodes");
const accounts = await call("getValidatorAccounts");
const nodes = cluster.result.nodes;
const vals = accounts.result.value;

console.log("getClusterNodes top-level keys:", Object.keys(cluster.result).join(", "));
console.log("node keys:", Object.keys(nodes[0]).join(", "));
console.log("validator account keys:", Object.keys(vals[0]).join(", "));
console.log();

for (const node of nodes) {
  const account = vals.find((v) => v.hostname === node.hostname);
  console.log(node.hostname);
  console.log("  clusterNodes.address      ", node.address);
  console.log("  account.address (decoded) ", account ? decodeMultiaddr(account.address) : "no match");
  console.log("  account.subdag (decoded)  ", account ? decodeMultiaddr(account.subdag_sync_address) : "-");
  console.log("  lastCommittedRound        ", node.lastCommittedRound);
  console.log("  stake / commission / rate ", node.stake, "/", account?.commission, "/", account?.commission_rate);
  console.log("  unbonding_periods         ", JSON.stringify(account?.unbonding_periods));
  if (account) {
    const b58 = b58decode(account.network_key);
    const b64 = Buffer.from(node.networkPubkey, "base64");
    console.log("  network key encodings match", b58 && b58.equals(b64), "(b58 in accounts, b64 in nodes)");
    console.log("  authority_key identical    ", account.authority_key === node.authorityPubkey);
  }
  console.log();
}
