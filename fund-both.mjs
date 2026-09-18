import { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset } from "@stellar/stellar-sdk";

const USER = "PASTE_PLAYER_B_ADDRESS_HERE";
const XLM_TOPUP = "10.0000000";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_TOPUP = "10.0000000";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

const funder = Keypair.random();
console.log("Funder:", funder.publicKey());
const fb = await fetch(`https://friendbot.stellar.org?addr=${funder.publicKey()}`);
console.log("Friendbot:", fb.status);
await new Promise((r) => setTimeout(r, 3000));

const fa = await server.loadAccount(funder.publicKey());
const tx1 = new TransactionBuilder(fa, { fee: "1000", networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ destination: USER, asset: Asset.native(), amount: XLM_TOPUP }))
  .setTimeout(60)
  .build();
tx1.sign(funder);
const r1 = await server.submitTransaction(tx1);
console.log("XLM_TOPUP_TX:", r1.hash);

console.log("Now send USDC from the Circle faucet:");
console.log("https://faucet.circle.com");
console.log("Network: Stellar Testnet");
console.log("Address:", USER);
console.log("Click Send 20 USDC");

process.exit(0);
