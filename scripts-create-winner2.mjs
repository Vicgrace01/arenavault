import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const kp = Keypair.random();
console.log("PUBLIC:", kp.publicKey());

const fb = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
console.log("Friendbot:", fb.status);
await new Promise((r) => setTimeout(r, 3000));

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const source = await server.loadAccount(kp.publicKey());
const tx = new TransactionBuilder(source, {
  fee: "100",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) })
  )
  .setTimeout(60)
  .build();
tx.sign(kp);

try {
  const result = await server.submitTransaction(tx);
  console.log("TRUSTLINE_TX:", result.hash);
} catch (e) {
  console.error("TRUSTLINE_FAILED:", JSON.stringify(e.response?.data ?? e.message));
}

process.exit(0);
