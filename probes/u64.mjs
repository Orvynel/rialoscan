import * as R from "@rialo/ts-cdk";
const c=R.createRialoClient(R.getDefaultRialoClientConfig("devnet"));
const ei=await c.getEpochInfo();
console.log("SDK  slotsInEpoch :", ei.slotsInEpoch.toString());
const rawResp=await fetch("https://devnet.rialo.io/",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getEpochInfo"})}).then(r=>r.text());
const m=rawResp.match(/"slotsInEpoch":(\d+)/);
console.log("WIRE slotsInEpoch :", m[1]);
console.log("MATCH?            :", ei.slotsInEpoch.toString()===m[1] ? "yes" : "NO  <-- precision loss");
console.log("u64::MAX          : 18446744073709551615");
console.log("2^64              :", (2n**64n).toString());
console.log("\ndiagnosis: JSON.parse -> double -> BigInt loses the low bits above 2^53.");
console.log("Number(18446744073709551615) =", Number("18446744073709551615").toString());
console.log("BigInt(Number(u64max))       =", BigInt(Number("18446744073709551615")).toString());
// does it affect a realistic balance? test a value > 2^53 kelvin (~9007199 RLO)
const big="9007199254740993";  // 2^53+1
console.log("\n2^53+1 roundtrip via double:", BigInt(Number(big)).toString(), "(input", big+")");
