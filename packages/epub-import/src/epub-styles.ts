import type { BlockStyleIR, InlineMark } from "@persimmon/book-core";

import { contentAttribute, type ContentElement } from "./content-tree";

export interface EpubElementStyle extends BlockStyleIR {
  hidden?: boolean;
  fontFamily?: string;
  bookFontFamilyId?: string;
}

interface StyleValue {
  readonly value: string;
  readonly important: boolean;
}

interface CssRule {
  readonly selector: string;
  readonly compiledSelector: CompiledSimpleSelector | undefined;
  readonly specificity: number;
  readonly order: number;
  readonly declarations: ReadonlyMap<string, StyleValue>;
}

interface CompiledSimpleSelector {
  readonly tag: string | undefined;
  readonly ids: readonly string[];
  readonly classes: readonly string[];
}

interface SelectorElement {
  readonly name: string;
  readonly id: string | undefined;
  readonly classes: ReadonlySet<string>;
}

export interface EpubStyleSheet {
  readonly rules: readonly CssRule[];
  readonly fontFaces: readonly EpubFontFaceDefinition[];
}

export interface EpubStyleSource {
  readonly cssText: string;
  readonly basePath: string;
}

export interface EpubFontFaceDefinition {
  readonly family: string;
  readonly sources: readonly string[];
  readonly weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  readonly style: "normal" | "italic";
  readonly basePath: string;
}

const SUPPORTED_PROPERTIES = new Set([
  "display",
  "font-family",
  "font-style",
  "font-weight",
  "margin",
  "margin-block-end",
  "margin-block-start",
  "margin-bottom",
  "margin-top",
  "text-align",
]);

export function parseEpubStyleSheet(
  sources: readonly (string | EpubStyleSource)[],
): EpubStyleSheet {
  const rules: CssRule[] = [];
  const fontFaces: EpubFontFaceDefinition[] = [];
  let order = 0;

  for (const source of sources) {
    const cssText = typeof source === "string" ? source : source.cssText;
    const basePath = typeof source === "string" ? "" : source.basePath;
    const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    for (const match of withoutComments.matchAll(rulePattern)) {
      const selectorText = match[1]?.trim();
      const body = match[2] ?? "";
      if (!selectorText) {
        continue;
      }
      if (/^@font-face\b/i.test(selectorText)) {
        const fontFace = parseFontFace(body, basePath);
        if (fontFace) {
          fontFaces.push(fontFace);
        }
        continue;
      }
      if (selectorText.startsWith("@")) {
        continue;
      }
      const declarations = parseDeclarations(body);
      if (declarations.size === 0) {
        continue;
      }
      for (const selector of selectorText.split(",")) {
        const normalizedSelector = selector.trim();
        if (!normalizedSelector) {
          continue;
        }
        rules.push({
          selector: normalizedSelector,
          compiledSelector: compileSimpleSelector(normalizedSelector),
          specificity: selectorSpecificity(normalizedSelector),
          order: order++,
          declarations,
        });
      }
    }
  }

  return { rules, fontFaces };
}

export function styleForContentElement(
  element: ContentElement,
  styleSheet: EpubStyleSheet,
): EpubElementStyle | undefined {
  const winners = new Map<
    string,
    StyleValue & { specificity: number; order: number }
  >();
  const selectorElement: SelectorElement = {
    name: element.name,
    id: contentAttribute(element, "id"),
    classes: new Set(
      (contentAttribute(element, "class") ?? "").split(/\s+/).filter(Boolean),
    ),
  };
  for (const rule of styleSheet.rules) {
    if (
      !rule.compiledSelector ||
      !matchesSelector(selectorElement, rule.compiledSelector)
    ) {
      continue;
    }
    applyDeclarations(winners, rule.declarations, rule.specificity, rule.order);
  }

  const inlineStyle = contentAttribute(element, "style");
  if (inlineStyle) {
    applyDeclarations(
      winners,
      parseDeclarations(inlineStyle),
      1_000,
      Number.MAX_SAFE_INTEGER,
    );
  }

  const style: EpubElementStyle = {};
  if (winners.get("display")?.value.toLowerCase() === "none") {
    style.hidden = true;
  }

  const textAlign = winners.get("text-align")?.value.toLowerCase();
  if (textAlign === "center" || textAlign === "justify") {
    style.textAlign = textAlign;
  } else if (textAlign === "left" || textAlign === "start") {
    style.textAlign = "start";
  } else if (textAlign === "right" || textAlign === "end") {
    style.textAlign = "end";
  }

  const fontWeight = winners.get("font-weight")?.value.toLowerCase();
  if (
    fontWeight === "bold" ||
    fontWeight === "bolder" ||
    (fontWeight !== undefined && Number(fontWeight) >= 600)
  ) {
    style.fontWeight = 700;
  } else if (
    fontWeight === "normal" ||
    (fontWeight !== undefined && Number(fontWeight) < 600)
  ) {
    style.fontWeight = 400;
  }

  const fontStyle = winners.get("font-style")?.value.toLowerCase();
  if (fontStyle === "italic" || fontStyle === "oblique") {
    style.fontStyle = "italic";
  } else if (fontStyle === "normal") {
    style.fontStyle = "normal";
  }

  const fontFamily = firstFontFamily(winners.get("font-family")?.value);
  if (fontFamily) {
    style.fontFamily = fontFamily;
  }

  const marginTop =
    winners.get("margin-block-start")?.value ??
    winners.get("margin-top")?.value ??
    marginPart(winners.get("margin")?.value, "top");
  const marginBottom =
    winners.get("margin-block-end")?.value ??
    winners.get("margin-bottom")?.value ??
    marginPart(winners.get("margin")?.value, "bottom");
  const marginBeforeEm = parseLengthEm(marginTop);
  const marginAfterEm = parseLengthEm(marginBottom);
  if (marginBeforeEm !== undefined) {
    style.marginBeforeEm = marginBeforeEm;
  }
  if (marginAfterEm !== undefined) {
    style.marginAfterEm = marginAfterEm;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function firstFontFamily(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  let quote: "'" | '"' | undefined;
  let output = "";
  for (const character of value.trim()) {
    if ((character === "'" || character === '"') && !quote) {
      quote = character;
      continue;
    }
    if (character === quote) {
      quote = undefined;
      continue;
    }
    if (character === "," && !quote) {
      break;
    }
    output += character;
  }
  const family = output.trim();
  return family.length > 0 ? family : undefined;
}

function parseFontFace(
  body: string,
  basePath: string,
): EpubFontFaceDefinition | undefined {
  const declarations = new Map<string, string>();
  for (const declaration of body.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) {
      continue;
    }
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration
      .slice(separator + 1)
      .replace(/\s*!important\s*$/i, "")
      .trim();
    if (value) {
      declarations.set(property, value);
    }
  }
  const family = firstFontFamily(declarations.get("font-family"));
  const sources = [
    ...(declarations.get("src") ?? "").matchAll(
      /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)"'\s]+))\s*\)/gi,
    ),
  ].flatMap((match) => {
    const source = match[1] ?? match[2] ?? match[3];
    return source ? [source.trim()] : [];
  });
  if (!family || sources.length === 0) {
    return undefined;
  }
  const rawWeight = declarations.get("font-weight")?.toLowerCase();
  const numericWeight =
    rawWeight === "bold"
      ? 700
      : rawWeight === "normal"
        ? 400
        : Number(rawWeight);
  const weight = Math.min(
    900,
    Math.max(
      100,
      Math.round((Number.isFinite(numericWeight) ? numericWeight : 400) / 100) *
        100,
    ),
  ) as EpubFontFaceDefinition["weight"];
  const rawStyle = declarations.get("font-style")?.toLowerCase();
  return {
    family,
    sources,
    weight,
    style:
      rawStyle === "italic" || rawStyle === "oblique" ? "italic" : "normal",
    basePath,
  };
}

export function marksWithElementStyle(
  marks: ReadonlySet<InlineMark>,
  style: EpubElementStyle | undefined,
): ReadonlySet<InlineMark> {
  if (!style?.fontWeight && !style?.fontStyle) {
    return marks;
  }
  const output = new Set(marks);
  if (style.fontWeight === 700) {
    output.add("strong");
  } else if (style.fontWeight === 400) {
    output.delete("strong");
  }
  if (style.fontStyle === "italic") {
    output.add("emphasis");
  } else if (style.fontStyle === "normal") {
    output.delete("emphasis");
  }
  return output;
}

function parseDeclarations(source: string): ReadonlyMap<string, StyleValue> {
  const declarations = new Map<string, StyleValue>();
  for (const declaration of source.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) {
      continue;
    }
    const property = declaration.slice(0, separator).trim().toLowerCase();
    if (!SUPPORTED_PROPERTIES.has(property)) {
      continue;
    }
    const rawValue = declaration.slice(separator + 1).trim();
    const important = /\s*!important\s*$/i.test(rawValue);
    const value = rawValue.replace(/\s*!important\s*$/i, "").trim();
    if (!value) {
      continue;
    }
    declarations.set(property, { value, important });
  }
  return declarations;
}

function applyDeclarations(
  winners: Map<string, StyleValue & { specificity: number; order: number }>,
  declarations: ReadonlyMap<string, StyleValue>,
  specificity: number,
  order: number,
): void {
  for (const [property, candidate] of declarations) {
    const current = winners.get(property);
    if (
      current &&
      (current.important !== candidate.important
        ? current.important
        : current.specificity > specificity ||
          (current.specificity === specificity && current.order > order))
    ) {
      continue;
    }
    winners.set(property, {
      ...candidate,
      specificity,
      order,
    });
  }
}

function selectorSpecificity(selector: string): number {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classes = selector.match(/\.[\w-]+/g)?.length ?? 0;
  const tags =
    selector
      .replace(/#[\w-]+|\.[\w-]+|::?[\w()-]+|\[[^\]]+]/g, " ")
      .match(/\b[a-z][\w-]*\b/gi)?.length ?? 0;
  return ids * 100 + classes * 10 + tags;
}

function compileSimpleSelector(
  selector: string,
): CompiledSimpleSelector | undefined {
  const simple = selector.trim().split(/\s+|>/).filter(Boolean).at(-1);
  if (!simple || simple.includes("[") || simple.includes("+")) {
    return undefined;
  }
  const withoutPseudo = simple.replace(/::?[\w()-]+/g, "");
  const rawTag = withoutPseudo.match(/^([a-z][\w-]*|\*)/i)?.[1];
  return {
    tag: rawTag && rawTag !== "*" ? rawTag.toLowerCase() : undefined,
    ids: [...withoutPseudo.matchAll(/#([\w-]+)/g)].map((match) => match[1]!),
    classes: [...withoutPseudo.matchAll(/\.([\w-]+)/g)].map(
      (match) => match[1]!,
    ),
  };
}

function matchesSelector(
  element: SelectorElement,
  selector: CompiledSimpleSelector,
): boolean {
  if (selector.tag && selector.tag !== element.name) {
    return false;
  }

  for (const requiredId of selector.ids) {
    if (element.id !== requiredId) {
      return false;
    }
  }

  for (const requiredClass of selector.classes) {
    if (!element.classes.has(requiredClass)) {
      return false;
    }
  }
  return true;
}

function marginPart(
  value: string | undefined,
  side: "top" | "bottom",
): string | undefined {
  const parts = value?.trim().split(/\s+/);
  if (!parts || parts.length === 0 || parts.length > 4) {
    return undefined;
  }
  if (side === "top" || parts.length < 3) {
    return parts[0];
  }
  return parts[2];
}

function parseLengthEm(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "0") {
    return 0;
  }
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(em|rem|px|pt|%)$/);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const em =
    unit === "em" || unit === "rem"
      ? amount
      : unit === "px"
        ? amount / 16
        : unit === "pt"
          ? amount / 12
          : amount / 100;
  return Math.min(6, Math.max(0, em));
}
