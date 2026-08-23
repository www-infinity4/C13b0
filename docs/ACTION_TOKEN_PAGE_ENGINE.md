# C13b0 Action Token Page Engine

Every useful interaction enters one append-only event stream. Chat input, searches, research,
imports, decisions, routes, builds, and publication are separate actions. Each action receives a
token and may become an input to the next action.

The system stores concise summaries, cited sources, outputs, status changes, and build receipts.
It does **not** publish private reasoning, credentials, raw prompts containing private data, or
secret binding values.

## Color routing

| Color | Action |
|---|---|
| Blue | User input and imports |
| Pink | Investigation and search |
| Yellow | Research and extracted data |
| Orange | Decisions |
| Red | Routes and connections |
| Green | Engineering and page builds |
| Purple | Assimilation into the connected system |

## Automatic production loop

1. Capture the interaction as an input token.
2. Classify intent and select the owning repository-machine.
3. Search existing local knowledge and machine manifests before public research.
4. Produce research, decision, route, and build tokens as required.
5. Compile a page intent. If the repository and route already exist, update that machine.
6. Build in an isolated preview and run policy, security, link, accessibility, and regression checks.
7. Write a receipt connecting source tokens, generated files, tests, commit, deployment, and wallet event.
8. Publish only within the owner's configured approval policy.
9. Add the finished page to Crown Index and the end-of-day visual timeline.

This keeps `cart = repository = token = website`: a conversation does not end as disposable text.
It advances an existing machine or creates a reviewable new one.

## Cloudflare production shape

- A stateful agent owns each user/project event stream.
- Durable storage holds tokens, manifests, and receipts.
- A queue or workflow performs research and builds away from the chat request path.
- Service bindings connect internal workers without exposing them as unrelated public endpoints.
- The public app subscribes to status and displays pages as they become preview-ready and live.
- A nightly index job renders the day's connected pages, tokens, repairs, and unresolved blockers.

## Required safety boundary

Automatic reading, classification, research, drafting, previewing, testing, and repair may continue
without interruption. Publication, spending, account changes, destructive replacement, and changes
outside the configured repository allowlist require the applicable owner policy or approval receipt.

