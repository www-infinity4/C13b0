"use client";
import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
} from "lucide-react";

type Source = { title: string; url: string; excerpt: string; kind: string };
type Paper = {
  title: string;
  dek: string;
  overview: string;
  keyTakeaways: string[];
  engineering: string[];
  context: string[];
  findings: string[];
  opportunities: string[];
  cautions: string[];
  next: string[];
  sources: Source[];
  generatedAt: string;
};

const ARTICLE = "c13b0_infinity_spark_article_v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function getSnapshot() {
  try {
    return localStorage.getItem(ARTICLE);
  } catch {
    return null;
  }
}
function getServerSnapshot() {
  return null;
}

export default function SparkArticle() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const paper = useMemo<Paper | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as Paper) : null;
    } catch {
      return null;
    }
  }, [raw]);

  if (raw === null) {
    return (
      <main className="min-h-screen bg-[#06172a] px-4 py-24 text-center text-white">
        <FileText className="mx-auto mb-4 text-[#5f8bb3]" size={40} />
        <h1 className="text-2xl font-bold">No article is available yet</h1>
        <p className="mt-3 text-[#9ac7e9]">
          Run a search on Infinity Spark first — the full article opens here
          as soon as an overview has been built.
        </p>
        <a
          href="../"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#123f66] px-5 py-3 font-bold text-white"
        >
          <ArrowLeft size={18} />
          Back to Spark
        </a>
      </main>
    );
  }

  if (!paper) {
    return (
      <main className="min-h-screen bg-[#06172a] px-4 py-24 text-center text-[#9ac7e9]">
        Loading full article…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#174c78_0%,#0b2e50_42%,#061d35_100%)] px-4 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <a
          href="../"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#9ac7e9] hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Spark
        </a>

        <article className="mt-6 rounded-[2rem] border border-white/15 bg-white px-6 py-10 text-[#172331] shadow-[0_30px_100px_rgba(0,0,0,.28)] sm:px-12 sm:py-14">
          <p className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-[#9a6317]">
            <span className="inline-flex items-center gap-1">
              <BookOpen size={14} />
              Full research article
            </span>
            <span className="inline-flex items-center gap-1 text-[#718295]">
              <Calendar size={14} />
              {new Date(paper.generatedAt).toLocaleString()}
            </span>
            <span className="text-[#718295]">
              {paper.sources.filter(source=>source.excerpt.trim().length>80).length.toLocaleString()} evidence sources cited
            </span>
          </p>

          <h1 className="mt-4 font-serif text-3xl font-black leading-tight sm:text-4xl">
            {paper.title}
          </h1>
          {paper.dek && (
            <p className="mt-3 text-xl text-[#4d6b86]">{paper.dek}</p>
          )}

          <Section title="Key takeaways">
            <ul className="space-y-3">
              {paper.keyTakeaways.map((point, i) => (
                <li key={i} className="grid grid-cols-[18px_1fr] gap-3">
                  <span className="mt-2 size-1.5 rounded-full bg-[#215f99]" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Overview">
            <div className="space-y-5">
              {paper.overview.split("\n\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Section>

          {paper.engineering.length > 0 && (
            <Section title="Engineering lens">
              <Bullets items={paper.engineering} />
            </Section>
          )}

          <Section title="What the evidence establishes">
            <Numbered items={paper.findings} />
          </Section>

          <Section title="Context and nuance">
            <Bullets items={paper.context} />
          </Section>

          <Section title="Useful directions">
            <Bullets items={paper.opportunities} />
          </Section>

          <Section title="Limits and cautions">
            <Bullets items={paper.cautions} />
          </Section>

          <Section title="Questions worth answering next">
            <Bullets items={paper.next} />
          </Section>

          <Section title="Sources">
            <ol className="space-y-2">
              {paper.sources.map((s, i) => (
                <li
                  key={s.url + i}
                  className="grid grid-cols-[28px_1fr] gap-3 rounded-xl border px-4 py-3"
                >
                  <b className="font-mono text-[#9a6317]">
                    [{i + 1}]
                  </b>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-4 hover:text-[#215f99]"
                  >
                    <span>
                      <small className="block font-bold uppercase text-[#9a6317]">
                        {s.kind}
                      </small>
                      {s.title}
                    </span>
                    <ExternalLink size={16} className="shrink-0" />
                  </a>
                </li>
              ))}
            </ol>
          </Section>
        </article>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t pt-8">
      <h2 className="font-serif text-2xl font-black">{title}</h2>
      <div className="mt-4 text-[1.05rem] leading-8 text-[#33495d]">
        {children}
      </div>
    </section>
  );
}
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((x, i) => (
        <li key={i} className="grid grid-cols-[18px_1fr] gap-3">
          <span className="mt-3 size-1.5 rounded-full bg-[#d29a2e]" />
          {x}
        </li>
      ))}
    </ul>
  );
}
function Numbered({ items }: { items: string[] }) {
  return (
    <ol className="space-y-4">
      {items.map((x, i) => (
        <li key={i} className="grid grid-cols-[34px_1fr] gap-3">
          <b className="font-mono text-[#9a6317]">
            {String(i + 1).padStart(2, "0")}
          </b>
          <span>{x}</span>
        </li>
      ))}
    </ol>
  );
}
