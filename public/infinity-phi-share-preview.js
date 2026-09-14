(() => {
  "use strict";

  const PREVIEW_ENDPOINT = "https://infinity-rogers.marvaseater.workers.dev/share/phi";

  function clean(value, max = 1400) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function parsePhiCardUrl(raw) {
    try {
      const url = new URL(String(raw || ""), location.href);
      const path = url.pathname.replace(/\/+$/, "");
      const isPhi = path.endsWith("/C13b0/phi") || path.endsWith("/phi");
      return isPhi && url.searchParams.has("cardTitle") ? url : null;
    } catch {
      return null;
    }
  }

  function originalSearch(cardUrl) {
    try {
      const current = new URL(location.href);
      const currentQuery = clean(current.searchParams.get("q"), 1000);
      if (currentQuery) return currentQuery;
    } catch {}
    return clean(cardUrl.searchParams.get("q") || cardUrl.searchParams.get("cardTitle"), 1000);
  }

  function buildPreviewUrl(raw) {
    const cardUrl = parsePhiCardUrl(raw);
    if (!cardUrl) return String(raw || "");

    const params = new URLSearchParams({
      title: clean(cardUrl.searchParams.get("cardTitle"), 220) || "Infinity Phi orange card",
      body: clean(cardUrl.searchParams.get("cardBody"), 1400),
      source: clean(cardUrl.searchParams.get("source"), 1800),
      image: clean(cardUrl.searchParams.get("image"), 1800),
      q: originalSearch(cardUrl),
    });

    return `${PREVIEW_ENDPOINT}?${params.toString()}`;
  }

  if (typeof navigator.share === "function") {
    const nativeShare = navigator.share.bind(navigator);
    const patchedShare = async (data) => {
      if (!data || !parsePhiCardUrl(data.url)) return nativeShare(data);
      const url = buildPreviewUrl(data.url);
      return nativeShare({ ...data, url });
    };

    try {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        writable: true,
        value: patchedShare,
      });
    } catch {
      try { navigator.share = patchedShare; } catch {}
    }
  }

  window.InfinityPhiSharePreview = Object.freeze({ buildPreviewUrl });
})();
