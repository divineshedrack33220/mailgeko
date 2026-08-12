export interface DesignSettings {
  bgColor: string;
  contentBgColor: string;
  contentWidth: string;
  fontFamily: string;
  preheader: string;
}

export const defaultSettings: DesignSettings = {
  bgColor: "#f4f4f5",
  contentBgColor: "#ffffff",
  contentWidth: "600px",
  fontFamily: "Arial, Helvetica, sans-serif",
  preheader: "",
};

export type HeroProps = {
  bgColor: string;
  bgUrl: string;
  bgPosition: string;
  padding: string;
  align: "left" | "center" | "right";
  headline: string;
  headlineColor: string;
  subheadline: string;
  subheadlineColor: string;
  buttonText: string;
  buttonUrl: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonRadius: string;
};

export type BannerProps = {
  src: string;
  alt: string;
  href: string;
};

export type ImageProps = {
  src: string;
  alt: string;
  href: string;
  width: string;
  align: "left" | "center" | "right";
  borderRadius: string;
  padding: string;
};

export type TextProps = {
  content: string;
  fontSize: string;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: string;
  bold: boolean;
  italic: boolean;
  padding: string;
};

export type ButtonProps = {
  text: string;
  href: string;
  backgroundColor: string;
  color: string;
  borderRadius: string;
  width: string;
  align: "left" | "center" | "right";
  padding: string;
};

export type DividerProps = {
  borderColor: string;
  borderWidth: string;
  width: string;
  padding: string;
};

export type SpacerProps = {
  height: string;
};

export type SocialLink = { name: string; href: string };

export type SocialProps = {
  platforms: SocialLink[];
  iconSize: string;
  color: string;
  innerPadding: string;
  padding: string;
};

export interface BlockMap {
  hero: HeroProps;
  banner: BannerProps;
  image: ImageProps;
  text: TextProps;
  button: ButtonProps;
  divider: DividerProps;
  spacer: SpacerProps;
  social: SocialProps;
}

export type BlockType = keyof BlockMap;

export type Block = { id: string; type: BlockType; props: BlockMap[BlockType] };

export const blockLabels: Record<BlockType, string> = {
  hero: "Banner / hero",
  banner: "Image banner",
  image: "Image",
  text: "Text",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social icons",
};

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const makeBlock = (type: BlockType): Block => {
  const base = { id: newId(), type };
  switch (type) {
    case "hero":
      return {
        ...base,
        props: {
          bgColor: "#1e293b",
          bgUrl: "",
          bgPosition: "center center",
          padding: "72px 32px",
          align: "center",
          headline: "Big news is coming",
          headlineColor: "#ffffff",
          subheadline:
            "Tell your readers what's new and why they should care. Keep it short and exciting.",
          subheadlineColor: "#cbd5e1",
          buttonText: "Read more",
          buttonUrl: "{{cta_url}}",
          buttonColor: "#3bb974",
          buttonTextColor: "#ffffff",
          buttonRadius: "8px",
        },
      };
    case "banner":
      return {
        ...base,
        props: {
          src: "https://picsum.photos/seed/mailgeko/1200/400",
          alt: "Banner",
          href: "",
        },
      };
    case "image":
      return {
        ...base,
        props: {
          src: "https://picsum.photos/seed/mailgeko/600/300",
          alt: "Image",
          href: "",
          width: "100%",
          align: "center",
          borderRadius: "12px",
          padding: "8px 0",
        },
      };
    case "text":
      return {
        ...base,
        props: {
          content: "Hi {{first_name}},\n\nWrite your message here.",
          fontSize: "16px",
          color: "#334155",
          align: "left",
          lineHeight: "1.6",
          bold: false,
          italic: false,
          padding: "8px 0",
        },
      };
    case "button":
      return {
        ...base,
        props: {
          text: "Click here",
          href: "{{cta_url}}",
          backgroundColor: "#3bb974",
          color: "#ffffff",
          borderRadius: "8px",
          width: "220px",
          align: "center",
          padding: "16px 0",
        },
      };
    case "divider":
      return {
        ...base,
        props: {
          borderColor: "#e2e8f0",
          borderWidth: "1px",
          width: "100%",
          padding: "16px 0",
        },
      };
    case "spacer":
      return { ...base, props: { height: "24px" } };
    case "social":
      return {
        ...base,
        props: {
          platforms: [
            { name: "facebook", href: "https://facebook.com/yourpage" },
            { name: "x", href: "https://x.com/yourhandle" },
            { name: "instagram", href: "https://instagram.com/yourhandle" },
            { name: "linkedin", href: "https://linkedin.com/in/you" },
          ],
          iconSize: "32px",
          color: "#ffffff",
          innerPadding: "6px",
          padding: "24px 0",
        },
      };
  }
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const attr = (k: string, v?: string) =>
  v === undefined || v === "" ? "" : ` ${k}="${esc(v)}"`;

const textContent = (content: string) => esc(content).replace(/\n/g, "<br/>");

// mjml v5 only accepts px units for mj-image/mj-button width. Convert
// percentages against the email content width and normalize bare numbers
// to px so "50%", "240", or "240px" all compile cleanly.
const widthToPx = (contentWidth: string, w: string): string => {
  const t = (w ?? "").trim();
  if (!t || t === "100%") return t;
  if (t.endsWith("%")) {
    const pct = parseFloat(t);
    if (Number.isNaN(pct)) return "";
    const base = parseInt(contentWidth, 10) || 600;
    return `${Math.round((pct / 100) * base)}px`;
  }
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}px`;
  if (/^\d+(\.\d+)?px$/.test(t)) return t;
  return "";
};

const renderBlock = (b: Block, settings: DesignSettings): string => {
  switch (b.type) {
    case "hero": {
      const p = b.props as HeroProps;
      return [
        `<mj-section`,
        attr("background-color", p.bgColor),
        attr("background-url", p.bgUrl),
        p.bgUrl ? ` background-size="cover"` : "",
        attr("background-position", p.bgPosition),
        p.bgUrl ? ` background-repeat="no-repeat"` : "",
        attr("padding", p.padding),
        `>`,
        `  <mj-column>`,
        p.headline.trim()
          ? `    <mj-text font-size="32px" font-weight="700" color="${esc(p.headlineColor)}" align="${p.align}" padding="0 0 12px">${textContent(p.headline)}</mj-text>`
          : "",
        p.subheadline.trim()
          ? `    <mj-text font-size="16px" line-height="1.6" color="${esc(p.subheadlineColor)}" align="${p.align}" padding="0 0 24px">${textContent(p.subheadline)}</mj-text>`
          : "",
        p.buttonText.trim()
          ? `    <mj-button${attr("href", p.buttonUrl)} background-color="${esc(p.buttonColor)}" color="${esc(p.buttonTextColor)}" border-radius="${esc(p.buttonRadius)}" align="${p.align}" padding="14px 28px">${esc(p.buttonText)}</mj-button>`
          : "",
        `  </mj-column>`,
        `</mj-section>`,
      ]
        .filter((l) => l !== "")
        .join("\n");
    }
    case "banner": {
      const p = b.props as BannerProps;
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-image src="${esc(p.src)}" alt="${esc(p.alt)}" border="0"${attr("href", p.href)} />`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
    case "image": {
      const p = b.props as ImageProps;
      const w = widthToPx(settings.contentWidth, p.width);
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-image src="${esc(p.src)}" alt="${esc(p.alt)}"${w && w !== "100%" ? ` width="${esc(w)}"` : ""} align="${p.align}" border-radius="${esc(p.borderRadius)}" padding="${esc(p.padding)}"${attr("href", p.href)} />`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
    case "text": {
      const p = b.props as TextProps;
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-text font-size="${esc(p.fontSize)}" color="${esc(p.color)}" align="${p.align}" line-height="${esc(p.lineHeight)}" font-weight="${p.bold ? "700" : "400"}" font-style="${p.italic ? "italic" : "normal"}" padding="${esc(p.padding)}">${textContent(p.content)}</mj-text>`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
    case "button": {
      const p = b.props as ButtonProps;
      const w = widthToPx(settings.contentWidth, p.width);
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-button${attr("href", p.href)} background-color="${esc(p.backgroundColor)}" color="${esc(p.color)}" border-radius="${esc(p.borderRadius)}" align="${p.align}"${w ? ` width="${esc(w)}"` : ""} padding="${esc(p.padding)}">${esc(p.text)}</mj-button>`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
    case "divider": {
      const p = b.props as DividerProps;
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-divider border-color="${esc(p.borderColor)}" border-width="${esc(p.borderWidth)}" width="${esc(p.width)}" padding="${esc(p.padding)}" />`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
    case "spacer": {
      const p = b.props as SpacerProps;
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-spacer height="${esc(p.height)}" />`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
    case "social": {
      const p = b.props as SocialProps;
      return [
        `<mj-section background-color="${esc(settings.contentBgColor)}" padding="0">`,
        `  <mj-column>`,
        `    <mj-social icon-size="${esc(p.iconSize)}" color="${esc(p.color)}" inner-padding="${esc(p.innerPadding)}" padding="${esc(p.padding)}" border-radius="50%">`,
        ...p.platforms.map(
          (pl) => `      <mj-social-element name="${esc(pl.name)}"${attr("href", pl.href)} />`
        ),
        `    </mj-social>`,
        `  </mj-column>`,
        `</mj-section>`,
      ].join("\n");
    }
  }
};

export function blocksToMjml(blocks: Block[], settings: DesignSettings): string {
  const head: string[] = [];
  if (settings.preheader.trim()) {
    head.push(`    <mj-preview>${esc(settings.preheader)}</mj-preview>`);
  }
  if (settings.fontFamily) {
    head.push(
      `    <mj-attributes><mj-all font-family="${esc(settings.fontFamily)}" /></mj-attributes>`
    );
  }
  return [
    "<mjml>",
    "  <mj-head>",
    ...head,
    "  </mj-head>",
    `<mj-body background-color="${esc(settings.bgColor)}" width="${esc(settings.contentWidth)}">`,
    ...blocks.map((b) => indent(renderBlock(b, settings), 2)),
    "  </mj-body>",
    "</mjml>",
  ].join("\n");
}

const indent = (s: string, n: number) =>
  s
    .split("\n")
    .map((l) => " ".repeat(n) + l)
    .join("\n");

const stripText = (innerHtml: string): string => {
  const div = document.createElement("div");
  div.innerHTML = innerHtml.replace(/<br\s*\/?>/gi, "\n");
  return (div.textContent ?? "").trim();
};

export function parseMjml(src: string): {
  blocks: Block[];
  settings: Partial<DesignSettings>;
} | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(src, "text/xml");
  if (!doc || doc.getElementsByTagName("parsererror").length > 0) return null;
  const body = doc.getElementsByTagName("mj-body")[0];
  if (!body) return null;

  const settings: Partial<DesignSettings> = {};
  const bg = body.getAttribute("background-color");
  if (bg) settings.bgColor = bg;
  const width = body.getAttribute("width");
  if (width) settings.contentWidth = width;
  const preview = doc.getElementsByTagName("mj-preview")[0];
  if (preview) settings.preheader = (preview.textContent ?? "").trim();
  const all = doc.getElementsByTagName("mj-all")[0];
  if (all) {
    const ff = all.getAttribute("font-family");
    if (ff) settings.fontFamily = ff;
  }
  const firstSection = body.getElementsByTagName("mj-section")[0];
  if (firstSection) {
    const sectionBg = firstSection.getAttribute("background-color");
    if (sectionBg) settings.contentBgColor = sectionBg;
  }

  const blocks: Block[] = [];
  let n = 0;
  const push = (type: BlockType, props: BlockMap[BlockType]) => {
    blocks.push({ id: `p${n++}`, type, props });
  };

  const textProps = (el: Element, overrides: Partial<TextProps> = {}) => ({
    content: stripText(el.innerHTML),
    fontSize: el.getAttribute("font-size") ?? "16px",
    color: el.getAttribute("color") ?? "#334155",
    align: (el.getAttribute("align") ?? "left") as TextProps["align"],
    lineHeight: el.getAttribute("line-height") ?? "1.6",
    bold: (el.getAttribute("font-weight") ?? "400").includes("700"),
    italic: (el.getAttribute("font-style") ?? "normal") === "italic",
    padding: el.getAttribute("padding") ?? "8px 0",
    ...overrides,
  });

  const imageProps = (el: Element, fullBleed: boolean): ImageProps | BannerProps => {
    const common = {
      src: el.getAttribute("src") ?? "",
      alt: el.getAttribute("alt") ?? "",
      href: el.getAttribute("href") ?? "",
    };
    if (fullBleed) {
      return { ...common, width: "100%" };
    }
    return {
      ...common,
      width: el.getAttribute("width") ?? "100%",
      align: (el.getAttribute("align") ?? "center") as ImageProps["align"],
      borderRadius: el.getAttribute("border-radius") ?? "0px",
      padding: el.getAttribute("padding") ?? "8px 0",
    };
  };

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "mj-section" || tag === "mj-wrapper") {
        const cols = Array.from(child.children).filter(
          (c) => c.tagName.toLowerCase() === "mj-column"
        );
        if (cols.length > 0) {
          for (const col of cols) walk(col);
        } else {
          walk(child);
        }
      } else if (tag === "mj-hero") {
        const texts: Element[] = [];
        let button: Element | null = null;
        for (const c of Array.from(child.children)) {
          const t = c.tagName.toLowerCase();
          if (t === "mj-text") texts.push(c);
          else if (t === "mj-button" && !button) button = c;
        }
        const h = texts[0];
        const s = texts[1];
        push("hero", {
          bgColor: child.getAttribute("background-color") ?? "#1e293b",
          bgUrl: child.getAttribute("background-url") ?? "",
          bgPosition: child.getAttribute("background-position") ?? "center center",
          padding: child.getAttribute("padding") ?? "72px 32px",
          align: (h?.getAttribute("align") ?? "center") as HeroProps["align"],
          headline: h ? stripText(h.innerHTML) : "",
          headlineColor: h?.getAttribute("color") ?? "#ffffff",
          subheadline: s ? stripText(s.innerHTML) : "",
          subheadlineColor: s?.getAttribute("color") ?? "#cbd5e1",
          buttonText: button ? stripText(button.innerHTML) : "",
          buttonUrl: button?.getAttribute("href") ?? "",
          buttonColor: button?.getAttribute("background-color") ?? "#3bb974",
          buttonTextColor: button?.getAttribute("color") ?? "#ffffff",
          buttonRadius: button?.getAttribute("border-radius") ?? "8px",
        });
      } else if (tag === "mj-image") {
        const fullBleed = (child.getAttribute("width") ?? "100%") === "100%";
        push(fullBleed ? "banner" : "image", imageProps(child, fullBleed));
      } else if (tag === "mj-text") {
        push("text", textProps(child));
      } else if (tag === "mj-button") {
        push("button", {
          text: stripText(child.innerHTML),
          href: child.getAttribute("href") ?? "",
          backgroundColor: child.getAttribute("background-color") ?? "#3bb974",
          color: child.getAttribute("color") ?? "#ffffff",
          borderRadius: child.getAttribute("border-radius") ?? "8px",
          width: child.getAttribute("width") ?? "220px",
          align: (child.getAttribute("align") ?? "center") as ButtonProps["align"],
          padding: child.getAttribute("padding") ?? "16px 0",
        });
      } else if (tag === "mj-divider") {
        push("divider", {
          borderColor: child.getAttribute("border-color") ?? "#e2e8f0",
          borderWidth: child.getAttribute("border-width") ?? "1px",
          width: child.getAttribute("width") ?? "100%",
          padding: child.getAttribute("padding") ?? "16px 0",
        });
      } else if (tag === "mj-spacer") {
        push("spacer", { height: child.getAttribute("height") ?? "24px" });
      } else if (tag === "mj-social") {
        const platforms: SocialLink[] = [];
        for (const c of Array.from(child.children)) {
          if (c.tagName.toLowerCase() !== "mj-social-element") continue;
          const name = c.getAttribute("name") ?? "";
          if (name) platforms.push({ name, href: c.getAttribute("href") ?? "" });
        }
        push("social", {
          platforms,
          iconSize: child.getAttribute("icon-size") ?? "32px",
          color: child.getAttribute("color") ?? "#ffffff",
          innerPadding: child.getAttribute("inner-padding") ?? "6px",
          padding: child.getAttribute("padding") ?? "24px 0",
        });
      }
    }
  };

  walk(body);
  return { blocks, settings };
}

export const SOCIAL_PLATFORMS = [
  "facebook",
  "x",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "github",
  "whatsapp",
];
