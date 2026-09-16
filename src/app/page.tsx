// Infinity Phi has one canonical runtime shell. The repository root and /phi
// both render the same search/results component so there is no competing
// secondary index, redirect handoff, or frozen front-page state.
export { default } from "@/components/PhiSearchRouteGuard";
