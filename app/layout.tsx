import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PollarProvider } from "@pollar/react";
import "@pollar/react/styles.css";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ArenaVault · Stellar Testnet",
  description:
    "On-chain esports prize pool escrow with yield, powered by Pollar on Stellar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-100`}
      >
        <PollarProvider
          client={{
            apiKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY as string,
            stellarNetwork: "testnet",
            redirectUri: "http://localhost:3000",
          } as any}
          appConfig={{} as any}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
