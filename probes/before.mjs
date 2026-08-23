/**
 * Does getSignaturesForAddress honour `before`?
 *
 * The naive test is unreliable: this address receives new signatures every
 * second, so a changed first element could just be new activity. The reliable
 * test is set overlap — if `before: X` works, none of the results may be X or
 * anything from the page X came from.
 */
const U = "https://devnet.rialo.io";
const rpc = async (m, p) => (await fetch(U,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:m,params:p})})).json();
const pluck = (r) => (r && typeof r === "object" && "value" in r ? r.value : r);
const addr = "EP5YsLqRnuztVapKz9QX8cPJ7DrLzcaGVn9dHupYoR3S";
const sigOf = (e) => (typeof e === "string" ? e : e.signature);

const page = pluck((await rpc("getSignaturesForAddress", [{ address: addr }])).result) ?? [];
const first = page.map(sigOf);
const oldest = first[first.length - 1];
console.log(`page 1: ${first.length} sigs, oldest = ${oldest?.slice(0,16)}…`);

const paged = pluck((await rpc("getSignaturesForAddress", [{ address: addr, before: oldest }])).result) ?? [];
const second = paged.map(sigOf);
const overlap = second.filter((s) => first.includes(s));
console.log(`before oldest: ${second.length} sigs`);
console.log(`  overlap with page 1: ${overlap.length}/${second.length}`);
console.log(`  contains the cursor itself: ${second.includes(oldest)}`);
console.log(`  -> before honoured: ${overlap.length === 0 && second.length > 0}`);

// Control: two identical calls back to back, to measure how much the feed moves
// on its own. If this also shows churn, the churn above is not evidence.
const a = (pluck((await rpc("getSignaturesForAddress", [{ address: addr }])).result) ?? []).map(sigOf);
const b = (pluck((await rpc("getSignaturesForAddress", [{ address: addr }])).result) ?? []).map(sigOf);
console.log(`control (same call twice): ${a.filter((s) => !b.includes(s)).length} of ${a.length} differ`);
