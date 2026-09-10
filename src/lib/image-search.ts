/** Intelligent, license-aware image search for Infinity Spark / Studio. */
export type LicenseGrade = "A" | "B" | "C" | "D" | "E";
export type SearchImage = {
  url: string;
  thumbUrl: string;
  alt: string;
  width?: number;
  height?: number;
  source: "wikimedia" | "openverse";
  sourceUrl: string;
  license: string;
  licenseUrl?: string;
  grade: LicenseGrade;
  creator?: string;
  relevance?: number;
};

const STOP = new Set(["the", "and", "for", "with", "from", "into", "about", "understanding", "research"]);
const SNAKE_SENSE = /\b(snake|serpent|cobra|viper|boa|reptile)\b/i;

function gradeLicense(license: string): { grade: LicenseGrade; clean: string } {
  const raw = license.toLowerCase().replace(/[\s\-]+/g, " ");
  if (/public domain|cc0|no known copyright|no restrictions/i.test(raw)) return { grade: "A", clean: "Public domain / CC0" };
  if (/cc by(?!-sa|-nc|-nd)/i.test(raw) || /attribution(?!.*share.alike)/i.test(raw)) return { grade: "B", clean: "CC BY — attribution required" };
  if (/cc by.sa|share.alike/i.test(raw)) return { grade: "C", clean: "CC BY-SA — share alike" };
  if (/cc by.nc|noncommercial|cc by.nd|no.deriv/i.test(raw)) return { grade: "D", clean: license };
  if (/cc/i.test(raw)) return { grade: "D", clean: license };
  return { grade: "E", clean: license || "Unknown license" };
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function terms(topic: string) {
  return [
    ...new Set(
      topic
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !STOP.has(word)),
    ),
  ];
}

export function visualCandidateAllowed(candidateText: string, topic: string) {
  if (SNAKE_SENSE.test(topic)) return true;
  return !SNAKE_SENSE.test(candidateText);
}

function relevance(alt: string, topic: string) {
  if (!visualCandidateAllowed(alt, topic)) return -10;

  const words = terms(topic);
  const text = stripHtml(alt).toLowerCase();
  const normalizedTopic = stripHtml(topic).toLowerCase();
  if (!words.length) return 0;

  const hit = words.filter((word) => new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(text)).length;
  const wholePhrase = normalizedTopic
    ? new RegExp(`(^|\\b)${escapeRegex(normalizedTopic)}(\\b|$)`, "i").test(text)
    : false;
  const exactTitle = text === normalizedTopic;
  const parentheticalTitle = normalizedTopic && text.startsWith(`${normalizedTopic} (`);

  return hit / words.length + (exactTitle ? 4 : parentheticalTitle ? 3.25 : wholePhrase ? 1.25 : 0);
}

async function searchWikimedia(topic: string): Promise<SearchImage[]> {
  try {
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: topic,
      gsrnamespace: "6",
      gsrlimit: "20",
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: "1400",
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

    return Object.values(json.query?.pages || {}).flatMap((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url) return [];
      const meta = info.extmetadata || {};
      const licenseName = stripHtml(meta.LicenseShortName?.value || meta.License?.value || "");
      const creator = stripHtml(meta.Artist?.value || meta.Credit?.value || "").slice(0, 100);
      const graded = gradeLicense(licenseName);
      const alt = stripHtml(meta.ObjectName?.value || page.title?.replace(/^File:/, "") || topic);
      const rel = relevance(alt, topic);
      if (graded.grade === "E" || rel <= 0) return [];

      return [
        {
          url: info.thumburl || info.url,
          thumbUrl: info.thumburl || info.url,
          alt,
          width: info.width,
          height: info.height,
          source: "wikimedia" as const,
          sourceUrl: info.descriptionurl || info.url,
          license: graded.clean,
          licenseUrl: meta.LicenseUrl?.value,
          grade: graded.grade,
          creator: creator || undefined,
          relevance: rel,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function searchOpenverse(topic: string): Promise<SearchImage[]> {
  try {
    const endpoint = new URL("https://api.openverse.org/v1/images/");
    endpoint.search = new URLSearchParams({ q: topic, page_size: "20", license: "pdm,by,by-sa,cc0" }).toString();
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

    return (json.results || []).flatMap((result) => {
      if (!result.url) return [];
      const graded = gradeLicense([result.license, result.license_version].filter(Boolean).join(" ").toUpperCase());
      const alt = result.title || topic;
      const rel = relevance(alt, topic);
      if (graded.grade === "E" || rel <= 0) return [];

      return [
        {
          url: result.thumbnail || result.url,
          thumbUrl: result.thumbnail || result.url,
          alt,
          width: result.width,
          height: result.height,
          source: "openverse" as const,
          sourceUrl: result.foreign_landing_url || result.url,
          license: graded.clean,
          licenseUrl: result.license_url,
          grade: graded.grade,
          creator: result.creator,
          relevance: rel,
        },
      ];
    });
  } catch {
    return [];
  }
}

function scoreImage(image: SearchImage) {
  const license = { A: 30, B: 22, C: 16, D: 6, E: 0 }[image.grade];
  const resolution = image.width && image.height ? Math.min((image.width * image.height) / 1_000_000, 12) : 0;
  const landscape = image.width && image.height && image.width >= image.height ? 5 : 0;
  return (image.relevance || 0) * 100 + license + resolution + landscape;
}

export async function searchImages(topic: string): Promise<SearchImage[]> {
  const [wikimedia, openverse] = await Promise.all([searchWikimedia(topic), searchOpenverse(topic)]);
  const seen = new Set<string>();
  return [...wikimedia, ...openverse]
    .filter((image) => {
      const key = image.sourceUrl || image.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return visualCandidateAllowed(image.alt, topic);
    })
    .sort((a, b) => scoreImage(b) - scoreImage(a))
    .slice(0, 12);
}

export function gradeLabel(grade: LicenseGrade) {
  return { A: "Public domain / CC0", B: "CC BY", C: "CC BY-SA", D: "Check terms", E: "Avoid reuse" }[grade];
}
