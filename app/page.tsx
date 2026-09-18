"use client";

import { useMemo, useState } from "react";
import { usePollar, WalletButton } from "@pollar/react";

const STAKE = "10.00";
const PRIZE = "20.00";

const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS!;
const WINNER = process.env.NEXT_PUBLIC_WINNER_ADDRESS!;

type Phase = "idle" | "staking" | "staked" | "earning" | "settled";

function extractHash(res: any): string | null {
  return (
    res?.hash ??
    res?.txHash ??
    res?.transactionHash ??
    res?.id ??
    res?.data?.hash ??
    null
  );
}

export default function Home() {
  const pollar = usePollar() as any;
  const {
    isAuthenticated,
    wallet,
    runTx,
    openEarnModal,
    openSendModal,
    openReceiveModal,
    openTxHistoryModal,
    openWalletBalanceModal,
    login,
    logout,
  } = pollar;

  const [playerAStaked, setPlayerAStaked] = useState(false);
  const [playerBStaked, setPlayerBStaked] = useState(false);
  const [earnDeposited, setEarnDeposited] = useState(false);
  const [winnerPaid, setWinnerPaid] = useState(false);
  const [stakeTxHash, setStakeTxHash] = useState<string | null>(null);
  const [payoutTxHash, setPayoutTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const USDC = useMemo(
    () => ({
      type: "credit_alphanum4" as const,
      code: "USDC",
      issuer: process.env.NEXT_PUBLIC_USDC_ISSUER!,
    }),
    []
  );

  const pool = (playerAStaked ? 10 : 0) + (playerBStaked ? 10 : 0);

  const phase: Phase = winnerPaid
    ? "settled"
    : earnDeposited
    ? "earning"
    : playerAStaked && playerBStaked
    ? "staked"
    : playerAStaked || playerBStaked
    ? "staking"
    : "idle";

  async function stake(player: "A" | "B") {
    if (!isAuthenticated || !wallet?.address) return;
    setBusy(true);
    setError(null);
    try {
      const res: any = await runTx("payment", {
        destination: ESCROW,
        amount: STAKE,
        asset: USDC,
      });
      console.log("[stake] response:", res);

      const hash = extractHash(res);
      if (!hash) {
        throw new Error(
          `Transaction did not return a hash. Response: ${JSON.stringify(res)}`
        );
      }

      setStakeTxHash(hash);
      if (player === "A") setPlayerAStaked(true);
      else setPlayerBStaked(true);
    } catch (e: any) {
      console.error("[stake] error:", e);
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function routeToEarn() {
    setError("Earn vaults are not provisioned for this testnet app yet. On mainnet, earnDeposit() routes the pool into a DeFindex or Blend vault.");
    try {
      openEarnModal();
      setEarnDeposited(true);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function resolveWinner() {
    if (!isAuthenticated || !wallet?.address) return;
    if (!WINNER) {
      setError("Set NEXT_PUBLIC_WINNER_ADDRESS in .env.local and restart.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payout", { method: "POST" });
      const data = await res.json();
      console.log("[payout] response:", data);

      if (!res.ok || !data?.hash) {
        throw new Error(
          `Payout failed. ${JSON.stringify(data?.detail ?? data)}`
        );
      }

      setPayoutTxHash(data.hash);
      setWinnerPaid(true);
    } catch (e: any) {
      console.error("[payout] error:", e);
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function resetDemo() {
    setPlayerAStaked(false);
    setPlayerBStaked(false);
    setEarnDeposited(false);
    setWinnerPaid(false);
    setStakeTxHash(null);
    setPayoutTxHash(null);
    setError(null);
  }

  async function handleLogin() {
    setError(null);
    try {
      await login({ provider: "google" });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ArenaVault</h1>
          <p className="text-neutral-400 text-sm">
            Prize pool that earns yield while you play · Stellar Testnet
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <button
              onClick={openReceiveModal}
              className="text-sm text-neutral-400 hover:text-neutral-200"
            >
              Receive
            </button>
          )}
          <WalletButton />
        </div>
      </header>

      {!isAuthenticated && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-10 text-center">
          <p className="text-neutral-300 mb-6">
            Connect your Pollar wallet to enter the match.
          </p>
          <button
            onClick={handleLogin}
            className="rounded-lg bg-white text-black font-semibold px-5 py-2.5 hover:bg-neutral-200"
          >
            Continue with Google
          </button>
          <p className="text-xs text-neutral-500 mt-4">
            Email OTP and GitHub also work from the Pollar login modal.
          </p>
        </section>
      )}

      {isAuthenticated && (
        <div className="space-y-6">
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-3 flex items-center justify-between gap-4">
            <div className="text-xs text-neutral-500 min-w-0">
              Connected wallet
              <p className="font-mono text-neutral-300 text-sm truncate">
                {wallet?.address ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openTxHistoryModal}
                className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
              >
                History
              </button>
              <button
                onClick={logout}
                className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
              >
                Log out
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-emerald-400">
                Live Match
              </span>
              <span className="text-xs text-neutral-500 capitalize">
                Phase: {phase}
              </span>
            </div>
            <h2 className="text-2xl font-bold">Call of Duty: Mobile — 1v1</h2>
            <p className="text-neutral-500 text-sm mt-1">
              Entry fee 10.00 USDC per player · Winner takes the pool + yield
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <PlayerCard
                name="Player A"
                staked={playerAStaked}
                disabled={busy || playerAStaked}
                busy={busy && !playerAStaked}
                onStake={() => stake("A")}
              />
              <PlayerCard
                name="Player B"
                staked={playerBStaked}
                disabled={busy || playerBStaked}
                busy={busy && !playerBStaked}
                onStake={() => stake("B")}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-baseline justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Total Prize Pool
                </p>
                <p className="text-5xl font-bold mt-1">
                  {pool.toFixed(2)}{" "}
                  <span className="text-xl text-neutral-400">USDC</span>
                </p>
              </div>
              <button
                onClick={routeToEarn}
                disabled={pool === 0 || earnDeposited || busy}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black font-semibold px-4 py-2"
              >
                {earnDeposited ? "Earn preview (testnet)" : "Route to Earn"}
              </button>
            </div>
            {earnDeposited && (
              <p className="text-xs text-emerald-400 mt-3">
                Testnet Earn vault not provisioned. SDK path shown for mainnet.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Settlement
                </p>
                <p className="text-neutral-300 text-sm mt-1">
                  Escrow releases pool to Player A
                </p>
              </div>
              <button
                onClick={resolveWinner}
                disabled={pool < 20 || winnerPaid || busy}
                className="rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold px-4 py-2"
              >
                {winnerPaid ? "Paid ✓" : "Resolve Winner (Player A)"}
              </button>
            </div>
          </section>

          {(stakeTxHash || payoutTxHash) && (
            <section className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-6 space-y-3">
              <p className="text-xs uppercase tracking-widest text-emerald-400">
                On-chain proof
              </p>
              {stakeTxHash && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Stake settlement</p>
                  <a
                    className="text-emerald-300 font-mono text-xs break-all underline"
                    href={`https://stellar.expert/explorer/testnet/tx/${stakeTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {stakeTxHash}
                  </a>
                </div>
              )}
              {payoutTxHash && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Winner payout</p>
                  <a
                    className="text-emerald-300 font-mono text-xs break-all underline"
                    href={`https://stellar.expert/explorer/testnet/tx/${payoutTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {payoutTxHash}
                  </a>
                </div>
              )}
            </section>
          )}

          <section className="flex flex-wrap gap-3 justify-center pt-2">
            <button
              onClick={openSendModal}
              className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
            >
              Open Send modal
            </button>
            <button
              onClick={openWalletBalanceModal}
              className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
            >
              Wallet balances
            </button>
            <button
              onClick={resetDemo}
              className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
            >
              Reset demo
            </button>
          </section>

          {error && (
            <section className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300 text-sm whitespace-pre-wrap">
              {error}
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function PlayerCard({
  name,
  staked,
  disabled,
  busy,
  onStake,
}: {
  name: string;
  staked: boolean;
  disabled: boolean;
  busy: boolean;
  onStake: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <p className="font-semibold">{name}</p>
      <p className="text-xs text-neutral-500 mb-3">
        {staked ? "Staked 10.00 USDC" : "Not staked"}
      </p>
      <button
        onClick={onStake}
        disabled={disabled}
        className="w-full rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 py-2 text-sm"
      >
        {staked ? "Confirmed ✓" : busy ? "Signing…" : "Stake 10 USDC"}
      </button>
    </div>
  );
}
