import type { Metadata } from "next";
import SparkArticle from "./SparkArticle";

export const metadata: Metadata = {
  title: "Infinity Spark — Full Research Article",
  description:
    "The complete, fully-cited research article generated from an Infinity Spark search, with every source listed.",
};

export default function SparkArticlePage() {
  return <SparkArticle />;
}
