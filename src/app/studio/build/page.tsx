import type { Metadata } from "next";
import PuckBuilder from "./PuckBuilder";

export const metadata: Metadata = {
  title: "Infinity Studio — Page Builder",
  description: "Drag-and-drop page builder for turning a researched query into a fully custom, published-ready page.",
};

export default function PuckBuilderPage() {
  return <PuckBuilder />;
}
