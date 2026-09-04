import type { Config } from "@puckeditor/core";
import { ArrowUpRight, Pencil } from "lucide-react";

/**
 * Shared Puck visual-page-builder configuration for Infinity Studio.
 * Every block is styled to match the site's dark/glass aesthetic so pages
 * built by users stay visually consistent with the rest of Infinity OS.
 */
export type InfinityPuckProps = {
  Hero: { eyebrow: string; title: string; subtitle: string };
  Heading: { text: string; level: "h2" | "h3" };
  Text: { text: string };
  Image: { url: string; alt: string; caption: string };
  CardGrid: { cards: { title: string; body: string }[] };
  CTAButton: { label: string; href: string };
  Divider: Record<string, never>;
};

function EditMark({ label = "Edit" }: { label?: string }) {
  return <span className="edit-mark inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm" aria-label={label}><Pencil size={13} /></span>;
}

export const puckConfig: Config<InfinityPuckProps> = {
  categories: {
    layout: { title: "Layout", components: ["Hero", "Divider"] },
    content: { title: "Content", components: ["Heading", "Text", "Image", "CardGrid"] },
    action: { title: "Action", components: ["CTAButton"] },
  },
  components: {
    Hero: {
      label: "Hero banner",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Title" },
        subtitle: { type: "textarea", label: "Subtitle" },
      },
      defaultProps: {
        eyebrow: "Built with Infinity",
        title: "Your project title",
        subtitle: "A short, compelling description of what this page is about.",
      },
      render: ({ eyebrow, title, subtitle }) => (
        <section className="relative overflow-hidden rounded-[2rem] bg-[#071d35] px-6 py-16 text-white shadow-[0_30px_80px_rgba(15,23,42,.18)] sm:px-12 sm:py-24">
          <div className="absolute -right-24 -top-24 size-80 rounded-full border border-blue-300/20 bg-blue-500/10 blur-sm" />
          <div className="relative max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-[#8fd3ff]"><span>{eyebrow}</span><EditMark label="Edit introduction" /></p>
            <h1 className="mt-5 flex items-start gap-3 font-sans text-4xl font-semibold leading-[1.05] tracking-[-.04em] sm:text-6xl"><span>{title}</span><EditMark label="Edit title" /></h1>
            <p className="mt-6 flex max-w-2xl items-start gap-3 text-lg leading-8 text-slate-300 sm:text-xl"><span>{subtitle}</span><EditMark label="Edit summary" /></p>
          </div>
        </section>
      ),
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { type: "text", label: "Text" },
        level: {
          type: "select",
          label: "Size",
          options: [
            { label: "Large", value: "h2" },
            { label: "Medium", value: "h3" },
          ],
        },
      },
      defaultProps: { text: "Section heading", level: "h2" },
      render: ({ text, level }) => {
        const Tag = level;
        return (
          <Tag className={`${level === "h2" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} flex items-center gap-3 font-sans font-semibold tracking-[-.025em] text-slate-950`}>
            <span>{text}</span><EditMark label="Edit heading" />
          </Tag>
        );
      },
    },
    Text: {
      label: "Paragraph",
      fields: { text: { type: "textarea", label: "Text" } },
      defaultProps: { text: "Write the content for this section." },
      render: ({ text }) => <p className="flex max-w-3xl items-start gap-3 text-[1.05rem] leading-8 text-slate-600"><span>{text}</span><EditMark label="Edit paragraph" /></p>,
    },
    Image: {
      label: "Image",
      fields: {
        url: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt text" },
        caption: { type: "text", label: "Caption" },
      },
      defaultProps: { url: "", alt: "", caption: "" },
      render: ({ url, alt, caption }) => (
        <figure className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100 shadow-sm">
          <span className="absolute right-3 top-3 z-10"><EditMark label="Edit image" /></span>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="w-full object-cover" />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm font-medium text-slate-500">
              Add an image URL
            </div>
          )}
          {caption && (
            <figcaption className="bg-white px-5 py-3 text-sm text-slate-500">{caption}</figcaption>
          )}
        </figure>
      ),
    },
    CardGrid: {
      label: "Card grid",
      fields: {
        cards: {
          type: "array",
          label: "Cards",
          arrayFields: {
            title: { type: "text", label: "Title" },
            body: { type: "textarea", label: "Body" },
          },
          defaultItemProps: { title: "Card title", body: "Card description." },
        },
      },
      defaultProps: {
        cards: [
          { title: "First idea", body: "Describe the first working direction." },
          { title: "Second idea", body: "Describe the second working direction." },
        ],
      },
      render: ({ cards }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card, i) => (
            <article key={i} className="rounded-[1.4rem] border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(15,23,42,.1)]">
              <div className="flex items-start justify-between gap-3"><b className="block text-lg font-semibold tracking-[-.015em] text-slate-950">{card.title}</b><EditMark label={`Edit card ${i+1}`} /></div>
              <p className="mt-3 leading-7 text-slate-600">{card.body}</p>
            </article>
          ))}
        </div>
      ),
    },
    CTAButton: {
      label: "Call to action",
      fields: {
        label: { type: "text", label: "Label" },
        href: { type: "text", label: "Link" },
      },
      defaultProps: { label: "Learn more", href: "#" },
      render: ({ label, href }) => (
        <a
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b3154] px-6 py-3 font-bold text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5"
        >
          {label}<ArrowUpRight size={17}/><EditMark label="Edit button" />
        </a>
      ),
    },
    Divider: {
      label: "Divider",
      fields: {},
      defaultProps: {},
      render: () => <hr className="border-slate-200" />,
    },
  },
};
