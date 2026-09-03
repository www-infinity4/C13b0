import type { Metadata } from "next";
import BusinessStarter from "./BusinessStarter";

export const metadata: Metadata = {
  title: "Build an Infinity Business | C13b0",
  description: "Create a lawful Infinity-only product page, connect a unified Infinity wallet, and prepare a transparent review record.",
};

export default function BusinessPage() {
  return <BusinessStarter />;
}
