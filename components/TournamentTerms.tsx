"use client";

import { useState } from "react";

function explorerAccount(addr: string) {
  return "https://stellar.expert/explorer/testnet/account/" + addr;
}

export function TournamentTerms({
  unlocked,
  winnerAddress,
}: {
  unlocked: boolean;
  winnerAddress: string;
}) {
  const [revealed, setRevealed] = useState(false);

  const terms = [
    { label: "Winner address", value: winnerAddress, link: true },
    { label: "Match format", value: "Best of 3 rounds" },
    { label: "Loadout rules", value: "Default only · no perks · no scorestreaks" },
    { label: "Disconnect rule", value: "Forfeit after 60 seconds" },
    { label: "Prize pool", value: "20.00 USDC" },
    { label: "Settlement", value: "Escrow releases to pre-committed winner" },
    { label: "Dispute window", value: "None — winner address locked at stake time" },
  ];

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
            "space-y-3 " +
            (unlocked && revealed
              ? "blur-0"
              : "blur-sm select-none pointer-events-none")
          }
        >
          {terms.map((t) => (
            <div
              key={t.label}
              className="flex items-center justify-between text-sm border-b border-neutral-800 pb-2"
            >
              <span className="text-neutral-500">{t.label}</span>
              {t.link ? (
                <a
                  href={explorerAccount(t.value)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-emerald-300 underline break-all max-w-[60%] text-right"
                >
                  {t.value.slice(0, 8)}…{t.value.slice(-6)}
                </a>
              ) : (
                <span className="text-neutral-200 text-right max-w-[60%]">
                  {t.value}
                </span>
              )}
            </div>
          ))}
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
