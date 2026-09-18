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

export async function POST() {
  try {
    const secret = process.env.ESCROW_SECRET;
    const destination = process.env.NEXT_PUBLIC_WINNER_ADDRESS;
    if (!secret || !destination) {
      return NextResponse.json(
        { error: "Missing ESCROW_SECRET or NEXT_PUBLIC_WINNER_ADDRESS" },
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
