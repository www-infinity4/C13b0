import type { Metadata } from "next";
import SparkSearch from "./spark/SparkSearch";

export const metadata: Metadata = {
  title: "Infinity",
  description: "Search, examine, and build from any question with Infinity.",
};

export default function HomePage() {
  return <SparkSearch />;
}
