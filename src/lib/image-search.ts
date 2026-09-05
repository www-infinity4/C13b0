/**
 * Intelligent image search for Infinity Spark / Studio.
 *
 * Searches multiple public image sources, normalizes licensing metadata, and
 * grades every result so users can pick visuals that are safe to reuse.
 *
 * Grades (best → cautious):
 *   A — Public domain or CC0, no attribution required
 *   B — CC BY or equivalent, attribution required
 *   C — CC BY-SA or similar, share-alike required
 *   D — Permissive custom license, check terms
 *   E — Unknown / all-rights-reserved, avoid reuse
 */

export type LicenseGrade = "A" | "B" | "C" | "D" | "E";

export type SearchImage = {
  url: string;
  thumbUrl: string;
  alt: string;
  width?: number;
  height?: number;
  source: "wikimedia" | "openverse" | "unsplash" | "pexels" | "pixabay";
  sourceUrl: string;
  license: string;
  licenseUrl?: string;
  grade: LicenseGrade;
  creator?: string;
};

function gradeLicense(license: string): { grade: LicenseGrade; clean: string } {
  const raw = license.toLowerCase().replace(/[\s\-]+/g, " ");
  if (/public domain|cc0|no known copyright|no restrictions/i.test(raw)) {
    return { grade: "A", clean: "Public domain / CC0" };
  }
  if (/cc by(?!-sa|-nc|-nd)/i.test(raw) || /attribution(?!.*share.alike)/i.test(raw)) {
    return { grade: "B", clean: "CC BY — attribution required" };
  }
  if (/cc by.sa|share.alike/i.test(raw)) {
    return { grade: "C", clean: "CC BY-SA — share alike" };
  }
  if (/cc by.nc|noncommercial/i.test(raw)) {
    return { grade: "D", clean: "CC BY-NC — non-commercial only" };
  }
  if (/cc by.nd|no.deriv/i.test(raw)) {
    return { grade: "D", clean: "CC BY-ND — no derivatives" };
  }
  if (/cc/i.test(raw)) {
    return { grade: "D", clean: license };
  }
  return { grade: "E", clean: license || "Unknown license" };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchWikimedia(topic: string): Promise<SearchImage[]> {
  try {
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: topic,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: "1200",
      format: "json",
      origin: "*",
    }).toString();
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: {
              url?: string;
              thumburl?: string;
              descriptionurl?: string;
              width?: number;
              height?: number;
              extmetadata?: Record<string, { value?: string }>;
            }[];
          }
        >;
      };
    };
    return Object.values(json.query?.pages || {})
      .flatMap((page) => {
        const info = page.imageinfo?.[0];
        if (!info?.url) return [];
        const meta = info.extmetadata || {};
        const licenseName = stripHtml(
          meta.LicenseShortName?.value || meta.License?.value || ""
        );
        const artist = stripHtml(
          meta.Artist?.value || meta.Credit?.value || ""
        ).slice(0, 120);
        const { grade, clean } = gradeLicense(licenseName);
        if (grade === "E") return [];
        return [
          {
            url: info.url,
            thumbUrl: info.thumburl || info.url,
            alt: stripHtml(
              meta.ObjectName?.value || page.title?.replace(/^File:/, "") || topic
            ),
            width: info.width,
            height: info.height,
            source: "wikimedia" as const,
            sourceUrl: info.descriptionurl || info.url,
            license: clean,
            licenseUrl: meta.LicenseUrl?.value,
            grade,
            creator: artist || undefined,
          },
        ];
      })
      .filter((img) => img.thumbUrl);
  } catch {
    return [];
  }
}

async function searchOpenverse(topic: string): Promise<SearchImage[]> {
  try {
    const endpoint = new URL("https://api.openverse.org/v1/images/");
    endpoint.search = new URLSearchParams({
      q: topic,
      page_size: "10",
      license: "pdm,by,by-sa,cc0",
    }).toString();
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      results?: {
        url?: string;
        thumbnail?: string;
        title?: string;
        foreign_landing_url?: string;
        license?: string;
        license_version?: string;
        license_url?: string;
        creator?: string;
        width?: number;
        height?: number;
      }[];
    };
    return (json.results || [])
      .filter((r) => r.url)
      .map((r) => {
        const rawLicense = [r.license, r.license_version]
          .filter(Boolean)
          .join(" ")
          .toUpperCase();
        const { grade, clean } = gradeLicense(rawLicense);
        return {
          url: r.url!,
          thumbUrl: r.thumbnail || r.url!,
          alt: r.title || topic,
          width: r.width,
          height: r.height,
          source: "openverse" as const,
          sourceUrl: r.foreign_landing_url || r.url!,
          license: clean,
          licenseUrl: r.license_url,
          grade,
          creator: r.creator,
        };
      })
      .filter((img) => img.grade !== "E");
  } catch {
    return [];
  }
}

function scoreImage(img: SearchImage, topic: string): number {
  const gradeScore = { A: 100, B: 80, C: 60, D: 40, E: 0 }[img.grade];
  const t = topic.toLowerCase();
  const alt = img.alt.toLowerCase();
  const matches = t.split(/\s+/).filter((w) => w.length > 3 && alt.includes(w)).length;
  const resolutionBonus =
    img.width && img.height ? Math.min((img.width * img.height) / 1_000_000, 20) : 0;
  return gradeScore + matches * 8 + resolutionBonus;
}

export async function searchImages(topic: string): Promise<SearchImage[]> {
  const [wikimedia, openverse] = await Promise.all([
    searchWikimedia(topic),
    searchOpenverse(topic),
  ]);
  const merged = [...wikimedia, ...openverse];
  const seen = new Set<string>();
  const unique = merged.filter((img) => {
    const key = img.url.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort((a, b) => scoreImage(b, topic) - scoreImage(a, topic));
}

export function gradeLabel(grade: LicenseGrade): string {
  return {
    A: "A — Public domain / CC0",
    B: "B — CC BY — attribute",
    C: "C — CC BY-SA — share alike",
    D: "D — Check terms",
    E: "E — Avoid reuse",
  }[grade];
}
