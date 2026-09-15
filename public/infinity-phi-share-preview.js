(() => {
  "use strict";

  // Keep the public URL on the live Infinity Phi page. The old helper replaced
  // the real card URL with a workers.dev preview URL, which made X/Twitter show
  // the Cloudflare address instead of Infinity Phi.
  const PUBLIC_PHI_URL = "https://www-infinity4.github.io/C13b0/phi";

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

  function buildPreviewUrl(raw) {
    const cardUrl = parsePhiCardUrl(raw);
    if (!cardUrl) return String(raw || "");

    const publicUrl = new URL(PUBLIC_PHI_URL);
    publicUrl.search = cardUrl.search;
    publicUrl.hash = cardUrl.hash;
    return publicUrl.toString();
  }

  function shareText(data, cardUrl) {
    const supplied = clean(data?.text, 420);
    if (supplied) return supplied;
    return clean(cardUrl?.searchParams.get("cardBody"), 420);
  }

  if (typeof navigator.share === "function") {
    const nativeShare = navigator.share.bind(navigator);
    const patchedShare = async (data) => {
      const cardUrl = data?.url ? parsePhiCardUrl(data.url) : null;
      if (!cardUrl) return nativeShare(data);

      const url = buildPreviewUrl(cardUrl.toString());
      const title = clean(data?.title || cardUrl.searchParams.get("cardTitle"), 220) || "Infinity Phi";
      const text = shareText(data, cardUrl);
      return nativeShare({ ...data, title, text, url });
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
