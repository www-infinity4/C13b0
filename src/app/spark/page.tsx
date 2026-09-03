import type { Metadata } from "next";
import SparkSearch from "./SparkSearch";

export const metadata: Metadata = {
  title: "Infinity Spark",
  description: "Begin with one question, preserve the research, and turn it into a useful Infinity website asset.",
};

export default function SparkPage() { return <SparkSearch />; }
