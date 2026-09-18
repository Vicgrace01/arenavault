import { Horizon } from "@stellar/stellar-sdk";

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const PAY_TO = process.env.X402_PAY_TO || "";
const PRICE = "0.001";
const NETWORK = "testnet";
const MEMO = "scout-report";

function challenge() {
  return new Response(JSON.stringify({ error: "Payment Required" }), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "x-402-amount": PRICE,
      "x-402-asset-code": "USDC",
      "x-402-issuer": USDC_ISSUER,
      "x-402-network": NETWORK,
      "x-402-destination": PAY_TO,
      "x-402-memo": MEMO,
    },
  });
}

export async function GET(req: Request) {
  const txHash =
    req.headers.get("x-402-transaction-hash") ||
    req.headers.get("X-402-Transaction-Hash") ||
    "";

  if (!txHash) return challenge();

  try {
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");
    const tx = await server.transactions().transaction(txHash).call();
    if (!tx.successful) return challenge();

    const ops = await tx.operations();
    const payment = (ops.records as any[]).find(
      (o) =>
        o.type === "payment" &&
        o.to === PAY_TO &&
        o.asset_code === "USDC" &&
        o.asset_issuer === USDC_ISSUER
    );

    if (!payment) return challenge();
    if (parseFloat(payment.amount) < parseFloat(PRICE)) return challenge();

    return Response.json({
      opponent: "Player B",
      avgKd: 1.24,
      playstyle: "Aggressive pusher, weak on retreat",
      weakRounds: [
        "Round 2 — mid-range loadout swaps",
        "Round 3 — objective B rotations",
      ],
      recommendation: "Hold back on Round 2, contest B on Round 3",
      paid: { txHash, amount: payment.amount },
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return challenge();
  }
}
