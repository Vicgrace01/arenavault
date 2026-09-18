import { withX402 } from "x402-stellar-sdk/server/next";

const options = {
  price: "0.001",
  assetCode: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  network: "testnet" as const,
  destination: process.env.X402_PAY_TO!,
  memo: "scout-report",
};

export async function GET(req: Request) {
  const res402 = await withX402(req.headers, options);
  if (res402) return res402;

  return Response.json({
    opponent: "Player B",
    avgKd: 1.24,
    playstyle: "Aggressive pusher, weak on retreat",
    weakRounds: [
      "Round 2 — mid-range loadout swaps",
      "Round 3 — objective B rotations",
    ],
    recommendation: "Hold back on Round 2, contest B on Round 3",
    generatedAt: new Date().toISOString(),
  });
}
