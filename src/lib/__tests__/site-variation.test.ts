import { BUILDER_PLUGIN_SLOTS, createVariationPlan, fingerprintSimilarity } from "../site-variation";

describe("site variation engine", () => {
  const base = { userId: "user-1", tokenId: "token-1", query: "hydrogen storage materials" };

  it("registers all fifteen builder plugin roles", () => {
    expect(BUILDER_PLUGIN_SLOTS).toHaveLength(15);
    expect(new Set(BUILDER_PLUGIN_SLOTS).size).toBe(15);
  });

  it("is reproducible when the same inputs and history are supplied", () => {
    expect(createVariationPlan(base)).toEqual(createVariationPlan(base));
  });

  it("changes a new site when a prior fingerprint would repeat the design", () => {
    const first = createVariationPlan(base);
    const second = createVariationPlan({ ...base, priorFingerprints: [first.fingerprint] });
    expect(second.fingerprint).not.toBe(first.fingerprint);
    expect(second.similarityToClosestPrior).toBeLessThanOrEqual(0.2);
  });

  it("uses history terms without replacing the current subject", () => {
    const plan = createVariationPlan({
      ...base,
      history: [
        { query: "Canadian nickel dates and metal composition" },
        { query: "Canadian nickel collector grading" },
      ],
    });
    expect(plan.historyTerms).toEqual(expect.arrayContaining(["canadian", "nickel"]));
    expect(plan.fingerprint).toBeTruthy();
  });

  it("attaches business and storefront plugins only as requested upgrades", () => {
    const ordinary = createVariationPlan(base);
    const store = createVariationPlan({ ...base, upgrades: ["business", "storefront"] });
    expect(ordinary.plugins).not.toContain("storefront-catalog");
    expect(store.plugins).toEqual(expect.arrayContaining(["business-personalizer", "storefront-catalog"]));
  });

  it("calculates overlap from complete fingerprint axes", () => {
    expect(fingerprintSimilarity("a|b|c", "a|b|d")).toBe(0.5);
    expect(fingerprintSimilarity("a|b", "c|d")).toBe(0);
  });
});
