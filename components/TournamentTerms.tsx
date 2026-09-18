"use client";

import { useState } from "react";

function explorerAccount(addr: string) {
  return "https://stellar.expert/explorer/testnet/account/" + addr;
}

function explorerTx(hash: string) {
  return "https://stellar.expert/explorer/testnet/tx/" + hash;
}

function horizonTx(hash: string) {
  return "https://horizon-testnet.stellar.org/transactions/" + hash;
}

function truncate(s: string) {
  if (s.length < 20) return s;
  return s.slice(0, 10) + "…" + s.slice(-6);
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").replace(".000Z", " UTC");
  } catch {
    return iso;
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 mb-3">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  link,
  mono,
}: {
  label: string;
  value: string;
  link?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm border-b border-neutral-900 pb-2 last:border-0 last:pb-0">
      <span className="text-neutral-500 shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={
            "text-emerald-300 underline break-all text-right " +
            (mono ? "font-mono text-xs" : "")
          }
        >
          {value}
        </a>
      ) : (
        <span
          className={
            "text-neutral-200 text-right break-all " +
            (mono ? "font-mono text-xs" : "")
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}

export function TournamentTerms({
  unlocked,
  winnerAddress,
  escrowAddress,
  stakeTimestamp,
  stakeTxHash,
  payoutTxHash,
}: {
  unlocked: boolean;
  winnerAddress: string;
  escrowAddress: string;
  stakeTimestamp: string | null;
  stakeTxHash: string | null;
  payoutTxHash: string | null;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            Tournament Terms
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            {unlocked
              ? "Unlocked — both players staked"
              : "Locked — stake to unlock the rules"}
          </p>
        </div>
        <span
          className={
            "text-xs rounded-full px-2.5 py-1 border " +
            (unlocked
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-400"
              : "border-neutral-700 bg-neutral-950 text-neutral-500")
          }
        >
          {unlocked ? "Unlocked" : "Locked"}
        </span>
      </div>

      <div className="relative">
        <div
          className={
            "grid gap-3 md:grid-cols-2 " +
            (unlocked && revealed ? "" : "blur-sm select-none pointer-events-none")
          }
        >
          <Section title="1 · Committed Winner">
            <Row
              label="Winner address"
              value={truncate(winnerAddress)}
              link={explorerAccount(winnerAddress)}
              mono
            />
            <Row label="Committed at" value={formatTime(stakeTimestamp)} />
            <Row label="Status" value="Locked, on-chain" />
          </Section>

          <Section title="2 · Settlement Rules">
            <Row label="Match format" value="Best of 3 rounds" />
            <Row
              label="Loadout"
              value="Default only · no perks · no scorestreaks"
            />
            <Row label="Disconnect rule" value="60s reconnect, then forfeit" />
            <Row label="Tie handling" value="Coin flip, memo'd on-chain" />
          </Section>

          <Section title="3 · Payout Calculation">
            <Row label="Entry fee" value="10.00 USDC per player" />
            <Row label="Total pool" value="20.00 USDC (2 × 10.00)" />
            <Row
              label="Platform fee"
              value="0% at hackathon · 2% mainnet roadmap"
            />
            <Row
              label="Yield accrual"
              value="Mainnet only · testnet preview"
            />
            <Row label="Winner receives" value="20.00 USDC + yield" />
          </Section>

          <Section title="4 · Settlement Timeline">
            <Row label="Match duration" value="48 hours maximum" />
            <Row
              label="Auto-settlement"
              value="Refund both stakes if unresolved at 48h"
            />
            <Row
              label="Dispute window"
              value="None — winner pre-committed"
            />
          </Section>

          <Section title="5 · Audit Trail">
            <Row
              label="Stake tx"
              value={stakeTxHash ? truncate(stakeTxHash) : "—"}
              link={stakeTxHash ? explorerTx(stakeTxHash) : undefined}
              mono
            />
            <Row
              label="Payout tx"
              value={payoutTxHash ? truncate(payoutTxHash) : "Pending"}
              link={payoutTxHash ? explorerTx(payoutTxHash) : undefined}
              mono
            />
            <Row
              label="Escrow wallet"
              value={truncate(escrowAddress)}
              link={explorerAccount(escrowAddress)}
              mono
            />
            {stakeTxHash && (
              <Row
                label="Horizon re-read"
                value="Independent verification"
                link={horizonTx(stakeTxHash)}
              />
            )}
          </Section>

          <Section title="6 · Immutability Guarantee">
            <p className="text-xs text-neutral-400 leading-relaxed">
              Once both stakes land, these values cannot be changed:
            </p>
            <ul className="text-xs text-neutral-300 space-y-1 mt-2">
              <li>· Winner address</li>
              <li>· Prize pool size</li>
              <li>· Settlement rules</li>
              <li>· Platform fee percentage</li>
            </ul>
            <p className="text-xs text-neutral-500 leading-relaxed mt-3 pt-3 border-t border-neutral-900">
              The organizer records the match outcome, but cannot redirect the
              funds. Settlement always routes to the pre-committed address.
            </p>
          </Section>
        </div>

        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-200">
                Rules are hidden
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Both players must stake before terms unlock
              </p>
            </div>
          </div>
        )}

        {unlocked && !revealed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setRevealed(true)}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-5 py-2.5"
            >
              Reveal tournament terms
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
