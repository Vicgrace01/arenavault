import { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset } from "@stellar/stellar-sdk";

const ESCROW_SECRET = "SBNPBGDGGN5X2XAOXNDSST6BSYW2MC7APQIGHNERB2SX6ZE7GMLU6U4O";
const DRAIN_TO = "GCAL4V4P4EHLW3DXGLIB6RHF6Y2LKOAARP6UOXF43MDMNF2H6KXFQMTK";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const escrow = Keypair.fromSecret(ESCROW_SECRET);
const acct = await server.loadAccount(escrow.publicKey());
const usdcBal = acct.balances.find(
  (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
);
console.log("Escrow USDC balance:", usdcBal?.balance ?? "0");

if (!usdcBal || parseFloat(usdcBal.balance) === 0) {
  console.log("Already empty. Nothing to drain.");
  process.exit(0);
}

const tx = new TransactionBuilder(acct, {
  fee: "1000",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: DRAIN_TO,
      asset: new Asset("USDC", USDC_ISSUER),
      amount: usdcBal.balance,
    })
  )
  .setTimeout(60)
  .build();
tx.sign(escrow);
const r = await server.submitTransaction(tx);
console.log("DRAIN_TX:", r.hash);
process.exit(0);
