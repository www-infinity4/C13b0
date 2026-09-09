import { PLUGIN_INDEX, PLUGIN_ROLES, routesForRoles, selectPluginRoutes } from "../plugin-index";

describe("fork capability index", () => {
  it("indexes all fifteen verified forks exactly once", () => {
    expect(PLUGIN_INDEX).toHaveLength(15);
    expect(new Set(PLUGIN_INDEX.map((item) => item.role))).toEqual(new Set(PLUGIN_ROLES));
    expect(PLUGIN_INDEX.every((item) => item.fork.startsWith("www-infinity4/"))).toBe(true);
  });

  it("calls up the thirteen core website capabilities", () => {
    const routes = selectPluginRoutes({ query: "hydrogen science" });
    expect(routes).toHaveLength(13);
    expect(routes.map((item) => item.role)).not.toContain("storefront-catalog");
    expect(routes.map((item) => item.role)).not.toContain("business-personalizer");
  });

  it("calls up business and storefront forks from upgrade intent", () => {
    const routes = selectPluginRoutes({ query: "hydrogen", upgrades: ["business", "storefront"] });
    expect(routes).toHaveLength(15);
    expect(routes.map((item) => item.role)).toEqual(expect.arrayContaining(["business-personalizer", "storefront-catalog"]));
  });

  it("calls up optional forks from indexed search terms", () => {
    const routes = selectPluginRoutes({ query: "turn coin research into an eBay shop" });
    expect(routes.map((item) => item.role)).toEqual(expect.arrayContaining(["business-personalizer", "storefront-catalog"]));
  });

  it("resolves stored plan roles back to complete capability contracts", () => {
    const routes = routesForRoles(["source-scout", "color-director", "not-a-role"]);
    expect(routes.map((item) => item.role)).toEqual(["source-scout", "color-director"]);
    expect(routes.every((item) => item.accepts.length > 0 && item.produces.length > 0)).toBe(true);
  });
});
