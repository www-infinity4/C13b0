export type PhiRunStatus = 'complete' | 'active' | 'queued';

export type PhiRunStage = {
  id: string;
  label: string;
  status: PhiRunStatus;
  proof: string;
  next: string;
};

export const phiStructuredRun = {
  id: 'infinity-phi-site-run-2026-09-08',
  baseline: 'ad8df6e',
  title: 'Infinity Phi structured repair + build run',
  goal: 'Keep Search → Research → Build → Wallet/History → Share/Preview → Verify resumable across interrupted work sessions.',
  resumeRule: 'Start at the first active or queued stage. Preserve completed stages unless a regression is proven. Commit each stage independently so an interrupted session loses at most one stage.',
  invariants: [
    'Android taps must use ordinary navigable links for page-to-page handoff.',
    'Research must render a stable result before Build is enabled.',
    'Build-all means every available aim; no missing focus parameter may silently select Aim 1.',
    'Builder must paint immediately from session/local data or URL fallback before durable storage/network enrichment.',
    'Wallet and history writes must never block navigation or first paint.',
    'Every production change gets a cache-busted verification route before the run advances.',
  ],
  stages: [
    {
      id: 'entry',
      label: '1 · Phi entry and routing',
      status: 'complete',
      proof: 'Main Phi page resolves through src/app/phi/page.tsx to the active PhiPage component.',
      next: 'Do not reintroduce duplicate cached shells or competing entry pages.',
    },
    {
      id: 'research',
      label: '2 · Search and stable research package',
      status: 'complete',
      proof: 'Research paints a shell immediately, hard-times-out providers, then unlocks Build after the package stops changing.',
      next: 'Regression-test long queries and provider timeouts on Android.',
    },
    {
      id: 'handoff',
      label: '3 · Android-safe builder handoff',
      status: 'active',
      proof: 'The overview uses a plain same-window link and includes id, query, resolved query, phone=1, and a build version.',
      next: 'Verify the exported /phi/build/ route from a real phone and keep URL fallback independent of durable storage.',
    },
    {
      id: 'builder',
      label: '4 · Illustrated website builder',
      status: 'active',
      proof: 'Builder paints from local/session data or URL fallback, then enriches research after first paint.',
      next: 'Verify build-all versus focused-build selection, section research, visual sources, and save/share controls.',
    },
    {
      id: 'wallet-history',
      label: '5 · Unified wallet and history',
      status: 'active',
      proof: 'PR #25 synchronized the active Phi token workspace and removed the obsolete duplicate shell.',
      next: 'Exercise cross-page persistence and confirm one token/history record per completed research/build action.',
    },
    {
      id: 'share-preview',
      label: '6 · Share card and preview',
      status: 'queued',
      proof: 'Site metadata exists, but the final social-card image still requires production verification after the builder flow is stable.',
      next: 'Verify OG/X large-card metadata against the deployed asset and canonical Phi URL.',
    },
    {
      id: 'verification',
      label: '7 · Production verification',
      status: 'queued',
      proof: 'This stage only completes after the deployed GitHub Pages output is checked, not merely after source edits.',
      next: 'Run the phone test matrix: entry, long search, result settle, build-all, focused build, back navigation, wallet/history, share preview.',
    },
  ] satisfies PhiRunStage[],
} as const;
