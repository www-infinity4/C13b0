import type { Metadata } from "next";
import TokenWallet from "@/components/TokenWallet";
import TokenWalletAI from "@/components/TokenWalletAI";

export const metadata: Metadata = {
  title: "Infinity Token Wallet",
  description: "Open, inspect, amend, extend, source, and build from every token in the active Infinity wallet.",
};

export default function WalletPage() {
  return (
    <>
      <TokenWalletAI />
      <TokenWallet />
    </>
  );
}
