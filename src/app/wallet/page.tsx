import type { Metadata } from "next";
import TokenWallet from "@/components/TokenWallet";

export const metadata: Metadata = {
  title: "Infinity Token Wallet",
  description: "Open, inspect, amend, and extend every token in the active Infinity wallet.",
};

export default function WalletPage() {
  return <TokenWallet />;
}
