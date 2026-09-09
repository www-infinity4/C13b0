import { createSemanticIndex, normalizeSemanticTerm } from "../semantic-index";

describe("semantic color index", () => {
  const index = createSemanticIndex({
    query: "hydrogen",
    findings: [
      "Hydrogen gas storage needs tanks, materials and pressure systems.",
      "A catalyst can improve hydrogen conversion and storage.",
    ],
    sources: [
      { title: "Hydrogen storage", excerpt: "Hydrogen gas can use tanks, materials and pressure systems." },
      { title: "Helium", excerpt: "Helium data can help compare hydrogen gas behavior." },
      { title: "Catalyst", excerpt: "A catalyst supports conversion systems." },
      { title: "Tank repair", excerpt: "Tank inspection knowledge can improve a practical repair page." },
    ],
    history: [{ query: "helium properties", resolved: "helium element" }, { query: "nickel routing" }],
  });

  const color = (term: string) => index.find((item) => item.term === term)?.color;

  it("marks the searched subject and connected imported terms purple", () => {
    expect(color("hydrogen")).toBe("purple");
    expect(color("helium")).toBe("purple");
  });

  it("marks decision and engineering nouns with actionable colors", () => {
    expect(color("gas")).toBe("orange");
    expect(color("material")).toBe("green");
  });

  it("uses blue as an expert contribution point", () => {
    expect(index.find((item) => item.term === "tank")?.action).toBe("contribute");
  });

  it("normalizes plural nouns for consistent inline highlighting", () => {
    expect(normalizeSemanticTerm("materials")).toBe("material");
    expect(normalizeSemanticTerm("Batteries")).toBe("battery");
  });
});
