"use client";

import React, { forwardRef } from "react";
import { ImageIcon, QrCode } from "lucide-react";
import type {
  BrandDesign,
  DynamicTemplate,
  FormatId,
  LayoutNode,
  ListNode,
  PostData,
  SimpleNode,
  TextNode,
} from "@/lib/studio-types";
import { FORMAT_PX, fitFontSize, typeSpec } from "@/lib/studio-layout";

export interface PostCanvasProps {
  template: DynamicTemplate;
  format?: FormatId;
  data: PostData;
  design: BrandDesign;
  scale?: number;
}

export function BrandLogo({
  design,
  textColor = "#FFFFFF",
  size = 32,
}: {
  design: BrandDesign;
  textColor?: string;
  size?: number;
}) {
  const brandName = design.brandName || "BRAND";
  const accentColor = design.colors?.accent || "#3B82F6";

  if (design.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={design.logoUrl}
        alt={brandName}
        style={{ height: size, maxWidth: size * 5 }}
        className="object-contain select-none pointer-events-none"
      />
    );
  }

  return (
    <div className="flex items-center gap-2.5 select-none" style={{ height: size }}>
      <span
        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
        style={{ backgroundColor: accentColor }}
      />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          letterSpacing: "0.1em",
          color: textColor,
          fontSize: size * 0.75,
          lineHeight: 1,
        }}
      >
        {brandName}
      </span>
    </div>
  );
}

function resolveColor(role: string, colors: BrandDesign["colors"]) {
  if (role === "accent") return colors.accent;
  if (role === "bgLight") return colors.bgLight;
  if (role === "muted") return colors.muted;
  if (role === "text") return colors.text;
  return colors.bgDark;
}

function resolveFont(role: string, fonts: BrandDesign["fonts"]) {
  if (role === "condensed") return `"${fonts.condensed}", sans-serif`;
  if (role === "mono") return `"${fonts.mono}", monospace`;
  return `"${fonts.display}", sans-serif`;
}

export const PostCanvas = forwardRef<HTMLDivElement, PostCanvasProps>(function PostCanvas(
  { template, format: overrideFormat, data, design, scale = 1 },
  ref
) {
  const format = overrideFormat || template.layout.format || "post";
  const [W, H] = FORMAT_PX[format] || [1080, 1080];
  const { colors: c, fonts: f } = design;
  const spec = typeSpec(design);
  const k = Math.min(W, H) / 1080;

  const bg = template.layout.background;
  const bgImg = (bg.image ? data[bg.image] : "") || bg.image;
  const bgColor = resolveColor(bg.color, c);

  const cssVars = {
    "--bg-dark": c.bgDark,
    "--bg-light": c.bgLight,
    "--accent": c.accent,
    "--text": c.text,
    "--muted": c.muted,
    "--font-display": `"${f.display}", sans-serif`,
    "--font-condensed": `"${f.condensed}", sans-serif`,
    "--font-mono": `"${f.mono}", monospace`,
    "--radius": `${design.radius}px`,
    "--pad": `${design.padding}px`,
  } as React.CSSProperties;

  const renderSimpleNode = (node: SimpleNode, scopeData: Record<string, any>, pW: number, pH: number) => {
    const boxStyle: React.CSSProperties = {
      position: "absolute",
      left: `${node.x}%`,
      top: `${node.y}%`,
      width: `${node.w}%`,
      height: `${node.h}%`,
    };

    if (node.type === "shape") {
      const fill = resolveColor(node.fill, c);
      const stroke = node.stroke ? resolveColor(node.stroke, c) : undefined;
      return (
        <div
          key={`shape-${node.x}-${node.y}`}
          style={{
            ...boxStyle,
            backgroundColor: fill,
            opacity: node.opacity,
            borderRadius: `${node.radius}px`,
            border: stroke ? `2px solid ${stroke}` : undefined,
          }}
        />
      );
    }

    if (node.type === "logo") {
      const alignClass =
        node.align === "center"
          ? "justify-center"
          : node.align === "right"
          ? "justify-end"
          : "justify-start";
      return (
        <div
          key={`logo-${node.x}-${node.y}`}
          style={boxStyle}
          className={`flex items-center ${alignClass}`}
        >
          <BrandLogo design={design} size={Math.min((node.h / 100) * pH, 48 * k)} />
        </div>
      );
    }

    if (node.type === "image") {
      const rawVal = scopeData[node.field];
      const imgUrl = typeof rawVal === "string" ? rawVal : "";
      const fieldLower = node.field.toLowerCase();
      const isCutout =
        fieldLower.includes("player") ||
        fieldLower.includes("cutout") ||
        fieldLower.includes("mascot") ||
        fieldLower.includes("character") ||
        fieldLower.includes("игрок") ||
        fieldLower.includes("персонаж") ||
        fieldLower.includes("маскот") ||
        fieldLower.includes("фото");

      return (
        <div
          key={`img-${node.field}-${node.x}-${node.y}`}
          style={{
            ...boxStyle,
            borderRadius: isCutout ? undefined : `${node.radius}px`,
            overflow: isCutout ? "visible" : "hidden",
          }}
          className={`relative ${imgUrl ? (isCutout ? "bg-transparent" : "bg-black/10") : "bg-black/20"}`}
        >
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt=""
              className={`w-full h-full ${
                isCutout ? "object-contain object-bottom" : "object-cover"
              } pointer-events-none select-none`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/30 text-xs gap-1 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-2 text-center select-none">
              {node.field.toLowerCase().includes("qr") ? (
                <QrCode className="w-6 h-6 text-white/40" />
              ) : (
                <ImageIcon className="w-5 h-5 text-white/30" />
              )}
              <span className="text-[9px] font-mono tracking-wider text-white/40 uppercase truncate max-w-full">
                {node.field}
              </span>
            </div>
          )}
          {node.overlay > 0 && !isCutout && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: `rgba(0,0,0,${node.overlay})` }}
            />
          )}
        </div>
      );
    }

    if (node.type === "text") {
      const raw = scopeData[node.field];
      const textVal = raw != null && raw !== "" ? String(raw) : `[${node.field}]`;
      const basePx = spec.scale[node.role] * k;
      const bW = (node.w / 100) * pW;
      const bH = (node.h / 100) * pH;

      const fittedPx = fitFontSize(textVal, bW, bH, basePx, {
        lineHeight: spec.lineHeight,
        maxLines: node.lines,
        uppercase: node.uppercase,
        tracking: spec.tracking,
        minSize: Math.max(11, basePx * 0.35),
      });

      const textColor = resolveColor(node.color, c);
      const fontFam = resolveFont(node.font, f);
      const alignClass =
        node.align === "center"
          ? "text-center items-center"
          : node.align === "right"
          ? "text-right items-end"
          : "text-left items-start";
      const vAlignClass =
        node.valign === "middle"
          ? "justify-center"
          : node.valign === "bottom"
          ? "justify-end"
          : "justify-start";

      return (
        <div
          key={`text-${node.field}-${node.x}-${node.y}`}
          style={boxStyle}
          className={`flex flex-col ${alignClass} ${vAlignClass} overflow-hidden`}
        >
          <div
            style={{
              fontFamily: fontFam,
              fontSize: `${Math.round(fittedPx)}px`,
              lineHeight: spec.lineHeight,
              letterSpacing: `${spec.tracking / 100}em`,
              textTransform: node.uppercase ? "uppercase" : "none",
              color: textColor,
              fontWeight: node.role === "display" ? 900 : node.role === "title" ? 800 : 600,
              maxWidth: "100%",
              whiteSpace: node.lines === 1 ? "nowrap" : "normal",
            }}
            className={node.lines === 1 ? "truncate w-full" : "break-words"}
          >
            {textVal}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderListNode = (node: ListNode) => {
    const listRaw = data[node.field];
    const items: any[] = Array.isArray(listRaw) ? listRaw.slice(0, node.max) : [];
    const cols = node.columns || 1;
    const count = items.length || 1;
    const rows = Math.ceil(count / cols);

    const bW = (node.w / 100) * W;
    const bH = (node.h / 100) * H;
    const gapPx = (node.gap / 100) * Math.min(W, H);

    const itemW = (bW - gapPx * (cols - 1)) / cols;
    const itemH = (bH - gapPx * (rows - 1)) / rows;

    return (
      <div
        key={`list-${node.field}-${node.x}-${node.y}`}
        style={{
          position: "absolute",
          left: `${node.x}%`,
          top: `${node.y}%`,
          width: `${node.w}%`,
          height: `${node.h}%`,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: `${gapPx}px`,
        }}
      >
        {items.map((rowItem, idx) => (
          <div key={idx} className="relative overflow-hidden w-full h-full">
            {node.item.map((subNode) => renderSimpleNode(subNode, rowItem, itemW, itemH))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        width: W * scale,
        height: H * scale,
        transformOrigin: "top left",
      }}
      className="relative shrink-0 overflow-hidden shadow-2xl rounded-sm"
    >
      <div
        ref={ref}
        id="studio-export-target"
        style={{
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: bgColor,
          ...cssVars,
        }}
        className="relative overflow-hidden select-none"
      >
        {/* Фоновое изображение */}
        {bgImg && (
          <div className="absolute inset-0 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgImg} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Фоновый оверлей */}
        {bg.overlay > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: `rgba(0,0,0,${bg.overlay})` }}
          />
        )}

        {/* Узлы макета */}
        {template.layout.nodes.map((node: LayoutNode) =>
          node.type === "list" ? renderListNode(node) : renderSimpleNode(node, data, W, H)
        )}
      </div>
    </div>
  );
});
