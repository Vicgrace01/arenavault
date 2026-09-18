"use client";

import { useEffect, useMemo, useState } from "react";
import { usePollar, WalletButton } from "@pollar/react";
import { TournamentTerms } from "@/components/TournamentTerms";
import { x402Fetch, type X402PaymentRequest } from "x402-stellar-sdk/client";
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";

const MIN_STAKE = 0.1;
const MAX_STAKE = 100;
const DEFAULT_STAKE = 1;

const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS!;
const FALLBACK_WINNER = process.env.NEXT_PUBLIC_WINNER_ADDRESS!;
const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER!;
const HORIZON_URL = "https://horizon-testnet.stellar.org";

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

function short(addr: string | undefined, n = 4) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-n);
}

function initialsFrom(addr: string | undefined) {
  if (!addr) return "??";
  return addr.slice(0, 2).toUpperCase();
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

async function payWithDemoWallet(req: X402PaymentRequest) {
  // Generate or load a demo keypair in localStorage
  let secret = localStorage.getItem("av_x402_secret");
  if (!secret) {
    const kp = Keypair.random();
    secret = kp.secret();
    localStorage.setItem("av_x402_secret", secret);
    localStorage.setItem("av_x402_public", kp.publicKey());
    console.log("[x402] Generated demo wallet:", kp.publicKey());
    console.log(
      "[x402] Fund this address at https://faucet.circle.com (Stellar Testnet)"
    );
    console.log("[x402] Fund XLM via friendbot: https://friendbot.stellar.org?addr=" + kp.publicKey());
    throw new Error(
      "New x402 wallet created. Fund it, then click again. Address: " +
        kp.publicKey()
    );
  }

  const kp = Keypair.fromSecret(secret);
  const server = new Horizon.Server(HORIZON_URL);
  const source = await server.loadAccount(kp.publicKey());

  const asset = req.issuer
    ? new Asset(req.assetCode, req.issuer)
    : Asset.native();

  const builder = new TransactionBuilder(source, {
    fee: "1000",
    networkPassphrase: Networks.TESTNET,
  }).addOperation(
    Operation.payment({
      destination: req.destination,
      asset,
      amount: req.amount,
    })
  );

  if (req.memo) {
    builder.addMemo({ type: "text", value: req.memo } as any);
  }

  const tx = builder.setTimeout(60).build();
  tx.sign(kp);
  const result = await server.submitTransaction(tx);

  return { transactionHash: result.hash };
}

function PlayerCard({
  name,
  address,
  staked,
  disabled,
  busy,
  state,
  amount,
  onStake,
}: {
  name: string;
  address: string | null;
  staked: boolean;
  disabled: boolean;
  busy: boolean;
  state: "idle" | "pending" | "done";
  amount: number;
  onStake: () => void;
}) {
  const initials = staked
    ? initialsFrom(address ?? undefined)
    : name.slice(0, 2).toUpperCase();
  const displayAddress = staked && address ? short(address, 4) : "Open seat";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={
            "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors " +
            (staked
              ? "bg-emerald-500 text-black"
              : "bg-neutral-800 text-neutral-400")
          }
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold truncate">{name}</p>
            <StatusDot state={state} />
          </div>
          <p className="text-xs text-neutral-500 font-mono truncate">
            {displayAddress}
          </p>
        </div>
      </div>
      <button
        onClick={onStake}
        disabled={disabled}
        className="w-full rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 py-2 text-sm"
      >
        {staked
          ? "Confirmed ✓"
          : busy
          ? "Signing…"
          : "Stake " + amount.toFixed(2) + " USDC"}
      </button>
    </div>
  );
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
  } = pollar;

  const [screen, setScreen] = useState<Screen>("splash");
  const [adminView, setAdminView] = useState(false);
  const [playerAStaked, setPlayerAStaked] = useState(false);
  const [playerBStaked, setPlayerBStaked] = useState(false);
  const [earnPreviewed, setEarnPreviewed] = useState(false);
  const [winnerPaid, setWinnerPaid] = useState(false);
  const [stakeTxHash, setStakeTxHash] = useState<string | null>(null);
  const [stakeTimestamp, setStakeTimestamp] = useState<string | null>(null);
  const [payoutDestination, setPayoutDestination] = useState<string | null>(null);
  const [payoutTxHash, setPayoutTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletUsdc, setWalletUsdc] = useState<string | null>(null);
  const [walletXlm, setWalletXlm] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState<string>(DEFAULT_STAKE.toFixed(2));
  const [scoutReport, setScoutReport] = useState<any>(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [x402Public, setX402Public] = useState<string | null>(null);

  const stakeAmount = useMemo(() => {
    const n = parseFloat(stakeInput);
    if (!isFinite(n)) return 0;
    return n;
  }, [stakeInput]);

  const stakeAmountValid =
    stakeAmount >= MIN_STAKE && stakeAmount <= MAX_STAKE;

  const USDC = useMemo(
    () => ({
      type: "credit_alphanum4" as const,
      code: "USDC",
      issuer: USDC_ISSUER,
    }),
    []
  );

  const pool =
    (playerAStaked ? stakeAmount : 0) + (playerBStaked ? stakeAmount : 0);
  const unlocked = playerAStaked && playerBStaked;

  const usdcNum = walletUsdc === null ? null : parseFloat(walletUsdc);
  const hasEnoughUsdcForStake =
    usdcNum === null ? true : usdcNum >= stakeAmount;

  useEffect(() => {
    const t = setTimeout(() => setScreen("landing"), 2400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !wallet?.address) {
      setWalletUsdc(null);
      setWalletXlm(null);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${HORIZON_URL}/accounts/${wallet.address}`);
        if (!res.ok) {
          if (!cancelled) {
            setWalletUsdc("0");
            setWalletXlm("0");
          }
          return;
        }
        const data = await res.json();
        const xlm =
          (data.balances ?? []).find((b: any) => b.asset_type === "native")
            ?.balance ?? "0";
        const usdc =
          (data.balances ?? []).find(
            (b: any) =>
              b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
          )?.balance ?? "0";
        if (!cancelled) {
          setWalletUsdc(usdc);
          setWalletXlm(xlm);
        }
      } catch {
        // ignore
      }
    };

    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated, wallet?.address]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setX402Public(localStorage.getItem("av_x402_public"));
    }
  }, [scoutReport]);

  async function stake(player: "A" | "B") {
    if (!isAuthenticated || !wallet?.address) return;
    if (!stakeAmountValid) {
      setError(
        `Stake must be between ${MIN_STAKE.toFixed(
          2
        )} and ${MAX_STAKE.toFixed(2)} USDC.`
      );
      return;
    }
    if (!hasEnoughUsdcForStake) {
      setError(
        `Wallet has ${usdcNum?.toFixed(2) ?? "0"} USDC. Need at least ${stakeAmount.toFixed(2)}.`
      );
      return;
    }
    if ((player === "A" && playerAStaked) || (player === "B" && playerBStaked))
      return;

    setBusy(true);
    setError(null);
    try {
      const res: any = await runTx("payment", {
        destination: ESCROW,
        amount: stakeAmount.toFixed(2),
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
      if (!stakeTimestamp) setStakeTimestamp(new Date().toISOString());
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

  async function resolveWinner(destination: string | null) {
    if (!destination) {
      setError("Pick a winner before resolving.");
      return;
    }
    if (!unlocked) {
      setError("Both players must stake before settlement.");
      return;
    }
    const payoutAmount = stakeAmount * 2;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, amount: payoutAmount }),
      });
      const data = await res.json();
      console.log("[payout] response:", data);
      if (!res.ok || !data?.hash) {
        throw new Error(
          "Payout failed. " + JSON.stringify(data?.detail ?? data)
        );
      }
      setPayoutTxHash(data.hash);
      setPayoutDestination(destination);
      setWinnerPaid(true);
    } catch (e: any) {
      console.error("[payout] error:", e);
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadScoutReport() {
    setScoutLoading(true);
    setError(null);
    try {
      const response = await x402Fetch("/api/scout", undefined, {
        payWithStellar: payWithDemoWallet,
      });
      if (!response.ok) {
        throw new Error("Scout fetch failed: " + response.status);
      }
      const data = await response.json();
      setScoutReport(data);
    } catch (e: any) {
      console.error("[x402] scout error:", e);
      setError(e?.message ?? String(e));
    } finally {
      setScoutLoading(false);
    }
  }

  function resetDemo() {
    setPlayerAStaked(false);
    setPlayerBStaked(false);
    setEarnPreviewed(false);
    setWinnerPaid(false);
    setStakeTxHash(null);
    setStakeTimestamp(null);
    setPayoutDestination(null);
    setPayoutTxHash(null);
    setScoutReport(null);
    setError(null);
  }

  async function handleLoginGoogle() {
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
            <span className="hidden sm:inline-flex items-center gap-2 text-xs rounded-full border border-neutral-700 bg-neutral-900 pl-2 pr-3 py-1.5 text-neutral-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 6.5v11L12 22l8-4.5v-11L12 2zm0 2.3l5.5 3.1v.4L12 11 6.5 7.8v-.4L12 4.3zm-6 4.3v8.6l5.5 3.1v-8.6L6 8.6zm12 0l-5.5 3.1v8.6l5.5-3.1V8.6z" />
              </svg>
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

              <div className="mt-10 flex flex-col gap-3 max-w-sm">
                {!isAuthenticated ? (
                  <button
                    onClick={handleLoginGoogle}
                    className="inline-flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-3 text-base transition"
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
                    : "One click · No seed phrase · Google login"}
                </span>
              </div>

              {error && (
                <div className="mt-6 rounded-xl border border-red-800 bg-red-950/40 p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
                <div>
                  <p className="text-2xl font-bold text-emerald-400">
                    {DEFAULT_STAKE.toFixed(2)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Default entry fee
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">
                    {MIN_STAKE.toFixed(2)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Minimum stake
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
                  Entry fee {DEFAULT_STAKE.toFixed(2)} USDC per player
                </p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <p className="text-sm font-semibold">Player A</p>
                    <p className="text-xs text-neutral-500">Open seat</p>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <p className="text-sm font-semibold">Player B</p>
                    <p className="text-xs text-neutral-500">Open seat</p>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-5 py-4">
                  <p className="text-xs uppercase tracking-widest text-emerald-500">
                    Total Prize Pool
                  </p>
                  <p className="text-4xl font-bold text-emerald-400 mt-1">
                    {(DEFAULT_STAKE * 2).toFixed(2)}{" "}
                    <span className="text-lg">USDC</span>
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
            <span className="hidden sm:inline-flex items-center gap-2 text-xs rounded-full border border-neutral-700 bg-neutral-900 pl-2 pr-2.5 py-1 text-neutral-400">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L4 6.5v11L12 22l8-4.5v-11L12 2zm0 2.3l5.5 3.1v.4L12 11 6.5 7.8v-.4L12 4.3zm-6 4.3v8.6l5.5 3.1v-8.6L6 8.6zm12 0l-5.5 3.1v8.6l5.5-3.1V8.6z" />
              </svg>
              Stellar · Pollar
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
                {adminView ? "Admin: ON" : "Admin"}
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
                you sign in with Google — no wallet installs, no browser
                extensions, no private keys to lose.
              </p>

              <div className="mt-10 flex justify-center">
                <button
                  onClick={handleLoginGoogle}
                  className="inline-flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold px-8 py-4 text-base transition"
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
              </div>

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
            {/* Wallet info */}
            <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-indigo-500 flex items-center justify-center text-black font-bold text-sm shrink-0">
                    {initialsFrom(wallet?.address)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                      Connected Wallet
                    </p>
                    <p className="font-mono text-neutral-200 text-sm break-all">
                      {wallet?.address ?? "—"}
                    </p>
                  </div>
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
                    className="text-xs rounded-md bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 px-3 py-1.5"
                  >
                    Log out
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500">
                    USDC Balance
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">
                    {walletUsdc === null
                      ? "…"
                      : parseFloat(walletUsdc).toFixed(2)}
                    <span className="text-sm text-emerald-600/80 ml-1">
                      USDC
                    </span>
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Need {stakeAmount.toFixed(2)} USDC per stake
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    XLM Balance
                  </p>
                  <p className="text-2xl font-bold text-neutral-200 tabular-nums mt-1">
                    {walletXlm === null
                      ? "…"
                      : parseFloat(walletXlm).toFixed(2)}
                    <span className="text-sm text-neutral-500 ml-1">XLM</span>
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Need 2.00+ XLM for network fees
                  </p>
                </div>
              </div>

              {usdcNum !== null && usdcNum < stakeAmount && (
                <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                  ⚠ Not enough USDC. Fund this wallet via{" "}
                  <a
                    href="https://faucet.circle.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    faucet.circle.com
                  </a>{" "}
                  → Stellar Testnet → paste the address above.
                </div>
              )}
              {walletXlm !== null && parseFloat(walletXlm) < 2 && (
                <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                  ⚠ Low XLM. Run the friendbot fund script before staking.
                </div>
              )}
            </section>

            {/* Stake amount */}
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-xs uppercase tracking-widest text-emerald-400 mb-2">
                    Entry Fee
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={MIN_STAKE}
                      max={MAX_STAKE}
                      step="0.1"
                      value={stakeInput}
                      onChange={(e) => setStakeInput(e.target.value)}
                      disabled={playerAStaked || playerBStaked}
                      className="w-32 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-lg font-mono text-neutral-100 disabled:opacity-50"
                    />
                    <span className="text-neutral-400 text-sm">USDC</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">
                    Min {MIN_STAKE.toFixed(2)} · Max {MAX_STAKE.toFixed(2)} ·
                    Stakes lock when both players pay
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">
                    Pool if both stake
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                    {(stakeAmount * 2).toFixed(2)} USDC
                  </p>
                </div>
              </div>
              {!stakeAmountValid && (
                <p className="mt-3 text-xs text-red-300">
                  Stake must be between {MIN_STAKE.toFixed(2)} and{" "}
                  {MAX_STAKE.toFixed(2)} USDC.
                </p>
              )}
            </section>

            {/* Admin */}
            {adminView && (
              <section className="rounded-2xl border border-indigo-900/60 bg-indigo-950/20 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-indigo-400">
                    Organizer panel
                  </p>
                  <span className="text-xs text-neutral-500">
                    {unlocked ? "Ready to settle" : "Waiting for stakes"}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Escrow wallet
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
                      Winner selector
                    </p>
                    <select
                      className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs font-mono"
                      value={payoutDestination ?? ""}
                      onChange={(e) =>
                        setPayoutDestination(e.target.value || null)
                      }
                    >
                      <option value="">— pick winner —</option>
                      {wallet?.address && (
                        <option value={wallet.address}>
                          Current wallet · {short(wallet.address)}
                        </option>
                      )}
                      <option value={FALLBACK_WINNER}>
                        Fallback · {short(FALLBACK_WINNER)}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => resolveWinner(payoutDestination)}
                    disabled={
                      busy || winnerPaid || !payoutDestination || !unlocked
                    }
                    className="text-xs rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold px-3 py-1.5"
                  >
                    Resolve payout ({(stakeAmount * 2).toFixed(2)} USDC)
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

            {/* Match */}
            <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest text-emerald-400">
                  Live Match
                </span>
                <span className="text-xs text-neutral-500">
                  Call of Duty: Mobile · Stellar Testnet
                </span>
              </div>
              <h2 className="text-2xl font-bold">
                1v1 — Entry {stakeAmount.toFixed(2)} USDC
              </h2>
              <p className="text-neutral-500 text-sm mt-1">
                Winner takes the pool + accrued yield
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <PlayerCard
                  name="Player A"
                  address={playerAStaked ? wallet?.address ?? null : null}
                  staked={playerAStaked}
                  disabled={busy || playerAStaked || !stakeAmountValid}
                  busy={busy && !playerAStaked}
                  state={playerAStaked ? "done" : busy ? "pending" : "idle"}
                  amount={stakeAmount}
                  onStake={() => stake("A")}
                />
                <PlayerCard
                  name="Player B"
                  address={playerBStaked ? wallet?.address ?? null : null}
                  staked={playerBStaked}
                  disabled={busy || playerBStaked || !stakeAmountValid}
                  busy={busy && !playerBStaked}
                  state={playerBStaked ? "done" : busy ? "pending" : "idle"}
                  amount={stakeAmount}
                  onStake={() => stake("B")}
                />
              </div>
            </section>

            <TournamentTerms
              unlocked={unlocked}
              winnerAddress={
                payoutDestination || wallet?.address || FALLBACK_WINNER
              }
              escrowAddress={ESCROW}
              stakeTimestamp={stakeTimestamp}
              stakeTxHash={stakeTxHash}
              payoutTxHash={payoutTxHash}
              stakeAmount={stakeAmount}
            />

            {/* x402 Scout Report */}
            <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-400">
                    Opponent Scouting Report
                  </p>
                  <p className="text-neutral-500 text-xs mt-1">
                    x402 micropayment · $0.001 USDC per request
                  </p>
                </div>
                {!scoutReport && (
                  <button
                    onClick={loadScoutReport}
                    disabled={scoutLoading}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black font-semibold px-4 py-2 text-sm"
                  >
                    {scoutLoading ? "Paying $0.001…" : "Unlock scout report"}
                  </button>
                )}
              </div>

              {x402Public && !scoutReport && (
                <p className="text-[10px] text-neutral-500 mb-3 font-mono break-all">
                  x402 payer wallet: {x402Public}
                  <br />
                  Fund USDC at faucet.circle.com · Fund XLM at
                  friendbot.stellar.org?addr={x402Public}
                </p>
              )}

              {scoutReport ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Opponent</span>
                    <span className="text-neutral-200">
                      {scoutReport.opponent}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Avg K/D</span>
                    <span className="text-neutral-200">
                      {scoutReport.avgKd}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Playstyle</span>
                    <span className="text-neutral-200 text-right max-w-[60%]">
                      {scoutReport.playstyle}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Weak rounds</span>
                    <span className="text-neutral-200 text-right max-w-[60%]">
                      {scoutReport.weakRounds.join(" · ")}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400 pt-2 border-t border-neutral-800">
                    {scoutReport.recommendation}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-2">
                    Paid via x402 · HTTP 402 → payment → retry → 200 OK
                  </p>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">
                  Unlock to see opponent weak rounds, playstyle, and a
                  recommended strategy. Paid per request — no subscription.
                </p>
              )}
            </section>

            {/* Pool */}
            <section className="rounded-2xl border border-emerald-900/60 bg-gradient-to-br from-emerald-950/40 to-neutral-950 p-6">
              <div className="flex items-end justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                    <StatusDot state={earnPreviewed ? "done" : "idle"} />
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

            {/* Settlement */}
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                    <StatusDot state={winnerPaid ? "done" : "idle"} />
                    Settlement
                  </p>
                  <p className="text-neutral-300 text-sm mt-1">
                    {winnerPaid && payoutDestination
                      ? "Paid " +
                        (stakeAmount * 2).toFixed(2) +
                        " USDC to " +
                        short(payoutDestination, 4)
                      : unlocked
                      ? "Ready — pick winner in Admin panel"
                      : "Waiting for both stakes"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAdminView(true);
                    setError("Pick a winner from the Organizer panel above.");
                  }}
                  disabled={!unlocked || winnerPaid || busy}
                  className="rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold px-4 py-2"
                >
                  {winnerPaid ? "Paid ✓" : "Resolve Winner"}
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
