"use client";

import * as React from "react";
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  GripVertical,
  Plus,
  Image as ImageIcon,
  ImagePlus,
  Type,
  MousePointerClick,
  Minus,
  MoveVertical,
  Share2,
  PanelsTopLeft,
  Monitor,
  Tablet,
  Smartphone,
  LayoutGrid,
  Settings2,
  Code2,
  Eye,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Block,
  BlockType,
  DesignSettings,
  HeroProps,
  ImageProps,
  TextProps,
  ButtonProps,
  DividerProps,
  SocialProps,
  SpacerProps,
  SOCIAL_PLATFORMS,
  blockLabels,
  makeBlock,
} from "./blocks";

export type Device = "desktop" | "tablet" | "mobile";

interface EmailBuilderProps {
  blocks: Block[];
  settings: DesignSettings;
  onChange: (blocks: Block[], settings: DesignSettings) => void;
  device: Device;
  onDeviceChange: (device: Device) => void;
  variables: { name: string; label: string }[];
  mode: "design" | "code" | "html";
  onModeChange: (mode: "design" | "code" | "html") => void;
  emptyHint?: string;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const deviceWidth: Record<Device, number> = {
  desktop: 640,
  tablet: 480,
  mobile: 360,
};

const typeIcon: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  hero: PanelsTopLeft,
  banner: ImageIcon,
  image: ImagePlus,
  text: Type,
  button: MousePointerClick,
  divider: Minus,
  spacer: MoveVertical,
  social: Share2,
};

const paletteOrder: BlockType[] = [
  "hero",
  "banner",
  "image",
  "text",
  "button",
  "divider",
  "spacer",
  "social",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("h-8 text-sm", className)}
    />
  );
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-md border"
        aria-label="Pick color"
      />
      <TextField value={value} onChange={onChange} className="font-mono" />
    </div>
  );
}

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function AlignField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALIGN_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TextareaWithVars({
  value,
  onChange,
  variables,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  variables: { name: string; label: string }[];
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="text-sm"
      />
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {variables.map((v) => (
            <button
              key={v.name}
              type="button"
              title={v.label}
              onClick={() => onChange(`${value} ${v.name}`.trimStart())}
              className="hover:bg-accent hover:text-primary cursor-pointer rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70 transition-colors"
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// -------- Block previews (WYSIWYG approximation of the MJML output) --------

function HeroPreview({ p }: { p: HeroProps }) {
  return (
    <div
      style={{
        backgroundColor: p.bgColor,
        backgroundImage: p.bgUrl ? `url("${p.bgUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: p.bgPosition,
        backgroundRepeat: "no-repeat",
        padding: p.padding,
        textAlign: p.align,
      }}
    >
      {p.headline.trim() && (
        <div
          style={{ color: p.headlineColor, fontSize: "30px", fontWeight: 700, lineHeight: 1.3 }}
        >
          {p.headline}
        </div>
      )}
      {p.subheadline.trim() && (
        <div
          style={{
            color: p.subheadlineColor,
            fontSize: "16px",
            lineHeight: 1.6,
            marginTop: "12px",
          }}
        >
          {p.subheadline}
        </div>
      )}
      {p.buttonText.trim() && (
        <div
          style={{
            marginTop: "24px",
            display: "inline-block",
            backgroundColor: p.buttonColor,
            color: p.buttonTextColor,
            borderRadius: p.buttonRadius,
            padding: "14px 28px",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {p.buttonText}
        </div>
      )}
    </div>
  );
}

function MediaPreview({
  src,
  alt,
  href,
  fullBleed,
  image,
}: {
  src: string;
  alt: string;
  href: string;
  fullBleed: boolean;
  image: ImageProps;
}) {
  const inner = src ? (
    <img
      src={src}
      alt={alt}
      style={{
        display: "block",
        width: fullBleed ? "100%" : image.width,
        borderRadius: fullBleed ? "0px" : image.borderRadius,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    />
  ) : (
    <div className="bg-muted flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed">
      <ImageIcon className="text-muted-foreground size-6" />
      <span className="text-muted-foreground text-xs">Add an image URL in the editor</span>
    </div>
  );
  if (fullBleed) return inner;
  return (
    <div style={{ textAlign: image.align, padding: image.padding }}>{inner}</div>
  );
}

function BlockPreview({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return <HeroPreview p={block.props as HeroProps} />;
    case "banner": {
      const p = block.props as { src: string; alt: string; href: string };
      return (
        <MediaPreview
          src={p.src}
          alt={p.alt}
          href={p.href}
          fullBleed
          image={{ src: p.src, alt: p.alt, href: p.href, width: "100%", align: "center", borderRadius: "0px", padding: "0" }}
        />
      );
    }
    case "image":
      return <MediaPreview src={(block.props as ImageProps).src} alt={(block.props as ImageProps).alt} href={(block.props as ImageProps).href} fullBleed={false} image={block.props as ImageProps} />;
    case "text": {
      const p = block.props as TextProps;
      return (
        <div
          style={{
            fontSize: p.fontSize,
            color: p.color,
            textAlign: p.align,
            lineHeight: p.lineHeight,
            fontWeight: p.bold ? 700 : 400,
            fontStyle: p.italic ? "italic" : "normal",
            padding: p.padding,
            whiteSpace: "pre-line",
          }}
        >
          {p.content}
        </div>
      );
    }
    case "button": {
      const p = block.props as ButtonProps;
      return (
        <div style={{ textAlign: p.align, padding: p.padding }}>
          <span
            style={{
              display: "inline-block",
              backgroundColor: p.backgroundColor,
              color: p.color,
              borderRadius: p.borderRadius,
              padding: "12px 24px",
              fontWeight: 600,
              fontSize: "14px",
              width: p.width,
              textAlign: "center",
            }}
          >
            {p.text}
          </span>
        </div>
      );
    }
    case "divider": {
      const p = block.props as DividerProps;
      return (
        <div style={{ padding: p.padding, textAlign: "center" }}>
          <div
            style={{
              borderTop: `${p.borderWidth} solid ${p.borderColor}`,
              width: p.width,
              margin: "0 auto",
            }}
          />
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: (block.props as SpacerProps).height }} />;
    case "social": {
      const p = block.props as SocialProps;
      return (
        <div style={{ padding: p.padding }}>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {p.platforms.map((pl) => (
              <span
                key={pl.name}
                title={pl.href || pl.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: p.iconSize,
                  height: p.iconSize,
                  borderRadius: "50%",
                  backgroundColor: p.color === "#ffffff" ? "#475569" : p.color,
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  margin: p.innerPadding,
                }}
              >
                {pl.name[0]?.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      );
    }
  }
}

// -------- Main builder --------

export function EmailBuilder({
  blocks,
  settings,
  onChange,
  device,
  onDeviceChange,
  variables,
  mode,
  onModeChange,
  emptyHint,
}: EmailBuilderProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const updateBlock = (id: string, patch: Record<string, unknown>) => {
    onChange(
      blocks.map((b) =>
        b.id === id
          ? { ...b, props: { ...(b.props as Record<string, unknown>), ...patch } as Block["props"] }
          : b
      ),
      settings
    );
  };

  const updateSettings = (patch: Partial<DesignSettings>) => {
    onChange(blocks, { ...settings, ...patch });
  };

  const addBlock = (type: BlockType) => {
    const b = makeBlock(type);
    onChange([...blocks, b], settings);
    setSelectedId(b.id);
  };

  const removeBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    onChange(next, settings);
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...blocks[i], id: newId() };
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    onChange(next, settings);
    setSelectedId(copy.id);
  };

  const moveBlock = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = blocks.filter((_, idx) => idx !== from);
    next.splice(Math.min(to, next.length), 0, blocks[from]);
    onChange(next, settings);
  };

  const width = deviceWidth[device];
  const contentWidth = parseInt(settings.contentWidth) || 600;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 lg:gap-3">
        <Tabs
          value={mode}
          onValueChange={(v) => onModeChange(v as "design" | "code" | "html")}
        >
          <TabsList className="h-8">
            <TabsTrigger value="design" className="gap-1.5">
              <LayoutGrid className="size-3.5" /> Design
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5">
              <Code2 className="size-3.5" /> MJML
            </TabsTrigger>
            <TabsTrigger value="html" className="gap-1.5">
              <Eye className="size-3.5" /> HTML
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-muted-foreground hidden text-xs md:inline">
          Drag blocks to reorder, click one to edit
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(
            [
              { value: "desktop" as const, icon: Monitor, label: "Desktop" },
              { value: "tablet" as const, icon: Tablet, label: "Tablet" },
              { value: "mobile" as const, icon: Smartphone, label: "Mobile" },
            ]
          ).map((d) => (
            <Button
              key={d.value}
              variant={device === d.value ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onDeviceChange(d.value)}
              aria-label={d.label}
            >
              <d.icon />
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
        <aside className="bg-card flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-2 lg:w-[4.5rem] lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-3">
          <span className="text-muted-foreground hidden pb-1 text-[0.6rem] font-semibold uppercase lg:block">
            Blocks
          </span>
          {paletteOrder.map((type) => {
            const Icon = typeIcon[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                title={`Add ${blockLabels[type].toLowerCase()}`}
                className="hover:bg-accent hover:text-primary text-muted-foreground flex size-11 shrink-0 flex-col items-center justify-center gap-1 rounded-md transition-colors"
              >
                <Icon className="size-4" />
                <span className="text-[0.55rem] leading-none font-medium">{blockLabels[type]}</span>
              </button>
            );
          })}
        </aside>

        <ScrollArea className="min-h-0 flex-1">
          <div
            className="flex min-h-full justify-center px-4 py-6"
            style={{ backgroundColor: settings.bgColor }}
          >
            <div
              className="rounded-lg border border-black/10 shadow-md"
              style={{ width: Math.min(width, contentWidth), backgroundColor: settings.contentBgColor, fontFamily: settings.fontFamily }}
              onDragOver={(e) => {
                if (dragIndex !== null) {
                  e.preventDefault();
                  setOverIndex(blocks.length);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && overIndex !== null) moveBlock(dragIndex, overIndex);
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center">
                  <LayoutGrid className="text-muted-foreground size-8" />
                  <p className="text-muted-foreground max-w-xs text-sm">
                    {emptyHint ?? "This template is empty. Add your first block to start designing."}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                    {paletteOrder.slice(0, 5).map((type) => {
                      const Icon = typeIcon[type];
                      return (
                        <Button key={type} variant="outline" size="sm" onClick={() => addBlock(type)}>
                          <Icon className="size-3.5" /> {blockLabels[type]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                blocks.map((b, i) => {
                  const isSelected = b.id === selectedId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      onDragOver={(e) => {
                        if (dragIndex !== null) {
                          e.preventDefault();
                          setOverIndex(i);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null) moveBlock(dragIndex, i);
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={cn(
                        "group relative cursor-pointer transition-shadow",
                        isSelected ? "ring-primary/70 shadow-[0_0_0_2px_var(--primary)]" : "hover:ring-ring hover:shadow-[inset_0_0_0_1.5px_var(--ring)]",
                        overIndex === i && "shadow-[inset_0_0_0_2px_var(--primary)]"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 left-1 z-20 cursor-grab rounded bg-background/90 p-1 text-muted-foreground shadow-sm transition-opacity",
                          isSelected ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                        )}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragIndex(i);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        title="Drag to reorder"
                      >
                        <GripVertical className="size-3.5" />
                      </div>
                      <div
                        className={cn(
                          "absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm transition-opacity",
                          isSelected ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Move up"
                          disabled={i === 0}
                          onClick={() => moveBlock(i, i - 1)}
                          className="hover:bg-accent rounded p-1 disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          disabled={i === blocks.length - 1}
                          onClick={() => moveBlock(i, i + 1)}
                          className="hover:bg-accent rounded p-1 disabled:opacity-30"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate"
                          onClick={() => duplicateBlock(b.id)}
                          className="hover:bg-accent rounded p-1"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => removeBlock(b.id)}
                          className="hover:bg-destructive/10 hover:text-destructive rounded p-1"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <BlockPreview block={b} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>

        <aside className="bg-card flex w-full shrink-0 flex-col border-t lg:w-72 lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {selected ? (
                <>
                  {(() => {
                    const Icon = typeIcon[selected.type];
                    return <Icon className="text-primary size-3.5" />;
                  })()}
                  {blockLabels[selected.type]}
                </>
              ) : (
                <>
                  <Settings2 className="text-primary size-3.5" /> Template settings
                </>
              )}
            </span>
            {selected && (
              <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={() => setSelectedId(null)} aria-label="Back to settings">
                <Settings2 className="size-3.5" />
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-4 p-4">
              {selected ? (
                <BlockSettings
                  key={selected.id}
                  block={selected}
                  update={(patch) => updateBlock(selected.id, patch)}
                  variables={variables}
                />
              ) : (
                <TemplateSettings settings={settings} update={updateSettings} />
              )}
            </div>
          </ScrollArea>
          {!selected && (
            <div className="border-t p-3">
              <p className="text-muted-foreground pb-2 text-[0.65rem] font-medium uppercase">
                Add a block
              </p>
              <div className="flex flex-wrap gap-1.5">
                {paletteOrder.map((type) => {
                  const Icon = typeIcon[type];
                  return (
                    <Button key={type} variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => addBlock(type)}>
                      <Icon className="size-3.5" /> {blockLabels[type]}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TemplateSettings({
  settings,
  update,
}: {
  settings: DesignSettings;
  update: (patch: Partial<DesignSettings>) => void;
}) {
  return (
    <>
      <Field label="Body background">
        <ColorField value={settings.bgColor} onChange={(v) => update({ bgColor: v })} />
      </Field>
      <Field label="Content background">
        <ColorField value={settings.contentBgColor} onChange={(v) => update({ contentBgColor: v })} />
      </Field>
      <Field label="Content width">
        <TextField value={settings.contentWidth} onChange={(v) => update({ contentWidth: v })} placeholder="600px" />
      </Field>
      <Field label="Font family">
        <Select value={settings.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Arial, Helvetica, sans-serif">Arial</SelectItem>
            <SelectItem value="'Helvetica Neue', Arial, sans-serif">Helvetica</SelectItem>
            <SelectItem value="Georgia, 'Times New Roman', serif">Georgia</SelectItem>
            <SelectItem value="Verdana, Geneva, sans-serif">Verdana</SelectItem>
            <SelectItem value="'Segoe UI', Tahoma, sans-serif">Segoe UI</SelectItem>
            <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Preheader text">
        <Textarea
          value={settings.preheader}
          onChange={(e) => update({ preheader: e.target.value })}
          rows={2}
          placeholder="The short summary shown after the subject line"
          className="text-sm"
        />
      </Field>
      <div className="bg-muted/50 rounded-md border px-3 py-2">
        <p className="text-muted-foreground text-xs">
          Add blocks from the left panel, or pick from the list at the bottom. Click a block to edit
          its styles.
        </p>
      </div>
    </>
  );
}

function BlockSettings({
  block,
  update,
  variables,
}: {
  block: Block;
  update: (patch: Record<string, unknown>) => void;
  variables: { name: string; label: string }[];
}) {
  switch (block.type) {
    case "hero": {
      const p = block.props as HeroProps;
      return (
        <>
          <Field label="Background image URL">
            <TextField value={p.bgUrl} onChange={(v) => update({ bgUrl: v })} placeholder="https://…" />
          </Field>
          <Field label="Background color (fallback)">
            <ColorField value={p.bgColor} onChange={(v) => update({ bgColor: v })} />
          </Field>
          <Field label="Padding">
            <TextField value={p.padding} onChange={(v) => update({ padding: v })} placeholder="72px 32px" />
          </Field>
          <Field label="Alignment">
            <AlignField value={p.align} onChange={(v) => update({ align: v })} />
          </Field>
          <Field label="Headline">
            <TextareaWithVars value={p.headline} onChange={(v) => update({ headline: v })} variables={variables} />
          </Field>
          <Field label="Headline color">
            <ColorField value={p.headlineColor} onChange={(v) => update({ headlineColor: v })} />
          </Field>
          <Field label="Subheadline">
            <TextareaWithVars value={p.subheadline} onChange={(v) => update({ subheadline: v })} variables={variables} rows={2} />
          </Field>
          <Field label="Subheadline color">
            <ColorField value={p.subheadlineColor} onChange={(v) => update({ subheadlineColor: v })} />
          </Field>
          <Separator />
          <Field label="Button text">
            <TextField value={p.buttonText} onChange={(v) => update({ buttonText: v })} />
          </Field>
          <Field label="Button link">
            <TextField value={p.buttonUrl} onChange={(v) => update({ buttonUrl: v })} placeholder="{{cta_url}}" />
          </Field>
          <Field label="Button color">
            <ColorField value={p.buttonColor} onChange={(v) => update({ buttonColor: v })} />
          </Field>
          <Field label="Button text color">
            <ColorField value={p.buttonTextColor} onChange={(v) => update({ buttonTextColor: v })} />
          </Field>
          <Field label="Button radius">
            <TextField value={p.buttonRadius} onChange={(v) => update({ buttonRadius: v })} placeholder="8px" />
          </Field>
        </>
      );
    }
    case "banner": {
      const p = block.props as { src: string; alt: string; href: string };
      return (
        <>
          <Field label="Banner image URL">
            <TextField value={p.src} onChange={(v) => update({ src: v })} placeholder="https://…" />
          </Field>
          <Field label="Alt text">
            <TextField value={p.alt} onChange={(v) => update({ alt: v })} />
          </Field>
          <Field label="Link (optional)">
            <TextField value={p.href} onChange={(v) => update({ href: v })} placeholder="https://…" />
          </Field>
          <div className="bg-muted/50 rounded-md border px-3 py-2">
            <p className="text-muted-foreground text-xs">
              Full-width image. Use an animated GIF here for motion.
            </p>
          </div>
        </>
      );
    }
    case "image": {
      const p = block.props as ImageProps;
      return (
        <>
          <Field label="Image URL">
            <TextField value={p.src} onChange={(v) => update({ src: v })} placeholder="https://…" />
          </Field>
          <Field label="Alt text">
            <TextField value={p.alt} onChange={(v) => update({ alt: v })} />
          </Field>
          <Field label="Link (optional)">
            <TextField value={p.href} onChange={(v) => update({ href: v })} placeholder="https://…" />
          </Field>
          <Field label="Width">
            <TextField value={p.width} onChange={(v) => update({ width: v })} placeholder="100% or 240px" />
          </Field>
          <Field label="Alignment">
            <AlignField value={p.align} onChange={(v) => update({ align: v })} />
          </Field>
          <Field label="Border radius">
            <TextField value={p.borderRadius} onChange={(v) => update({ borderRadius: v })} placeholder="12px" />
          </Field>
          <Field label="Padding">
            <TextField value={p.padding} onChange={(v) => update({ padding: v })} placeholder="8px 0" />
          </Field>
        </>
      );
    }
    case "text": {
      const p = block.props as TextProps;
      return (
        <>
          <Field label="Text">
            <TextareaWithVars value={p.content} onChange={(v) => update({ content: v })} variables={variables} rows={6} />
          </Field>
          <Field label="Font size">
            <TextField value={p.fontSize} onChange={(v) => update({ fontSize: v })} placeholder="16px" />
          </Field>
          <Field label="Color">
            <ColorField value={p.color} onChange={(v) => update({ color: v })} />
          </Field>
          <Field label="Alignment">
            <AlignField value={p.align} onChange={(v) => update({ align: v })} />
          </Field>
          <Field label="Line height">
            <TextField value={p.lineHeight} onChange={(v) => update({ lineHeight: v })} placeholder="1.6" />
          </Field>
          <SwitchField label="Bold" checked={p.bold} onChange={(v) => update({ bold: v })} />
          <SwitchField label="Italic" checked={p.italic} onChange={(v) => update({ italic: v })} />
          <Field label="Padding">
            <TextField value={p.padding} onChange={(v) => update({ padding: v })} placeholder="8px 0" />
          </Field>
        </>
      );
    }
    case "button": {
      const p = block.props as ButtonProps;
      return (
        <>
          <Field label="Button text">
            <TextField value={p.text} onChange={(v) => update({ text: v })} />
          </Field>
          <Field label="Link">
            <TextField value={p.href} onChange={(v) => update({ href: v })} placeholder="{{cta_url}}" />
          </Field>
          <Field label="Background color">
            <ColorField value={p.backgroundColor} onChange={(v) => update({ backgroundColor: v })} />
          </Field>
          <Field label="Text color">
            <ColorField value={p.color} onChange={(v) => update({ color: v })} />
          </Field>
          <Field label="Border radius">
            <TextField value={p.borderRadius} onChange={(v) => update({ borderRadius: v })} placeholder="8px" />
          </Field>
          <Field label="Width">
            <TextField value={p.width} onChange={(v) => update({ width: v })} placeholder="220px" />
          </Field>
          <Field label="Alignment">
            <AlignField value={p.align} onChange={(v) => update({ align: v })} />
          </Field>
          <Field label="Padding">
            <TextField value={p.padding} onChange={(v) => update({ padding: v })} placeholder="16px 0" />
          </Field>
        </>
      );
    }
    case "divider": {
      const p = block.props as DividerProps;
      return (
        <>
          <Field label="Color">
            <ColorField value={p.borderColor} onChange={(v) => update({ borderColor: v })} />
          </Field>
          <Field label="Thickness">
            <TextField value={p.borderWidth} onChange={(v) => update({ borderWidth: v })} placeholder="1px" />
          </Field>
          <Field label="Width">
            <TextField value={p.width} onChange={(v) => update({ width: v })} placeholder="100%" />
          </Field>
          <Field label="Padding">
            <TextField value={p.padding} onChange={(v) => update({ padding: v })} placeholder="16px 0" />
          </Field>
        </>
      );
    }
    case "spacer": {
      const p = block.props as SpacerProps;
      return (
        <Field label="Height">
          <TextField value={p.height} onChange={(v) => update({ height: v })} placeholder="24px" />
        </Field>
      );
    }
    case "social": {
      const p = block.props as SocialProps;
      return (
        <>
          <p className="text-muted-foreground text-xs">Social icons</p>
          {p.platforms.map((pl, i) => (
            <div key={`${pl.name}-${i}`} className="flex flex-col gap-1.5 rounded-md border p-2">
              <div className="flex items-center justify-between">
                <Select
                  value={pl.name}
                  onValueChange={(v) => {
                    const platforms = [...p.platforms];
                    platforms[i] = { ...platforms[i], name: v };
                    update({ platforms });
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.map((sp) => (
                      <SelectItem key={sp} value={sp}>
                        {sp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={() => update({ platforms: p.platforms.filter((_, idx) => idx !== i) })}
                  aria-label="Remove social icon"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <TextField
                value={pl.href}
                onChange={(v) => {
                  const platforms = [...p.platforms];
                  platforms[i] = { ...platforms[i], href: v };
                  update({ platforms });
                }}
                placeholder="https://…"
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ platforms: [...p.platforms, { name: "youtube", href: "" }] })}
          >
            <Plus className="size-3.5" /> Add icon
          </Button>
          <Field label="Icon size">
            <TextField value={p.iconSize} onChange={(v) => update({ iconSize: v })} placeholder="32px" />
          </Field>
          <Field label="Icon color">
            <ColorField value={p.color} onChange={(v) => update({ color: v })} />
          </Field>
          <Field label="Icon spacing">
            <TextField value={p.innerPadding} onChange={(v) => update({ innerPadding: v })} placeholder="6px" />
          </Field>
          <Field label="Padding">
            <TextField value={p.padding} onChange={(v) => update({ padding: v })} placeholder="24px 0" />
          </Field>
        </>
      );
    }
  }
}

function Separator() {
  return <div className="bg-border h-px" />;
}
