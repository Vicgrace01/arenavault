import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";

const USER = "GCN4WICDXNHQAELFJTBY5RYU2HG46RMMYRLGMU25ZQLOVBIF2PXKZNO4";
const TOPUP = "3.0000000";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

const acc = await server.loadAccount(USER);
const native = acc.balances.find((b) => b.asset_type === "native");
console.log("Current XLM:", native?.balance ?? "0");

const funder = Keypair.random();
console.log("Funder:", funder.publicKey());
const fb = await fetch(`https://friendbot.stellar.org?addr=${funder.publicKey()}`);
console.log("Friendbot:", fb.status);
await new Promise((r) => setTimeout(r, 3000));

const funderAcct = await server.loadAccount(funder.publicKey());
const tx = new TransactionBuilder(funderAcct, {
  fee: "1000",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: USER,
      asset: Asset.native(),
      amount: TOPUP,
    })
  )
  .setTimeout(60)
  .build();
tx.sign(funder);

try {
  const result = await server.submitTransaction(tx);
  console.log("TOPUP_TX:", result.hash);
} catch (e) {
  console.error("TOPUP_FAILED:", JSON.stringify(e.response?.data ?? e.message));
}

const after = await server.loadAccount(USER);
const afterNative = after.balances.find((b) => b.asset_type === "native");
console.log("New XLM:", afterNative?.balance ?? "0");
process.exit(0);
