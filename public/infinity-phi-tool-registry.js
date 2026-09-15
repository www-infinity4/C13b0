(() => {
  'use strict';

  const TOOLS = [
    { repo: 'www-infinity4/meilisearch', role: 'fast lexical and hybrid retrieval', kind: 'retrieval' },
    { repo: 'www-infinity4/typesense', role: 'typo-tolerant instant search and field ranking', kind: 'retrieval' },
    { repo: 'www-infinity4/qdrant', role: 'vector memory and semantic retrieval', kind: 'retrieval' },
    { repo: 'www-infinity4/vespa', role: 'multi-stage retrieval and ranking', kind: 'retrieval' },
    { repo: 'www-infinity4/OpenSearch', role: 'BM25 and vector search', kind: 'retrieval' },
    { repo: 'www-infinity4/llama_index', role: 'document ingestion and retrieval orchestration', kind: 'retrieval' },
    { repo: 'www-infinity4/FlagEmbedding', role: 'embeddings and reranking', kind: 'retrieval' },
    { repo: 'www-infinity4/sentence-transformers', role: 'semantic embeddings and similarity', kind: 'retrieval' },
    { repo: 'www-infinity4/ColBERT', role: 'late-interaction passage retrieval', kind: 'retrieval' },
    { repo: 'www-infinity4/faiss', role: 'local vector nearest-neighbor index', kind: 'retrieval' },
    { repo: 'www-infinity4/unstructured', role: 'article and document extraction', kind: 'extract' },
    { repo: 'www-infinity4/crawl4ai', role: 'web crawling and article extraction', kind: 'extract' },
    { repo: 'www-infinity4/searxng', role: 'broad metasearch discovery', kind: 'retrieval' },
    { repo: 'www-infinity4/google-api-nodejs-client', role: 'official Google API access when configured', kind: 'connector' },
    { repo: 'www-infinity4/js-genai', role: 'structured synthesis when configured', kind: 'reasoning' },
    { repo: 'www-infinity4/compromise', role: 'phrase, noun, topic and entity extraction', kind: 'language' },
    { repo: 'www-infinity4/flexsearch', role: 'browser field-aware indexing and ranking', kind: 'retrieval' },
    { repo: 'www-infinity4/nspell', role: 'dictionary-backed spelling repair', kind: 'language' },
    { repo: 'www-infinity4/lexical', role: 'structured rich-text and document editing', kind: 'create' },
    { repo: 'www-infinity4/open_clip', role: 'image-text relevance and visual matching', kind: 'visual' },
    { repo: 'www-infinity4/og-image', role: 'Open Graph preview image generation', kind: 'visual' },
    { repo: 'www-infinity4/Image-video-scanner', role: 'image/video media validation gateway', kind: 'media' },
    { repo: 'www-infinity4/flux', role: 'visual generation capability source', kind: 'visual' },
    { repo: 'www-infinity4/TRELLIS.2', role: 'visual/3D generation capability source', kind: 'visual' },
    { repo: 'www-infinity4/gods-eye-view', role: 'indexed exploration and overview capability source', kind: 'research' },
    { repo: 'www-infinity4/artemis', role: 'indexed research capability source', kind: 'research' },
  ];

  const registry = Object.freeze({
    owner: 'www-infinity4',
    version: '2026-09-15.media1',
    tools: Object.freeze(TOOLS.map((tool) => Object.freeze({ ...tool }))),
    byKind(kind) { return TOOLS.filter((tool) => tool.kind === kind); },
  });

  window.InfinityPhiToolRegistry = registry;
  document.documentElement.dataset.infinityPhiIndexedTools = String(TOOLS.length);

  const previousFetch = window.fetch.bind(window);
  window.fetch = async function infinityPhiToolAwareFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (!rawUrl.includes('infinity-rogers.marvaseater.workers.dev/v1/chat') || !init?.body) {
      return previousFetch(input, init);
    }

    try {
      const payload = JSON.parse(String(init.body));
      const app = String(payload?.context?.application || '');
      if (!/^Infinity Phi/i.test(app)) return previousFetch(input, init);

      payload.context = payload.context || {};
      payload.context.indexed_tool_repositories = TOOLS.map(({ repo, role, kind }) => ({ repo, role, kind }));
      payload.context.indexed_tool_policy = [
        'These repositories are the user-owned indexed capability catalog for Infinity Phi.',
        'Use their roles to choose retrieval/media/relevance strategies when the corresponding runtime is configured.',
        'A fork being indexed does not by itself mean a server or library is currently executing.',
        'Prefer source-backed cards. Preserve publisher URLs and media type. Never invent a source, image, video URL, date, quote, or event.',
        'For visual results, avoid repeating the same asset across cards when another source-backed visual is available.',
      ].join(' ');

      return previousFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch {
      return previousFetch(input, init);
    }
  };
})();