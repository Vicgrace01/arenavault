"use client";

import { useEffect, useMemo, useState } from "react";
import { usePollar, WalletButton } from "@pollar/react";

const STAKE = "10.00";

const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS!;
const WINNER = process.env.NEXT_PUBLIC_WINNER_ADDRESS!;

type Phase = "idle" | "staking" | "staked" | "earning" | "settled";
type Screen = "splash" | "landing" | "app";

function extractHash(res: any): string | null {
  return res?.hash ?? res?.txHash ?? res?.transactionHash ?? res?.id ?? null;
}

function explorerAccount(addr: string) {
  return "https://stellar.expert/explorer/testnet/account/" + addr;
}

function explorerTx(hash: string) {
  return "https://stellar.expert/explorer/testnet/tx/" + hash;
}

function short(addr: string | undefined) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function StatusDot({ state }: { state: "idle" | "pending" | "done" }) {
  const color =
    state === "done"
      ? "bg-emerald-500"
      : state === "pending"
      ? "bg-amber-400 animate-pulse"
      : "bg-neutral-700";
  return <span className={"inline-block h-2 w-2 rounded-full " + color} />;
}

export default function Home() {
  const pollar = usePollar() as any;
  const {
    isAuthenticated,
    wallet,
    runTx,
    openEarnModal,
    openReceiveModal,
    openTxHistoryModal,
    openWalletBalanceModal,
    login,
    logout,
    logoutEverywhere,
  } = pollar;

  const [screen, setScreen] = useState<Screen>("splash");
  const [adminView, setAdminView] = useState(false);
  const [playerAStaked, setPlayerAStaked] = useState(false);
  const [playerBStaked, setPlayerBStaked] = useState(false);
  const [earnPreviewed, setEarnPreviewed] = useState(false);
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
    : earnPreviewed
    ? "earning"
    : playerAStaked && playerBStaked
    ? "staked"
    : playerAStaked || playerBStaked
    ? "staking"
    : "idle";

  const stakeStateA: "idle" | "pending" | "done" = playerAStaked
    ? "done"
    : busy
    ? "pending"
    : "idle";
  const stakeStateB: "idle" | "pending" | "done" = playerBStaked
    ? "done"
    : busy
    ? "pending"
    : "idle";
  const earnState: "idle" | "pending" | "done" = earnPreviewed ? "done" : "idle";
  const settleState: "idle" | "pending" | "done" = winnerPaid ? "done" : "idle";

  useEffect(() => {
    const t = setTimeout(() => setScreen("landing"), 2400);
    return () => clearTimeout(t);
  }, []);

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
          "Transaction did not return a hash. Response: " + JSON.stringify(res)
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
    setError(
      "Earn vaults are not provisioned for this testnet app yet. On mainnet, earnDeposit() routes the pool into a DeFindex or Blend vault."
    );
    try {
      openEarnModal();
      setEarnPreviewed(true);
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
          "Payout failed. " + JSON.stringify(data?.detail ?? data)
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
    setEarnPreviewed(false);
    setWinnerPaid(false);
    setStakeTxHash(null);
    setPayoutTxHash(null);
    setError(null);
  }

  async function handleLogin() {
    setError(null);
    try {
      await login({ provider: "google" });
      setScreen("app");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {}
    setScreen("landing");
  }

  async function handleLogoutEverywhere() {
    try {
      await logoutEverywhere();
    } catch {}
    setScreen("landing");
  }

  // ============ SPLASH ============
  if (screen === "splash") {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center relative overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative text-center animate-splash-in px-6">
          <div className="h-24 w-24 rounded-3xl bg-emerald-500 flex items-center justify-center text-black font-bold text-4xl mx-auto mb-6 animate-glow">
            AV
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-3">
            Gamers Week · Pollar Hackathon
          </p>
          <h1 className="text-5xl font-bold tracking-tight">ArenaVault</h1>
          <p className="text-neutral-500 text-sm mt-4">
            Initializing on Stellar testnet…
          </p>
          <div className="mt-8 h-1 w-56 mx-auto bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 animate-loadbar" />
          </div>
        </div>
      </main>
    );
  }

  // ============ LANDING ============
  if (screen === "landing") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <header className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-bold">
                AV
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400">
                  Gamers Week · Pollar Hackathon
                </p>
                <p className="text-lg font-bold leading-tight">ArenaVault</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Stellar Testnet · Pollar
            </span>
          </header>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-4">
                On-chain esports prize pools
              </p>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                Trust the pool.
                <br />
                <span className="text-emerald-400">Earn while you play.</span>
              </h1>
              <p className="text-neutral-400 mt-6 max-w-md text-lg">
                ArenaVault holds tournament entry fees in on-chain escrow,
                routes the pool into a yield vault while the match runs, and
                settles to the winner in a single Stellar transaction.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                {!isAuthenticated ? (
                  <button
                    onClick={handleLogin}
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 text-base transition shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                  >
                    Continue with Google
                  </button>
                ) : (
                  <button
                    onClick={() => setScreen("app")}
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 text-base transition shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                  >
                    Enter Dashboard →
                  </button>
                )}
                <span className="text-sm text-neutral-500">
                  {isAuthenticated && wallet?.address
                    ? "Signed in as " + short(wallet.address)
                    : "One click · No seed phrase · Google or email"}
                </span>
              </div>

              {error && (
                <div className="mt-6 rounded-xl border border-red-800 bg-red-950/40 p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
                <div>
                  <p className="text-2xl font-bold text-emerald-400">10</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    USDC entry fee
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">2%</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Settlement fee
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">&lt;5s</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Settlement time
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-fade-in-up relative">
              <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs uppercase tracking-widest text-emerald-400">
                    Live Match
                  </span>
                  <span className="text-xs text-neutral-500">
                    Stellar Testnet
                  </span>
                </div>
                <p className="font-bold text-xl">
                  Call of Duty: Mobile — 1v1
                </p>
                <p className="text-xs text-neutral-500 mb-5">
                  Entry fee 10.00 USDC per player
                </p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <p className="text-sm font-semibold">Player A</p>
                    <p className="text-xs text-neutral-500">Not staked</p>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <p className="text-sm font-semibold">Player B</p>
                    <p className="text-xs text-neutral-500">Not staked</p>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-5 py-4">
                  <p className="text-xs uppercase tracking-widest text-emerald-500">
                    Total Prize Pool
                  </p>
                  <p className="text-4xl font-bold text-emerald-400 mt-1">
                    20.00 <span className="text-lg">USDC</span>
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs text-neutral-400 shadow-xl">
                🔒 Secured on Stellar
              </div>
            </div>
          </div>

          <footer className="mt-20 text-center text-xs text-neutral-600">
            ArenaVault · Built on Pollar · Stellar Testnet · Gamers Week 2026
          </footer>
        </div>
      </main>
    );
  }

  // ============ APP ============
  return (
    <main className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500 flex items-center justify-center text-black font-bold">
              AV
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-400">
                Gamers Week · Pollar Hackathon
              </p>
              <h1 className="text-lg font-bold leading-tight">ArenaVault</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Stellar Testnet · Pollar
            </span>
            {isAuthenticated && (
              <button
                onClick={() => setAdminView((v) => !v)}
                className={
                  "text-xs rounded-md px-3 py-1.5 border " +
                  (adminView
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200")
                }
              >
                {adminView ? "Admin view: ON" : "Admin view"}
              </button>
            )}
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {!isAuthenticated && (
          <section className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-10 md:p-16 animate-fade-in-up">
            <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/25 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />

            <div className="relative max-w-2xl mx-auto text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-black font-bold text-2xl mx-auto mb-6 animate-glow">
                AV
              </div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-3">
                Sign in to enter the arena
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                One click.
                <br />
                <span className="text-emerald-400">No seed phrase.</span>
              </h2>
              <p className="text-neutral-400 mt-6 max-w-lg mx-auto">
                Pollar creates an embedded Stellar wallet for you the moment
                you sign in. Google or email — no wallet installs, no browser
                extensions, no private keys to lose.
              </p>

              <button
                onClick={handleLogin}
                className="mt-10 inline-flex items-center gap-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-4 text-base transition shadow-[0_0_60px_rgba(16,185,129,0.4)]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Embedded Stellar wallet
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Testnet · Free to try
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Powered by Pollar
                </span>
              </div>

              {error && (
                <div className="mt-8 rounded-xl border border-red-800 bg-red-950/40 p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>
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
                  onClick={openReceiveModal}
                  className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
                >
                  Receive
                </button>
                <button
                  onClick={handleLogout}
                  className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
                >
                  Log out
                </button>
                <button
                  onClick={handleLogoutEverywhere}
                  className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
                >
                  Log out everywhere
                </button>
              </div>
            </section>

            {adminView && (
              <section className="rounded-2xl border border-indigo-900/60 bg-indigo-950/20 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-indigo-400">
                    Organizer panel
                  </p>
                  <span className="text-xs text-neutral-500 capitalize">
                    Phase: {phase}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Escrow address
                    </p>
                    <a
                      href={explorerAccount(ESCROW)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-indigo-300 break-all underline"
                    >
                      {ESCROW}
                    </a>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Winner address
                    </p>
                    <a
                      href={explorerAccount(WINNER)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-indigo-300 break-all underline"
                    >
                      {WINNER}
                    </a>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={resolveWinner}
                    disabled={busy || winnerPaid}
                    className="text-xs rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold px-3 py-1.5"
                  >
                    Force resolve winner
                  </button>
                  <button
                    onClick={resetDemo}
                    className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
                  >
                    Reset demo
                  </button>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest text-emerald-400">
                  Live Match
                </span>
                <span className="text-xs text-neutral-500">
                  Call of Duty: Mobile · Stellar Testnet
                </span>
              </div>
              <h2 className="text-2xl font-bold">1v1 — Entry 10 USDC</h2>
              <p className="text-neutral-500 text-sm mt-1">
                Winner takes the pool + accrued yield
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <PlayerCard
                  name="Player A"
                  staked={playerAStaked}
                  disabled={busy || playerAStaked}
                  busy={busy && !playerAStaked}
                  state={stakeStateA}
                  onStake={() => stake("A")}
                />
                <PlayerCard
                  name="Player B"
                  staked={playerBStaked}
                  disabled={busy || playerBStaked}
                  busy={busy && !playerBStaked}
                  state={stakeStateB}
                  onStake={() => stake("B")}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-900/60 bg-gradient-to-br from-emerald-950/40 to-neutral-950 p-6">
              <div className="flex items-end justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                    <StatusDot state={earnState} />
                    Total Prize Pool
                  </p>
                  <p className="text-6xl font-bold mt-2 text-emerald-400 tabular-nums">
                    {pool.toFixed(2)}{" "}
                    <span className="text-2xl text-emerald-600/80">USDC</span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-2">
                    Held in escrow: {ESCROW.slice(0, 6)}…
                    {ESCROW.slice(-6)}
                  </p>
                </div>
                <button
                  onClick={routeToEarn}
                  disabled={pool === 0 || earnPreviewed || busy}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black font-semibold px-4 py-2"
                >
                  {earnPreviewed ? "Earn preview (testnet)" : "Route to Earn"}
                </button>
              </div>
              {earnPreviewed && (
                <p className="text-xs text-emerald-400 mt-3">
                  Testnet Earn vault not provisioned. SDK path shown for
                  mainnet.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                    <StatusDot state={settleState} />
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
                    <p className="text-xs text-neutral-500 mb-1">
                      Stake settlement
                    </p>
                    <a
                      className="text-emerald-300 font-mono text-xs break-all underline"
                      href={explorerTx(stakeTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {stakeTxHash}
                    </a>
                  </div>
                )}
                {payoutTxHash && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">
                      Winner payout
                    </p>
                    <a
                      className="text-emerald-300 font-mono text-xs break-all underline"
                      href={explorerTx(payoutTxHash)}
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
                onClick={openWalletBalanceModal}
                className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
              >
                Wallet balances
              </button>
              {!adminView && (
                <button
                  onClick={resetDemo}
                  className="text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5"
                >
                  Reset demo
                </button>
              )}
            </section>

            {error && (
              <section className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300 text-sm whitespace-pre-wrap">
                {error}
              </section>
            )}
          </div>
        )}

        <footer className="mt-16 text-center text-xs text-neutral-600">
          ArenaVault · Built on Pollar · Stellar Testnet · Gamers Week 2026
        </footer>
      </div>
    </main>
  );
}

function PlayerCard({
  name,
  staked,
  disabled,
  busy,
  state,
  onStake,
}: {
  name: string;
  staked: boolean;
  disabled: boolean;
  busy: boolean;
  state: "idle" | "pending" | "done";
  onStake: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold">{name}</p>
        <StatusDot state={state} />
      </div>
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
