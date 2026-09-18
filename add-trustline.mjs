import { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset } from "@stellar/stellar-sdk";

const X402_SECRET = process.env.X402_SECRET_ARG;
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

if (!X402_SECRET) {
  console.error("Pass the secret: X402_SECRET_ARG=S... node add-trustline.mjs");
  process.exit(1);
}

const kp = Keypair.fromSecret(X402_SECRET);
console.log("Public:", kp.publicKey());

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const source = await server.loadAccount(kp.publicKey());

const hasTrust = source.balances.some(
  (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
);

if (hasTrust) {
  console.log("Trustline already exists. Nothing to do.");
  process.exit(0);
}

const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }))
  .setTimeout(60)
  .build();
tx.sign(kp);

try {
  const r = await server.submitTransaction(tx);
  console.log("TRUSTLINE_TX:", r.hash);
} catch (e) {
  console.error("FAILED:", JSON.stringify(e.response?.data ?? e.message));
}
process.exit(0);
