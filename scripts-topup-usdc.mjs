import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";

const USER = "GCAL4V4P4EHLW3DXGLIB6RHF6Y2LKOAARP6UOXF43MDMNF2H6KXFQMTK";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const AMOUNT = "20.0000000";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

const funder = Keypair.random();
console.log("Funder:", funder.publicKey());
const fb = await fetch(`https://friendbot.stellar.org?addr=${funder.publicKey()}`);
console.log("Friendbot funder:", fb.status);
await new Promise((r) => setTimeout(r, 3000));

// Add USDC trustline to funder, then issue-on-testnet by paying from a source
// that already has USDC. Since we cannot mint, we instead send XLM and tell the
// user to use the faucet. Real USDC on Stellar testnet only comes from Circle.
console.log("Use https://faucet.circle.com for USDC. Funder created for XLM topups only.");
process.exit(0);
