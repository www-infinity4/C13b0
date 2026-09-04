import type { Config } from "@puckeditor/core";

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
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#123f66] via-[#0e3a60] to-[#071f38] px-8 py-14 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-[#8fd3ff]">{eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">{subtitle}</p>
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
          <Tag className={level === "h2" ? "font-serif text-3xl font-black" : "font-serif text-2xl font-bold"}>
            {text}
          </Tag>
        );
      },
    },
    Text: {
      label: "Paragraph",
      fields: { text: { type: "textarea", label: "Text" } },
      defaultProps: { text: "Write the content for this section." },
      render: ({ text }) => <p className="text-[1.05rem] leading-8 text-white/75">{text}</p>,
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
        <figure className="overflow-hidden rounded-2xl border border-white/10">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="w-full object-cover" />
          ) : (
            <div className="flex h-48 items-center justify-center bg-white/5 text-sm text-white/40">
              Add an image URL
            </div>
          )}
          {caption && (
            <figcaption className="px-4 py-2 text-sm text-white/50">{caption}</figcaption>
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
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[.05] p-5">
              <b className="block font-serif text-lg">{card.title}</b>
              <p className="mt-2 text-sm text-white/65">{card.body}</p>
            </div>
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
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[#0b3154]"
        >
          {label}
        </a>
      ),
    },
    Divider: {
      label: "Divider",
      fields: {},
      defaultProps: {},
      render: () => <hr className="border-white/10" />,
    },
  },
};
