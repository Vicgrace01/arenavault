"use client";

import { PollarProvider } from "@pollar/react";
import "@pollar/react/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const redirectUri = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000";

  return (
    <PollarProvider
      client={{
        apiKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY as string,
        stellarNetwork: "testnet",
        redirectUri,
      } as any}
      appConfig={{} as any}
    >
      {children}
    </PollarProvider>
  );
}
