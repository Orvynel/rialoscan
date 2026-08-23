import * as R from "@rialo/ts-cdk";
const log=(...a)=>console.log(...a);
log("== exports sample ==", Object.keys(R).slice(0,40).join(", "));
const client = R.createRialoClient(R.getDefaultRialoClientConfig("devnet"));
log("\n== network ==");
log("configHashPrefix:", await client.getConfigHashPrefix().then(x=>String(x)).catch(e=>"ERR "+e.message));
log("blockHeight     :", await client.getBlockHeight().then(String).catch(e=>"ERR "+e.message));
const a = R.Keypair.generate(), b = R.Keypair.generate();
log("\nwallet A:", a.publicKey.toString());
log("wallet B:", b.publicKey.toString());
log("\n== airdrop 1 RLO to A ==");
try {
  const sig = await client.requestAirdrop(a.publicKey, BigInt(R.KELVIN_PER_RLO));
  log("airdrop sig:", sig.toString());
} catch(e){ log("airdrop ERR:", e.message); }
await new Promise(r=>setTimeout(r,4000));
const bal = async k => { try { return String(await client.getBalance(k.publicKey)); } catch(e){ return "ERR "+e.message; } };
log("balance A:", await bal(a), " balance B:", await bal(b));
log("\n== transfer 0.25 RLO A -> B ==");
try {
  const prefix = await client.getConfigHashPrefix();
  const ix = R.transferInstruction(a.publicKey, b.publicKey, 250_000_000n);
  const tx = R.TransactionBuilder.create().setPayer(a.publicKey)
    .setValidFrom(BigInt(Date.now())).setConfigHashPrefix(prefix).addInstruction(ix).build();
  const sig = await client.sendTransaction(tx.sign(a).serialize());
  log("transfer sig:", sig.toString());
  await new Promise(r=>setTimeout(r,5000));
  log("balance A:", await bal(a), " balance B:", await bal(b));
} catch(e){ log("transfer ERR:", e.constructor?.name, e.message); }
a.dispose(); b.dispose();
