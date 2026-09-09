# Infinity Phi: fifteen focused forks

Each fork has one bounded role. Infinity Phi remains the orchestrator; these projects supply proven parts rather than forcing the whole site into one framework.

| # | Infinity Phi role | Verified fork | Upstream | What the fork contributes |
|---:|---|---|---|---|
| 1 | source-scout | [www-infinity4/searxng](https://github.com/www-infinity4/searxng) | searxng/searxng | Multi-source search aggregation and source routing |
| 2 | claim-verifier | [www-infinity4/deepeval](https://github.com/www-infinity4/deepeval) | confident-ai/deepeval | Tests for factuality, relevance and generated-answer quality |
| 3 | history-context | [www-infinity4/mem0](https://github.com/www-infinity4/mem0) | mem0ai/mem0 | Persistent user and agent memory patterns |
| 4 | script-architect | [www-infinity4/langgraph](https://github.com/www-infinity4/langgraph) | langchain-ai/langgraph | Durable, branching agent workflows for structured scripts |
| 5 | illustration-planner | [www-infinity4/ComfyUI](https://github.com/www-infinity4/ComfyUI) | Comfy-Org/ComfyUI | Node-based image-generation and rerender pipelines |
| 6 | layout-composer | [www-infinity4/puck](https://github.com/www-infinity4/puck) | puckeditor/puck | Visual React page composition and section editing |
| 7 | typography-director | [www-infinity4/fonttools](https://github.com/www-infinity4/fonttools) | fonttools/fonttools | Font inspection, subsetting and transformation |
| 8 | color-director | [www-infinity4/color.js](https://github.com/www-infinity4/color.js) | color-js/color.js | Standards-based color conversion, contrast and palette logic |
| 9 | interaction-designer | [www-infinity4/xyflow](https://github.com/www-infinity4/xyflow) | xyflow/xyflow | Node maps for Wave-like cards, routes and connected ideas |
| 10 | accessibility-auditor | [www-infinity4/axe-core](https://github.com/www-infinity4/axe-core) | dequelabs/axe-core | Automated accessibility checking |
| 11 | business-personalizer | [www-infinity4/twenty](https://github.com/www-infinity4/twenty) | twentyhq/twenty | CRM concepts for people, organizations and personalized business pages |
| 12 | storefront-catalog | [www-infinity4/medusa](https://github.com/www-infinity4/medusa) | medusajs/medusa | Product, catalog, cart and commerce building blocks |
| 13 | token-provenance | [www-infinity4/c2pa-js](https://github.com/www-infinity4/c2pa-js) | contentauth/c2pa-js | C2PA content credentials and media provenance in JavaScript |
| 14 | duplicate-detector | [www-infinity4/datasketch](https://github.com/www-infinity4/datasketch) | ekzhu/datasketch | MinHash and similarity detection to prevent repeated sites |
| 15 | deployment-review | [www-infinity4/lighthouse-ci](https://github.com/www-infinity4/lighthouse-ci) | GoogleChrome/lighthouse-ci | Automated performance and quality regression checks |

## Fork rule

All fifteen fork relationships were verified on GitHub on 2026-09-09. Keep each fork narrow and record its upstream commit. Do not merge all fifteen codebases into the browser bundle. Wrap only the required capability behind the matching plugin endpoint, return a structured receipt, and let the Infinity Phi orchestrator decide when that role runs.

The live index is `src/lib/plugin-index.ts`. It records each role's phase, trigger terms, accepted inputs and expected outputs. A normal website calls up thirteen core roles; business and storefront roles join when an upgrade or indexed search term requests them. The Cloudflare worker never equates a GitHub fork with a running service.

For AGPL/GPL projects, review the network-use and redistribution obligations before deploying modified versions. For repositories whose GitHub API does not declare a standard SPDX license, inspect their current license and commercial terms before using the fork in a public product.
