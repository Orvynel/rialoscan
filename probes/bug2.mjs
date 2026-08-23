import * as R from "@rialo/ts-cdk";
const c=R.createRialoClient(R.getDefaultRialoClientConfig("devnet"));
const kp=R.Keypair.generate();
const raw=await c.requestAirdrop(kp.publicKey, BigInt(R.KELVIN_PER_RLO));
const sig=R.Signature.fromBytes(raw);
const b58=sig.toString();
await new Promise(r=>setTimeout(r,6000));
const conf=await c.confirmTransaction(sig);
console.log("confirmTransaction ->", JSON.stringify(conf));
console.log("\n-- getTransaction with each input shape --");
for (const [label,val] of [["Signature obj",sig],["base58 string",b58],["Uint8Array",raw],["number[]",Array.from(raw)]]) {
  try { const t=await c.getTransaction(val); console.log(`${label.padEnd(15)} OK ->`, JSON.stringify(t).slice(0,160)); }
  catch(e){ console.log(`${label.padEnd(15)} ERR ->`, e.message.slice(0,110)); }
}
console.log("\n-- other client methods (same defect class?) --");
const t=async(n,f)=>{ try{ const v=await f(); console.log(`${n.padEnd(26)} OK -> ${typeof v==='object'&&v!==null?(v.constructor?.name+" "+JSON.stringify(v).slice(0,90)):String(v).slice(0,60)}`);}catch(e){console.log(`${n.padEnd(26)} ERR -> ${e.message.slice(0,90)}`);} };
await t("getSignaturesForAddress", ()=>c.getSignaturesForAddress(kp.publicKey));
await t("getAccountInfo",          ()=>c.getAccountInfo(kp.publicKey));
await t("getEpochInfo",            ()=>c.getEpochInfo());
await t("getMinBalRentExempt(64)", ()=>c.getMinimumBalanceForRentExemption(64));
await t("getSecretSharingPubkey",  ()=>c.getSecretSharingPubkey());
