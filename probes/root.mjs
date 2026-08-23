import * as R from "@rialo/ts-cdk";
const kp=R.Keypair.generate();
const local=kp.sign(new TextEncoder().encode("x"));
const c=R.createRialoClient(R.getDefaultRialoClientConfig("devnet"));
const rpc=await c.requestAirdrop(kp.publicKey, 1000000n);
const d=o=>({ctor:o?.constructor?.name, isSignature:o instanceof R.Signature, isU8:o instanceof Uint8Array,
  isArray:Array.isArray(o), len:o?.length, hasToBytes:typeof o?.toBytes, keys:Object.keys(o||{}).slice(0,6)});
console.log("LOCAL kp.sign()      :", d(local));
console.log("RPC requestAirdrop() :", d(rpc));
// WORKAROUND: rehydrate into a real Signature
const bytes = rpc instanceof Uint8Array ? rpc : Uint8Array.from(rpc);
const fixed = R.Signature.fromBytes(bytes);
console.log("\nrehydrated .toString():", fixed.toString());
await new Promise(r=>setTimeout(r,6000));
try{ const t=await c.getTransaction(fixed); console.log("getTransaction(rehydrated) OK:", JSON.stringify(t).slice(0,300)); }
catch(e){ console.log("getTransaction(rehydrated) ERR:", e.message.slice(0,200)); }
try{ const st=await c.confirmTransaction(fixed); console.log("confirmTransaction OK:", JSON.stringify(st).slice(0,200)); }
catch(e){ console.log("confirmTransaction ERR:", e.message.slice(0,200)); }
