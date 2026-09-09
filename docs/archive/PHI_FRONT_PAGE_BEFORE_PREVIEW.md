# Archived Phi front page

This file preserves the former front-page presentation without leaving a second runnable index in the application.

The previous opening used a standalone circular Phi mark above the heading and search form:

```tsx
<section className={paper ? "phi-search-section compact" : "phi-search-section"}>
  {!paper && <>
    <div className="phi-orb">φ</div>
    <h1>Infinity φ</h1>
    <p>Structured futures from endless results.</p>
  </>}
  <form className="phi-search-box">
    <input aria-label="Research topic" placeholder="Search" />
    <button aria-label="Search all sources"><span className="phi-omni">⊙</span></button>
  </form>
</section>
```

The complete recoverable source remains in Git commit `ad8df6e`, before the supplied Infinity Phi preview artwork became the functional opening page. The active front page intentionally uses `public/infinity-phi-share.png`; this archive cannot be routed or cached as a competing page.

