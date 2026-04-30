import type { Metadata } from "next";
import "./globals.css";
import ClientOnly from "@/components/ClientOnly";

export const metadata: Metadata = {
  title: "Index Options Desk — Nifty / Bank Nifty / Sensex",
  description:
    "Paper or live options workflow with risk controls. Not financial advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ClientOnly>{children}</ClientOnly>
      </body>
    </html>
  );
}
