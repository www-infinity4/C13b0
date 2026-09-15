(function () {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const clean = (value, max = 2600) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const hash = (value) => {
    let h = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return Math.abs(h || 1);
  };
  const timeout = async (promise, ms = 3200) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  const sourceDomain = (value) => {
    try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
  };

  function pseudoPage(source, index) {
    const title = clean(source.title, 220);
    const extract = clean(source.extract, 2800);
    const fullurl = clean(source.url, 1200);
    if (!title || !extract || !fullurl) return null;
    const image = clean(source.image, 1200);
    return {
      pageid: -(hash(`${source.provider}|${fullurl}|${index}`) + index),
      ns: 0,
      title,
      extract,
      fullurl,
      provider: source.provider || sourceDomain(fullurl) || 'Public web',
      thumbnail: image ? { source: image, width: 900, height: 600 } : undefined
    };
  }

  function openAlexAbstract(inverted) {
    if (!inverted || typeof inverted !== 'object') return '';
    const words = [];
    Object.entries(inverted).forEach(([word, positions]) => {
      (Array.isArray(positions) ? positions : []).forEach((position) => {
        if (Number.isFinite(position) && position < 420) words[position] = word;
      });
    });
    return clean(words.filter(Boolean).join(' '), 2500);
  }

  async function openAlex(query) {
    const url = new URL('https://api.openalex.org/works');
    url.search = new URLSearchParams({ search: query, 'per-page': '10' }).toString();
    const response = await timeout(nativeFetch(url, { cache: 'no-store' }), 2600);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).flatMap((work) => {
      const title = clean(work.display_name || work.title, 220);
      const abstract = openAlexAbstract(work.abstract_inverted_index);
      const host = clean(work.primary_location?.source?.display_name || work.best_oa_location?.source?.display_name || 'scholarly source', 180);
      const target = work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || work.doi || work.id || '';
      const extract = abstract || `${title}. Scholarly work indexed by OpenAlex${work.publication_year ? `, published ${work.publication_year}` : ''}${host ? ` through ${host}` : ''}.`;
      return title && target ? [{ title, url: target, extract, image: '', provider: 'OpenAlex' }] : [];
    });
  }

  async function nasa(query) {
    const url = new URL('https://images-api.nasa.gov/search');
    url.search = new URLSearchParams({ q: query, media_type: 'image', page_size: '12' }).toString();
    const response = await timeout(nativeFetch(url, { cache: 'no-store' }), 2600);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.collection?.items || []).flatMap((item) => {
      const meta = item.data?.[0] || {};
      const title = clean(meta.title, 220);
      const description = clean(meta.description || meta.description_508, 2600);
      const nasaId = clean(meta.nasa_id, 180);
      if (!title || !description || !nasaId) return [];
      const image = clean((item.links || []).find((link) => link.render === 'image')?.href || item.links?.[0]?.href, 1200);
      return [{
        title,
        url: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
        extract: `${description}${meta.date_created ? ` Date: ${String(meta.date_created).slice(0, 10)}.` : ''}`,
        image,
        provider: 'NASA'
      }];
    });
  }

  async function readArticle(target) {
    if (!/^https?:\/\//i.test(target)) return '';
    try {
      const response = await timeout(nativeFetch(`https://r.jina.ai/${target}`, { cache: 'no-store', headers: { Accept: 'text/plain' } }), 1400);
      if (!response.ok) return '';
      const text = await response.text();
      return clean(text
        .replace(/^Title:.*$/gmi, ' ')
        .replace(/^URL Source:.*$/gmi, ' ')
        .replace(/^Published Time:.*$/gmi, ' ')
        .replace(/^Markdown Content:.*$/gmi, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' '), 3200);
    } catch {
      return '';
    }
  }

  async function gdelt(query) {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.search = new URLSearchParams({ query, mode: 'artlist', maxrecords: '10', format: 'json', sort: 'HybridRel' }).toString();
    const response = await timeout(nativeFetch(url, { cache: 'no-store' }), 1800);
    if (!response.ok) return [];
    const data = await response.json();
    return (await Promise.all((data.articles || []).slice(0, 8).map(async (article, index) => {
      const target = clean(article.url, 1200);
      const title = clean(article.title, 220);
      if (!target || !title) return null;
      const articleText = index < 2 ? await readArticle(target) : '';
      return {
        title,
        url: target,
        extract: articleText || `${title}. Original news report indexed by GDELT from ${clean(article.domain, 180) || sourceDomain(target)}${article.seendate ? `, seen ${clean(article.seendate, 60)}` : ''}.`,
        image: clean(article.socialimage, 1200),
        provider: clean(article.domain, 180) || 'News / GDELT'
      };
    }))).filter(Boolean);
  }

  async function internetArchive(query) {
    const url = new URL('https://archive.org/advancedsearch.php');
    const params = new URLSearchParams();
    params.set('q', query);
    params.append('fl[]', 'identifier');
    params.append('fl[]', 'title');
    params.append('fl[]', 'description');
    params.append('fl[]', 'creator');
    params.append('fl[]', 'date');
    params.set('rows', '10');
    params.set('page', '1');
    params.set('output', 'json');
    url.search = params.toString();
    const response = await timeout(nativeFetch(url, { cache: 'no-store' }), 2600);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.response?.docs || []).flatMap((doc) => {
      const identifier = clean(doc.identifier, 260);
      const title = clean(Array.isArray(doc.title) ? doc.title[0] : doc.title, 220);
      if (!identifier || !title) return [];
      const description = clean(Array.isArray(doc.description) ? doc.description[0] : doc.description, 2400);
      const creator = clean(Array.isArray(doc.creator) ? doc.creator.join(', ') : doc.creator, 240);
      const date = clean(doc.date, 80);
      return [{
        title,
        url: `https://archive.org/details/${encodeURIComponent(identifier)}`,
        extract: description || `${title}.${creator ? ` Created by ${creator}.` : ''}${date ? ` Date: ${date}.` : ''} Archival record indexed by Internet Archive.`,
        image: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
        provider: 'Internet Archive'
      }];
    });
  }

  function pickDiverse(wikipediaPages, extras) {
    const out = [];
    const seenUrls = new Set();
    const domainCounts = new Map();
    const add = (page) => {
      if (!page) return;
      const target = clean(page.fullurl, 1200).toLowerCase();
      const domain = sourceDomain(page.fullurl) || clean(page.provider, 120).toLowerCase();
      if (!target || seenUrls.has(target)) return;
      const count = domainCounts.get(domain) || 0;
      if (count >= 2) return;
      seenUrls.add(target);
      domainCounts.set(domain, count + 1);
      out.push(page);
    };

    wikipediaPages.slice(0, 1).forEach(add);
    extras.forEach(add);
    wikipediaPages.slice(1, 2).forEach(add);
    return out.slice(0, 14);
  }

  async function augmentedWikipediaFetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, location.href); } catch { return nativeFetch(input, init); }
    const isSearch = parsed.hostname === 'en.wikipedia.org' && parsed.pathname.endsWith('/w/api.php') && parsed.searchParams.get('generator') === 'search';
    if (!isSearch) return nativeFetch(input, init);

    const query = parsed.searchParams.get('gsrsearch') || '';
    let wikiResponse;
    try {
      wikiResponse = await nativeFetch(input, init);
    } catch {
      return nativeFetch(input, init);
    }
    if (!wikiResponse.ok) return wikiResponse;

    let data;
    try { data = await wikiResponse.clone().json(); } catch { return wikiResponse; }
    let extraResults = [];
    try {
      extraResults = await timeout(Promise.allSettled([openAlex(query), nasa(query), gdelt(query), internetArchive(query)]), 3500);
    } catch {
      extraResults = [];
    }

    const wikipediaPages = Object.values(data?.query?.pages || {});
    const extras = [];
    extraResults.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      (result.value || []).forEach((source, index) => {
        const page = pseudoPage(source, extras.length + index);
        if (page) extras.push(page);
      });
    });
    const pages = pickDiverse(wikipediaPages, extras);
    if (!pages.length) return wikiResponse;
    data.query = data.query || {};
    data.query.pages = Object.fromEntries(pages.map((page, index) => [`multi_${index}`, page]));
    const headers = new Headers(wikiResponse.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status: wikiResponse.status, statusText: wikiResponse.statusText, headers });
  }

  window.fetch = augmentedWikipediaFetch;

  function labelForDomain(domain) {
    if (domain.endsWith('nasa.gov')) return 'NASA';
    if (domain === 'archive.org') return 'Internet Archive';
    if (domain.includes('openalex.org')) return 'OpenAlex';
    if (domain.includes('wikipedia.org')) return 'Wikipedia';
    return domain || 'Public web';
  }

  function relabelRenderedSources(root) {
    root.querySelectorAll?.('a.phi-green-card[href]').forEach((card) => {
      const href = card.getAttribute('href') || '';
      const domain = sourceDomain(href);
      const label = card.querySelector('small');
      if (label && domain && !domain.includes('wikipedia.org')) label.textContent = labelForDomain(domain);
    });
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === 1) relabelRenderedSources(node);
    }));
  });
  const startObserver = () => {
    relabelRenderedSources(document);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();

  window.InfinityPhiMultiSource = { openAlex, nasa, gdelt, internetArchive, readArticle };
})();
