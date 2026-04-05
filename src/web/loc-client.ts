/**
 * Cartoon Prompt Engine — Library of Congress JSON API Client
 *
 * Typed client for the Library of Congress loc.gov public API.
 * No API key required — all endpoints are publicly accessible.
 *
 * Reference: https://www.loc.gov/apis/json-and-yaml/
 *
 * What this provides for the C13b0 engine:
 *   1. Reference imagery from the Prints and Photographs Online Catalog (PPOC):
 *      Engineering drawings, architectural blueprints, and historical
 *      photographs that can inform aerospace schematics and UAP reference art.
 *
 *   2. Structured historical data to "ground" AI prompts with authentic
 *      period-accurate details (costume, architecture, typography).
 *
 *   3. A typed fetch wrapper compatible with both Node.js (via `node-fetch`
 *      or the built-in `fetch` in Node 18+) and browser environments.
 *
 * Usage:
 *   import { LocClient } from './loc-client';
 *
 *   const client  = new LocClient();
 *   const results = await client.search('parking lot 1950s photograph', { fa: 'online-format:image' });
 *   const prompts = results.results.map(r => client.toPromptFragment(r));
 *   // → ["1950s black-and-white photograph, asphalt parking lot, period correct ..."]
 */

// ---------------------------------------------------------------------------
// Types — API response shapes
// ---------------------------------------------------------------------------

/** A single search result item from the LOC API. */
export interface LocResultItem {
  id:             string;
  title:          string;
  url:            string;
  date?:          string;
  description?:   string[];
  subject?:       string[];
  location?:      string[];
  format?:        string[];
  /** Thumbnail or medium-resolution image URLs. */
  image_url?:     string[];
  /** Rights and access statement. */
  rights?:        string;
  /** Contributing institution. */
  contributor?:   string[];
  /** LOC collection/partOf string. */
  partof?:        string[];
}

/** Pagination metadata from the LOC API. */
export interface LocPagination {
  total:    number;
  from:     number;
  to:       number;
  perpage:  number;
  pages:    number;
  current:  number;
  next?:    string;
  previous?: string;
}

/** Top-level search response from loc.gov/search/?fo=json. */
export interface LocSearchResponse {
  results:    LocResultItem[];
  pagination: LocPagination;
  /** Facets returned by the API for further filtering. */
  facets?:    Record<string, Array<{ term: string; count: number }>>;
}

/** Options for LocClient.search(). */
export interface LocSearchOptions {
  /**
   * Facet filters in key:value format.
   * Common facets:
   *   online-format:image       — items with online images
   *   subject:engineering       — engineering-related items
   *   partof:prints-photographs — PPOC (Prints & Photographs catalog)
   */
  fa?: string;
  /** Number of results per page (default 25, max 100). */
  c?: number;
  /** Page number (1-indexed, default 1). */
  sp?: number;
  /** Sort order. Options: 'date', 'title', 'date_desc', 'title_desc'. */
  sort?: 'date' | 'title' | 'date_desc' | 'title_desc';
}

/** Options for LocClient.collection(). */
export interface LocCollectionOptions {
  c?:   number;
  sp?:  number;
  fa?:  string;
}

// ---------------------------------------------------------------------------
// LocClient
// ---------------------------------------------------------------------------

/**
 * LocClient
 *
 * Typed wrapper for the Library of Congress loc.gov JSON API.
 * Uses the global `fetch` API (available in Node 18+ and all modern browsers).
 *
 * For Node < 18, install `node-fetch` and pass it as the `fetchFn` option.
 */
export class LocClient {
  private readonly baseUrl:  string;
  private readonly fetchFn:  typeof fetch;
  private readonly userAgent: string;

  constructor(options: {
    baseUrl?:   string;
    fetchFn?:   typeof fetch;
    userAgent?: string;
  } = {}) {
    this.baseUrl   = options.baseUrl   ?? 'https://www.loc.gov';
    this.fetchFn   = options.fetchFn   ?? globalThis.fetch.bind(globalThis);
    this.userAgent = options.userAgent ?? 'C13b0-CartoonEngine/1.0 (github.com/www-infinity4/C13b0)';
  }

  // ── Core request helper ──────────────────────────────────────────────────

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set('fo', 'json');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const response = await this.fetchFn(url.toString(), {
      headers: {
        'Accept':     'application/json',
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`LOC API error: HTTP ${response.status} — ${url.toString()}`);
    }

    return response.json() as Promise<T>;
  }

  // ── Public search API ────────────────────────────────────────────────────

  /**
   * Full-text search across all LOC digital collections.
   *
   * @param query    Free-text search query.
   * @param options  Pagination and facet filters.
   *
   * @example
   *   // Find engineering drawings in the PPOC
   *   const r = await client.search('engineering drawing', {
   *     fa: 'partof:prints-photographs,online-format:image'
   *   });
   */
  async search(query: string, options: LocSearchOptions = {}): Promise<LocSearchResponse> {
    return this.get<LocSearchResponse>('/search/', {
      q:    query,
      ...(options.fa   && { fa:   options.fa   }),
      ...(options.c    && { c:    options.c    }),
      ...(options.sp   && { sp:   options.sp   }),
      ...(options.sort && { sort: options.sort }),
    });
  }

  /**
   * Browse a specific LOC collection by its slug.
   *
   * Common collection slugs:
   *   'collections/historic-american-buildings-survey'
   *   'collections/detroit-publishing-company'
   *   'collections/aerial-photographs'
   *
   * @example
   *   const r = await client.collection('collections/aerial-photographs');
   */
  async collection(slug: string, options: LocCollectionOptions = {}): Promise<LocSearchResponse> {
    return this.get<LocSearchResponse>(`/${slug}/`, {
      ...(options.c    && { c:   options.c    }),
      ...(options.sp   && { sp:  options.sp   }),
      ...(options.fa   && { fa:  options.fa   }),
    });
  }

  /**
   * Retrieve details for a single item by its LOC item ID or full URL.
   *
   * @param itemId  LOC item ID (e.g. 'loc.gov/pictures/item/00649729/').
   */
  async item(itemId: string): Promise<{ item: LocResultItem }> {
    const cleanId = itemId.replace(/^https?:\/\/www\.loc\.gov\//, '').replace(/\/?$/, '/');
    return this.get<{ item: LocResultItem }>(`/${cleanId}`);
  }

  // ── Prompt integration ───────────────────────────────────────────────────

  /**
   * Converts a LOC search result into a prompt fragment for AI generators.
   *
   * Extracts the year, format, subjects, and location from the result
   * metadata to produce an accurate, grounded reference descriptor.
   *
   * @example
   *   // result.title = "Parking lot, Los Angeles, ca. 1955"
   *   // → "1955 black-and-white photograph, parking lot, Los Angeles,
   *   //    period accurate, archival reference, Library of Congress"
   */
  toPromptFragment(result: LocResultItem): string {
    const parts: string[] = [];

    // Year
    if (result.date) {
      const yearMatch = result.date.match(/\d{4}/);
      if (yearMatch) parts.push(`${yearMatch[0]} period`);
    }

    // Format / medium
    if (result.format?.length) {
      parts.push(result.format[0]);
    }

    // Title keywords (strip trailing dates)
    const cleanTitle = result.title.replace(/,?\s*(ca\.?\s*)?\d{4}s?\s*$/, '').trim();
    if (cleanTitle) parts.push(cleanTitle);

    // Location
    if (result.location?.length) {
      parts.push(result.location.slice(0, 2).join(', '));
    }

    // Subjects
    if (result.subject?.length) {
      parts.push(...result.subject.slice(0, 3));
    }

    parts.push('archival reference', 'Library of Congress', 'historically accurate');

    return parts.join(', ');
  }

  /**
   * Batch-converts an array of results to prompt fragments.
   * Useful for seeding a prompt diversity pool.
   */
  toPromptFragments(results: LocResultItem[]): string[] {
    return results.map(r => this.toPromptFragment(r));
  }
}

// ---------------------------------------------------------------------------
// Pre-built reference search queries for C13b0 scenes
// ---------------------------------------------------------------------------

/**
 * LOC_REFERENCE_QUERIES
 *
 * Curated search queries for the C13b0 engine's canonical scenes.
 * Use these with `LocClient.search()` to pull historically accurate
 * reference material for grounding AI-generated backgrounds.
 */
export const LOC_REFERENCE_QUERIES: Record<string, { query: string; fa: string; description: string }> = {
  parking_lot_1950s: {
    query:       'parking lot automobile 1950s',
    fa:          'online-format:image,partof:prints-photographs',
    description: 'Period-accurate 1950s parking lot reference for Investor Gadget scenes',
  },
  engineering_drawings: {
    query:       'engineering mechanical drawing blueprint',
    fa:          'online-format:image,partof:prints-photographs',
    description: 'Engineering drawings for UAP / aerospace schematic reference',
  },
  kitchen_domestic_1960s: {
    query:       'kitchen interior domestic 1960s',
    fa:          'online-format:image',
    description: 'Period-accurate kitchen reference for the mouse/cheese discovery scene',
  },
  street_lamp_urban: {
    query:       'street lamp urban night photograph',
    fa:          'online-format:image,partof:prints-photographs',
    description: 'Reference for the parking lot sodium streetlamp lighting setup',
  },
  cartoon_cel_animation: {
    query:       'cel animation cartoon drawing original art',
    fa:          'online-format:image',
    description: 'Reference for traditional cel animation character style grounding',
  },
};
