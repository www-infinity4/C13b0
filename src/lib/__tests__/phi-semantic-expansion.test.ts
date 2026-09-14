import {
  buildSemanticExpansionCards,
  isValidSemanticQuestion,
  semanticSubjectIsPlural,
} from "../phi-semantic-expansion";

describe("Infinity Phi semantic question agreement", () => {
  test.each([
    ["acorns", true],
    ["properties of acorns", true],
    ["hydrogen gas", false],
    ["physics", false],
    ["rhenium", false],
  ])("recognizes the grammatical number of %s", (subject, expected) => {
    expect(semanticSubjectIsPlural(subject)).toBe(expected);
  });

  test("rejects malformed singular/plural agreement", () => {
    expect(isValidSemanticQuestion("Where is acorns found?")).toBe(false);
    expect(isValidSemanticQuestion("Where are acorns found?")).toBe(true);
    expect(isValidSemanticQuestion("What are hydrogen gas?")).toBe(false);
    expect(isValidSemanticQuestion("What is hydrogen gas?")).toBe(true);
    expect(isValidSemanticQuestion("How does acorns behave chemically?")).toBe(false);
    expect(isValidSemanticQuestion("How do acorns behave chemically?")).toBe(true);
  });

  test("generates plural orange-card questions from plural subjects", () => {
    const cards = buildSemanticExpansionCards(
      "acorns",
      "Acorns are the nuts produced by oak trees.",
      [],
      ["Acorns were found beneath mature oak trees across temperate forests throughout the Northern Hemisphere."],
      "",
      [],
      1,
    );

    expect(cards[0]?.title).toBe("Where are acorns found?");
    expect(cards[0]?.title).not.toContain(" is acorns ");
  });
});
