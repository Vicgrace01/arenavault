import { withX402 } from "x402-stellar-sdk/server/next";

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const PAY_TO = process.env.X402_PAY_TO || "";

const options = {
  price: "0.001",
  assetCode: "USDC",
  issuer: USDC_ISSUER,
  network: "testnet" as const,
  destination: PAY_TO,
  memo: "scout-report",
};

export async function GET(req: Request) {
  const incomingHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    incomingHeaders[key] = value;
  });

  let res402: Response | null = null;
  let verifyError: string | null = null;

  try {
    res402 = await withX402(req.headers, options);
  } catch (e: any) {
    verifyError = e?.message ?? String(e);
  }

  if (res402) {
    // Debug payload so we can see what the server actually received
    return Response.json(
      {
        error: "Payment Required",
        amount: "0.001",
        assetCode: "USDC",
        issuer: USDC_ISSUER,
        network: "testnet",
        destination: PAY_TO,
        memo: "scout-report",
        debug: {
          receivedHeaders: incomingHeaders,
          verifyError,
          payToConfigured: PAY_TO.length > 0,
        },
      },
      { status: 402 }
    );
  }

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
