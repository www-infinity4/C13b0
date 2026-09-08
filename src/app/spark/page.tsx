import type { Metadata } from "next";
import ContextualSpark from "./ContextualSpark";

export const metadata: Metadata = {
  title: "Infinity Spark",
  description: "Begin with one question, preserve the research, and turn it into a useful Infinity website asset.",
};

export default function SparkPage() { return <ContextualSpark />; }
