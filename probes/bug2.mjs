/**
 * SDK defect 2: getTransaction throws for every input shape.
 *
 * The control section at the bottom matters as much as the failure above it. If
 * every client method failed, the fault would be the transport or this script,
 * not getTransaction — so the other reads are exercised to show they succeed
 * against the same client, over the same connection, in the same run.
 *
 * Note the serializer: several methods return objects containing BigInt, and
 * plain JSON.stringify throws "Do not know how to serialize a BigInt" on those.
 * That is a property of JSON.stringify, not of the SDK. An earlier version of
 * this script used plain stringify and reported four healthy methods as broken.
 */
import * as R from "@rialo/ts-cdk";

const S = (v) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? `${x}n` : x));

const c = R.createRialoClient(R.getDefaultRialoClientConfig("devnet"));
const kp = R.Keypair.generate();

// Defect 1 in passing: this is declared Promise<Signature> and returns raw bytes.
const raw = await c.requestAirdrop(kp.publicKey, BigInt(R.KELVIN_PER_RLO));
console.log(`requestAirdrop     -> ${raw.constructor.name}(${raw.length}), not a Signature`);

const sig = R.Signature.fromBytes(raw);
const b58 = sig.toString();
await new Promise((r) => setTimeout(r, 6000));
console.log("confirmTransaction ->", S(await c.confirmTransaction(sig)));

console.log("\n-- getTransaction, every input shape the types permit --");
for (const [label, val] of [
  ["Signature obj", sig],
  ["base58 string", b58],
  ["Uint8Array", raw],
  ["number[]", Array.from(raw)],
]) {
  try {
    console.log(`${label.padEnd(15)} OK  ->`, S(await c.getTransaction(val)).slice(0, 160));
  } catch (e) {
    console.log(`${label.padEnd(15)} ERR ->`, e.message.slice(0, 110));
  }
}

console.log("\n-- control: other reads on the same client, same run --");
const t = async (n, f) => {
  try {
    console.log(`${n.padEnd(26)} OK  -> ${S(await f()).slice(0, 90)}`);
  } catch (e) {
    console.log(`${n.padEnd(26)} ERR -> ${e.message.slice(0, 90)}`);
  }
};
await t("getSignaturesForAddress", () => c.getSignaturesForAddress(kp.publicKey));
await t("getAccountInfo", () => c.getAccountInfo(kp.publicKey));
await t("getEpochInfo", () => c.getEpochInfo());
await t("getMinBalRentExempt(64)", () => c.getMinimumBalanceForRentExemption(64));
await t("getSecretSharingPubkey", () => c.getSecretSharingPubkey());
