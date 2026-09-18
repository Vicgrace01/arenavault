import { NextResponse } from "next/server";
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";

const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER || "";
const PRIZE = "20.0000000";
const G_ADDRESS = /^G[A-Z0-9]{55}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const destination =
      (body?.destination as string | undefined) ||
      process.env.NEXT_PUBLIC_WINNER_ADDRESS;

    if (!destination || !G_ADDRESS.test(destination)) {
      return NextResponse.json(
        { error: "Invalid or missing destination address" },
        { status: 400 }
      );
    }

    const secret = process.env.ESCROW_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Missing ESCROW_SECRET" },
        { status: 500 }
      );
    }

    const escrow = Keypair.fromSecret(secret);
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");
    const account = await server.loadAccount(escrow.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "1000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: new Asset("USDC", USDC_ISSUER),
          amount: PRIZE,
        })
      )
      .setTimeout(60)
      .build();

    tx.sign(escrow);
    const result = await server.submitTransaction(tx);

    return NextResponse.json({
      success: true,
      hash: result.hash,
      from: escrow.publicKey(),
      to: destination,
      amount: PRIZE,
    });
  } catch (e: any) {
    const detail =
      (e && e.response && e.response.data) || (e && e.message) || String(e);
    return NextResponse.json(
      { error: "Payout failed", detail },
      { status: 500 }
    );
  }
}
