import {
  BOOK_IR_VERSION,
  assertValidBookIR,
  isTextBlock,
  type BlockIR,
  type BlockStyleIR,
  type BookFontFamilyIR,
  type BookIR,
  type BookNavigationItem,
  type BookPosition,
  type ExternalSourceRef,
  type ImageAssetIR,
  type InlineMark,
  type InlineRunIR,
  type InternalLinkKind,
  type NoteKind,
  type SectionIR,
} from "@persimmon/book-core";
import type { Element } from "@xmldom/xmldom";
import { strFromU8 } from "fflate";

import {
  EpubArchive,
  resolveArchiveReference,
  type OpenEpubArchiveOptions,
} from "./archive";
import {
  contentAttribute,
  contentDescendants,
  firstContentDescendant,
  normalizedContentText,
  parseContentDocument,
  type ContentElement,
} from "./content-tree";
import { EpubImportError } from "./errors";
import {
  marksWithElementStyle,
  parseEpubStyleSheet,
  styleForContentElement,
  type EpubElementStyle,
  type EpubStyleSheet,
} from "./epub-styles";
import { detectImageSize } from "./image-dimensions";
import {
  deobfuscateIdpfFont,
  IDPF_FONT_OBFUSCATION_ALGORITHM,
  idpfFontObfuscationKey,
  removeXmlWhitespace,
} from "./font-obfuscation";
import {
  childElements,
  descendants,
  firstChildElement,
  firstDescendant,
  localName,
  normalizedText,
  parseXmlDocument,
} from "./xml";

const EPUB_MIMETYPE = "application/epub+zip";
const XHTML_MEDIA_TYPE = "application/xhtml+xml";
const IMAGE_MEDIA_TYPE_PREFIX = "image/";
const FONT_MEDIA_TYPES = new Set([
  "application/font-sfnt",
  "application/font-woff",
  "application/vnd.ms-opentype",
  "application/x-font-opentype",
  "application/x-font-ttf",
  "font/otf",
  "font/ttf",
  "font/woff",
  "font/woff2",
]);

export const EPUB_COMPILER_VERSION = 5 as const;

export interface EpubImportWarning {
  code:
    | "external-resource-ignored"
    | "non-linear-spine-item-skipped"
    | "unsupported-spine-item-skipped"
    | "empty-section-skipped"
    | "missing-image-skipped"
    | "unmanifested-image-skipped"
    | "malformed-xhtml-recovered"
    | "duplicate-spine-item-recovered"
    | "navigation-item-skipped"
    | "navigation-target-fallback"
    | "internal-link-skipped"
    | "stylesheet-skipped"
    | "embedded-font-skipped";
  message: string;
  context?: string;
}

export interface EpubImportMetadata {
  identifier?: string;
  author?: string;
  pageProgressionDirection?: "ltr" | "rtl" | "default";
}

export interface EpubImportResult {
  book: BookIR;
  metadata: EpubImportMetadata;
  resources: Readonly<Record<string, Uint8Array>>;
  warnings: readonly EpubImportWarning[];
}

export type ImportEpubOptions = OpenEpubArchiveOptions & {
  /**
   * Optional lowercase SHA-256 digest supplied by the storage boundary.
   * The synchronous parser keeps a deterministic non-cryptographic fallback
   * for pure-core callers and tests.
   */
  contentDigest?: string;
};

interface ManifestItem {
  id: string;
  href: string;
  path?: string;
  mediaType: string;
  properties: ReadonlySet<string>;
}

interface PackageModel {
  path: string;
  title?: string;
  author?: string;
  language?: string;
  identifier?: string;
  fontObfuscationIdentifier?: string;
  pageProgressionDirection?: "ltr" | "rtl" | "default";
  manifestById: ReadonlyMap<string, ManifestItem>;
  manifestByPath: ReadonlyMap<string, ManifestItem>;
  spine: readonly SpineItem[];
  navigationItem?: ManifestItem;
  coverItem?: ManifestItem;
}

interface SpineItem {
  manifestItem: ManifestItem;
  occurrence: number;
}

interface TextToken {
  kind: "text";
  run: InlineRunIR;
  pendingLink?: PendingInternalLink;
}

interface ImageToken {
  kind: "image";
  element: ContentElement;
}

type InlineToken = TextToken | ImageToken;
type StyleResolver = (element: ContentElement) => EpubElementStyle | undefined;

interface PendingInternalLink {
  readonly href: string;
  readonly kind: InternalLinkKind;
  readonly label: string;
  readonly sourceNoteKind?: NoteKind;
}

interface UnresolvedInternalLink extends PendingInternalLink {
  readonly run: InlineRunIR;
  readonly sourcePath: string;
}

interface InlineContext {
  readonly marks: ReadonlySet<InlineMark>;
  readonly noteKind?: NoteKind;
  readonly pendingLink?: PendingInternalLink;
  readonly verticalAlign?: "superscript" | "subscript";
  readonly bookFontFamilyId?: string;
}

interface NoteContext {
  readonly noteKind?: NoteKind;
  readonly collectionKind?: NoteKind;
  readonly bookFontFamilyId?: string;
}

type FontEncryptionMethods = ReadonlyMap<string, string>;

interface RawNavigationItem {
  readonly label: string;
  readonly href?: string;
  readonly children: readonly RawNavigationItem[];
}

const INLINE_ELEMENTS = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "cite",
  "code",
  "em",
  "i",
  "img",
  "rb",
  "rt",
  "ruby",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "u",
]);

const IGNORED_ELEMENTS = new Set([
  "audio",
  "head",
  "math",
  "noscript",
  "script",
  "style",
  "svg",
  "template",
  "video",
]);

const MARK_ORDER: readonly InlineMark[] = ["strong", "emphasis"];

const SUPERSCRIPT_CHARACTERS: Readonly<Record<string, string>> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
};

function splitTokens(value: string | null | undefined): Set<string> {
  return new Set((value ?? "").split(/\s+/).filter(Boolean));
}

function elementSemanticTokens(element: ContentElement): Set<string> {
  return splitTokens(
    [
      contentAttribute(element, "epub:type"),
      contentAttribute(element, "type"),
      contentAttribute(element, "role"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  );
}

function elementClassTokens(element: ContentElement): Set<string> {
  return splitTokens(contentAttribute(element, "class")?.toLowerCase());
}

function hasClassLike(element: ContentElement, pattern: RegExp): boolean {
  return [...elementClassTokens(element)].some((token) => pattern.test(token));
}

function noteKindForElement(element: ContentElement): NoteKind | undefined {
  const semantics = elementSemanticTokens(element);
  if (
    semantics.has("endnote") ||
    semantics.has("rearnote") ||
    semantics.has("doc-endnote")
  ) {
    return "endnote";
  }
  if (
    semantics.has("footnote") ||
    semantics.has("note") ||
    semantics.has("doc-footnote")
  ) {
    return "footnote";
  }
  if (hasClassLike(element, /(?:^|[-_])(footnote|fn)(?:$|[-_\d])/)) {
    return "footnote";
  }
  if (hasClassLike(element, /(?:^|[-_])(endnote|rearnote)(?:$|[-_\d])/)) {
    return "endnote";
  }
  return undefined;
}

function noteCollectionKindForElement(
  element: ContentElement,
): NoteKind | undefined {
  const semantics = elementSemanticTokens(element);
  return semantics.has("endnotes") ||
    semantics.has("rearnotes") ||
    semantics.has("doc-endnotes")
    ? "endnote"
    : undefined;
}

function noteContextForElement(
  element: ContentElement,
  inherited: NoteContext,
): NoteContext {
  const explicitNoteKind = noteKindForElement(element);
  const collectionKind =
    noteCollectionKindForElement(element) ?? inherited.collectionKind;
  const collectionItemKind =
    inherited.collectionKind && element.name === "li"
      ? inherited.collectionKind
      : undefined;
  return {
    ...((explicitNoteKind ?? collectionItemKind ?? inherited.noteKind)
      ? {
          noteKind:
            explicitNoteKind ?? collectionItemKind ?? inherited.noteKind,
        }
      : {}),
    ...(collectionKind ? { collectionKind } : {}),
  };
}

function pendingLinkForElement(
  element: ContentElement,
  context: InlineContext,
): PendingInternalLink | undefined {
  if (element.name !== "a") {
    return context.pendingLink;
  }
  const href = contentAttribute(element, "href")?.trim();
  if (
    !href ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) ||
    href.startsWith("//")
  ) {
    return undefined;
  }

  const semantics = elementSemanticTokens(element);
  const isNoteReference =
    semantics.has("noteref") ||
    semantics.has("doc-noteref") ||
    hasClassLike(
      element,
      /(?:^|[-_])(noteref|note-ref|fnref|footnote-ref)(?:$|[-_\d])/,
    ) ||
    (context.verticalAlign === "superscript" && href.includes("#"));
  const isBacklink =
    semantics.has("backlink") ||
    semantics.has("doc-backlink") ||
    hasClassLike(element, /(?:^|[-_])(backlink|backref)(?:$|[-_\d])/);
  const targetFragment = href.includes("#")
    ? href.slice(href.lastIndexOf("#") + 1).toLowerCase()
    : "";
  const isLikelyBacklink =
    context.noteKind !== undefined &&
    /^(?:(?:backref|noteref|note-ref|fnref|footnote-ref)(?:[-_]?\d+)?|ref[-_]?\d+)$/u.test(
      targetFragment,
    );
  return {
    href,
    kind: isNoteReference
      ? "note-reference"
      : isBacklink || isLikelyBacklink
        ? "note-backlink"
        : "internal",
    label: normalizedContentText(element) ?? href,
    ...(context.noteKind ? { sourceNoteKind: context.noteKind } : {}),
  };
}

function superscriptText(value: string): string {
  return [...value]
    .map((character) => SUPERSCRIPT_CHARACTERS[character] ?? character)
    .join("");
}

function stableHash(bytes: Uint8Array): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193) >>> 0;
    second = Math.imul(second ^ byte, 0x85ebca6b) >>> 0;
  }

  return `${first.toString(16).padStart(8, "0")}${second
    .toString(16)
    .padStart(8, "0")}`;
}

function readText(
  archive: EpubArchive,
  path: string,
  missingCode:
    | "missing-container"
    | "missing-package"
    | "missing-spine-resource",
): string {
  const bytes = archive.read(path);
  if (!bytes) {
    throw new EpubImportError(
      missingCode,
      `Required EPUB resource is missing: ${path}`,
      path,
    );
  }
  return strFromU8(bytes);
}

function getMetadataText(
  metadata: Element | undefined,
  elementName: string,
): string | undefined {
  return normalizedText(
    metadata ? firstDescendant(metadata, elementName) : undefined,
  );
}

function hasFixedLayout(packageElement: Element): boolean {
  for (const meta of descendants(packageElement, "meta")) {
    const property = meta.getAttribute("property")?.trim().toLowerCase();
    const name = meta.getAttribute("name")?.trim().toLowerCase();
    const content =
      normalizedText(meta)?.toLowerCase() ??
      meta.getAttribute("content")?.trim().toLowerCase();

    if (
      (property === "rendition:layout" && content === "pre-paginated") ||
      (name === "fixed-layout" && content === "true")
    ) {
      return true;
    }
  }

  return false;
}

function parseContainer(archive: EpubArchive): string {
  const path = "META-INF/container.xml";
  const document = parseXmlDocument(
    readText(archive, path, "missing-container"),
    path,
  );
  const rootfile = firstDescendant(document, "rootfile");
  const fullPath = rootfile?.getAttribute("full-path")?.trim();

  if (!fullPath) {
    throw new EpubImportError(
      "invalid-container",
      "container.xml does not identify a package document",
      path,
    );
  }

  return resolveArchiveReference("", fullPath);
}

function parseManifestItem(
  element: Element,
  packagePath: string,
  warnings: EpubImportWarning[],
): ManifestItem {
  const id = element.getAttribute("id")?.trim();
  const href = element.getAttribute("href")?.trim();
  const mediaType = element.getAttribute("media-type")?.trim();

  if (!id || !href || !mediaType) {
    throw new EpubImportError(
      "invalid-package",
      "Every manifest item must define id, href, and media-type",
      packagePath,
    );
  }

  let path: string | undefined;
  try {
    path = resolveArchiveReference(packagePath, href);
  } catch (error) {
    if (
      error instanceof EpubImportError &&
      error.code === "unsupported-external-resource"
    ) {
      warnings.push({
        code: "external-resource-ignored",
        message: `External manifest resource is ignored: ${href}`,
        context: href,
      });
    } else {
      throw error;
    }
  }

  return {
    id,
    href,
    path,
    mediaType,
    properties: splitTokens(element.getAttribute("properties")),
  };
}

function parsePackage(
  archive: EpubArchive,
  packagePath: string,
  warnings: EpubImportWarning[],
): PackageModel {
  const document = parseXmlDocument(
    readText(archive, packagePath, "missing-package"),
    packagePath,
  );
  const documentElement = document.documentElement;
  const packageElement =
    documentElement && localName(documentElement) === "package"
      ? documentElement
      : firstDescendant(document, "package");

  if (!packageElement) {
    throw new EpubImportError(
      "invalid-package",
      "Package document does not contain a package element",
      packagePath,
    );
  }

  if (hasFixedLayout(packageElement)) {
    throw new EpubImportError(
      "unsupported-fixed-layout",
      "Fixed-layout EPUB publications are not supported",
      packagePath,
    );
  }

  const metadata = firstChildElement(packageElement, "metadata");
  const manifest = firstChildElement(packageElement, "manifest");
  const spine = firstChildElement(packageElement, "spine");

  if (!manifest || !spine) {
    throw new EpubImportError(
      "invalid-package",
      "Package document must contain manifest and spine elements",
      packagePath,
    );
  }
  const uniqueIdentifierId = packageElement
    .getAttribute("unique-identifier")
    ?.trim();
  const identifierElement =
    (uniqueIdentifierId
      ? descendants(metadata ?? packageElement, "identifier").find(
          (element) =>
            element.getAttribute("id")?.trim() === uniqueIdentifierId,
        )
      : undefined) ?? firstDescendant(metadata ?? packageElement, "identifier");
  const rawIdentifier = identifierElement?.textContent ?? "";
  const fontObfuscationIdentifier =
    removeXmlWhitespace(rawIdentifier).length > 0 ? rawIdentifier : undefined;

  const manifestById = new Map<string, ManifestItem>();
  const manifestByPath = new Map<string, ManifestItem>();
  for (const itemElement of childElements(manifest).filter(
    (element) => localName(element) === "item",
  )) {
    const item = parseManifestItem(itemElement, packagePath, warnings);
    if (manifestById.has(item.id)) {
      throw new EpubImportError(
        "invalid-package",
        `Duplicate manifest id: ${item.id}`,
        packagePath,
      );
    }
    manifestById.set(item.id, item);
    if (item.path && !manifestByPath.has(item.path)) {
      manifestByPath.set(item.path, item);
    }
  }

  const epub3NavigationItem = [...manifestById.values()].find((item) =>
    item.properties.has("nav"),
  );
  const ncxId = spine.getAttribute("toc")?.trim();
  const navigationItem =
    epub3NavigationItem ?? (ncxId ? manifestById.get(ncxId) : undefined);

  const epub2CoverId = descendants(metadata ?? packageElement, "meta")
    .find(
      (element) =>
        element.getAttribute("name")?.trim().toLowerCase() === "cover",
    )
    ?.getAttribute("content")
    ?.trim();
  const coverItem =
    [...manifestById.values()].find((item) =>
      item.properties.has("cover-image"),
    ) ?? (epub2CoverId ? manifestById.get(epub2CoverId) : undefined);

  const spineItems: SpineItem[] = [];
  const spineOccurrences = new Map<string, number>();
  for (const itemref of childElements(spine).filter(
    (element) => localName(element) === "itemref",
  )) {
    const idref = itemref.getAttribute("idref")?.trim();
    const item = idref ? manifestById.get(idref) : undefined;
    if (!idref || !item) {
      throw new EpubImportError(
        "invalid-package",
        `Spine references an unknown manifest item: ${idref ?? ""}`,
        packagePath,
      );
    }

    const itemProperties = splitTokens(itemref.getAttribute("properties"));
    if (
      itemProperties.has("rendition:layout-pre-paginated") ||
      item.properties.has("rendition:layout-pre-paginated")
    ) {
      throw new EpubImportError(
        "unsupported-fixed-layout",
        `Fixed-layout spine item is not supported: ${item.href}`,
        item.href,
      );
    }

    if (itemref.getAttribute("linear")?.trim().toLowerCase() === "no") {
      warnings.push({
        code: "non-linear-spine-item-skipped",
        message: `Non-linear spine item is skipped: ${item.href}`,
        context: item.href,
      });
      continue;
    }

    if (!item.path) {
      warnings.push({
        code: "unsupported-spine-item-skipped",
        message: `External spine item is skipped: ${item.href}`,
        context: item.href,
      });
      continue;
    }

    if (item.mediaType !== XHTML_MEDIA_TYPE) {
      warnings.push({
        code: "unsupported-spine-item-skipped",
        message: `Unsupported spine media type ${item.mediaType}: ${item.href}`,
        context: item.href,
      });
      continue;
    }

    const occurrence = (spineOccurrences.get(item.id) ?? 0) + 1;
    spineOccurrences.set(item.id, occurrence);
    if (occurrence > 1) {
      warnings.push({
        code: "duplicate-spine-item-recovered",
        message: `Repeated spine item is kept with a stable occurrence id: ${item.href}`,
        context: item.href,
      });
    }
    spineItems.push({ manifestItem: item, occurrence });
  }

  const direction = spine.getAttribute("page-progression-direction")?.trim();
  const pageProgressionDirection =
    direction === "ltr" || direction === "rtl" || direction === "default"
      ? direction
      : undefined;

  return {
    path: packagePath,
    title: getMetadataText(metadata, "title"),
    author: getMetadataText(metadata, "creator"),
    language: getMetadataText(metadata, "language"),
    identifier: normalizedText(identifierElement),
    fontObfuscationIdentifier,
    pageProgressionDirection,
    manifestById,
    manifestByPath,
    spine: spineItems,
    ...(navigationItem ? { navigationItem } : {}),
    ...(coverItem ? { coverItem } : {}),
  };
}

function fontEncryptionMethods(archive: EpubArchive): FontEncryptionMethods {
  const path = "META-INF/encryption.xml";
  const bytes = archive.read(path);
  if (!bytes) {
    return new Map();
  }
  const document = parseXmlDocument(strFromU8(bytes), path);
  const methods = new Map<string, string>();
  for (const encryptedData of descendants(document, "encrypteddata")) {
    const method = firstDescendant(encryptedData, "encryptionmethod")
      ?.getAttribute("Algorithm")
      ?.trim();
    const reference = firstDescendant(encryptedData, "cipherreference")
      ?.getAttribute("URI")
      ?.trim();
    if (!method || !reference) {
      continue;
    }
    try {
      methods.set(resolveArchiveReference("", reference), method);
    } catch {
      // An unsafe encryption reference cannot authorize reading an archive path.
    }
  }
  return methods;
}

function sameMarks(
  left: readonly InlineMark[] | undefined,
  right: readonly InlineMark[] | undefined,
): boolean {
  const leftMarks = left ?? [];
  const rightMarks = right ?? [];
  return (
    leftMarks.length === rightMarks.length &&
    leftMarks.every((mark, index) => mark === rightMarks[index])
  );
}

function samePendingLink(
  left: PendingInternalLink | undefined,
  right: PendingInternalLink | undefined,
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.href === right.href &&
      left.kind === right.kind &&
      left.label === right.label &&
      left.sourceNoteKind === right.sourceNoteKind)
  );
}

function appendTextToken(
  tokens: InlineToken[],
  rawText: string,
  context: InlineContext,
): void {
  let text = rawText.replace(/[\t\n\r\f ]+/g, " ");
  if (text.length === 0) {
    return;
  }

  const previous = tokens.at(-1);
  if (previous?.kind === "text") {
    if (previous.run.text.endsWith("\n")) {
      text = text.replace(/^ +/, "");
    } else if (previous.run.text.endsWith(" ") && text.startsWith(" ")) {
      text = text.slice(1);
    }
  }
  if (text.length === 0) {
    return;
  }

  const orderedMarks = MARK_ORDER.filter((mark) => context.marks.has(mark));
  const run: InlineRunIR = {
    text,
    ...(orderedMarks.length > 0 ? { marks: orderedMarks } : {}),
    ...(context.verticalAlign ? { verticalAlign: context.verticalAlign } : {}),
    ...(context.bookFontFamilyId
      ? { bookFontFamilyId: context.bookFontFamilyId }
      : {}),
  };

  if (
    previous?.kind === "text" &&
    sameMarks(previous.run.marks, run.marks) &&
    previous.run.verticalAlign === run.verticalAlign &&
    previous.run.bookFontFamilyId === run.bookFontFamilyId &&
    samePendingLink(previous.pendingLink, context.pendingLink)
  ) {
    previous.run = {
      ...previous.run,
      text: previous.run.text + text,
    };
  } else {
    tokens.push({
      kind: "text",
      run,
      ...(context.pendingLink ? { pendingLink: context.pendingLink } : {}),
    });
  }
}

function appendBreakToken(tokens: InlineToken[], context: InlineContext) {
  const previous = tokens.at(-1);
  if (previous?.kind === "text" && previous.run.text.endsWith(" ")) {
    const trimmedText = previous.run.text.replace(/ +$/, "");
    if (trimmedText.length === 0) {
      tokens.pop();
    } else {
      previous.run = {
        ...previous.run,
        text: trimmedText,
      };
    }
  }

  const orderedMarks = MARK_ORDER.filter((mark) => context.marks.has(mark));
  const run: InlineRunIR = {
    text: "\n",
    ...(orderedMarks.length > 0 ? { marks: orderedMarks } : {}),
    ...(context.verticalAlign ? { verticalAlign: context.verticalAlign } : {}),
    ...(context.bookFontFamilyId
      ? { bookFontFamilyId: context.bookFontFamilyId }
      : {}),
  };
  const last = tokens.at(-1);
  if (
    last?.kind === "text" &&
    sameMarks(last.run.marks, run.marks) &&
    last.run.verticalAlign === run.verticalAlign &&
    last.run.bookFontFamilyId === run.bookFontFamilyId &&
    samePendingLink(last.pendingLink, context.pendingLink)
  ) {
    last.run = {
      ...last.run,
      text: `${last.run.text}\n`,
    };
  } else {
    tokens.push({
      kind: "text",
      run,
      ...(context.pendingLink ? { pendingLink: context.pendingLink } : {}),
    });
  }
}

function collectInlineTokens(
  node: ContentElement,
  context: InlineContext,
  tokens: InlineToken[],
  resolveStyle: StyleResolver,
): void {
  for (const child of node.children) {
    if (child.kind === "text") {
      appendTextToken(tokens, child.value, context);
      continue;
    }
    collectInlineElement(child, context, tokens, resolveStyle);
  }
}

function collectInlineElement(
  element: ContentElement,
  inherited: InlineContext,
  tokens: InlineToken[],
  resolveStyle: StyleResolver,
): void {
  const name = element.name;
  const elementStyle = resolveStyle(element);
  if (IGNORED_ELEMENTS.has(name) || elementStyle?.hidden) {
    return;
  }
  if (name === "img") {
    tokens.push({ kind: "image", element });
    return;
  }
  if (name === "br") {
    appendBreakToken(tokens, inherited);
    return;
  }

  const marks = new Set(marksWithElementStyle(inherited.marks, elementStyle));
  const bookFontFamilyId =
    elementStyle?.fontFamily !== undefined
      ? elementStyle.bookFontFamilyId
      : inherited.bookFontFamilyId;
  if (name === "strong" || name === "b") {
    marks.add("strong");
  }
  if (name === "em" || name === "i") {
    marks.add("emphasis");
  }
  const inheritedVerticalAlign =
    name === "sup"
      ? "superscript"
      : name === "sub"
        ? "subscript"
        : inherited.verticalAlign;
  const pendingLink = pendingLinkForElement(element, {
    ...inherited,
    marks,
    ...(inheritedVerticalAlign
      ? { verticalAlign: inheritedVerticalAlign }
      : {}),
  });
  const verticalAlign =
    pendingLink?.kind === "note-reference"
      ? "superscript"
      : inheritedVerticalAlign;
  collectInlineTokens(
    element,
    {
      marks,
      ...(inherited.noteKind ? { noteKind: inherited.noteKind } : {}),
      ...(pendingLink ? { pendingLink } : {}),
      ...(verticalAlign ? { verticalAlign } : {}),
      ...(bookFontFamilyId ? { bookFontFamilyId } : {}),
    },
    tokens,
    resolveStyle,
  );
}

function trimTextTokens(tokens: readonly TextToken[]): TextToken[] {
  const output = tokens.map((token) => ({
    ...token,
    run: { ...token.run },
  }));

  while (output.length > 0) {
    output[0] = {
      ...output[0],
      run: {
        ...output[0].run,
        text: output[0].run.text.replace(/^[ \n]+/, ""),
      },
    };
    if (output[0].run.text.length > 0) {
      break;
    }
    output.shift();
  }

  while (output.length > 0) {
    const lastIndex = output.length - 1;
    output[lastIndex] = {
      ...output[lastIndex],
      run: {
        ...output[lastIndex].run,
        text: output[lastIndex].run.text.replace(/[ \n]+$/, ""),
      },
    };
    if (output[lastIndex].run.text.length > 0) {
      break;
    }
    output.pop();
  }

  return output;
}

class SectionCompiler {
  private readonly blocks: BlockIR[] = [];
  private readonly assets: Record<string, ImageAssetIR>;
  private readonly resources: Record<string, Uint8Array>;
  private readonly fragmentBlockIds = new Map<string, string>();
  private readonly fragmentNoteKinds = new Map<string, NoteKind>();
  private readonly pendingFragmentAnchors = new Map<
    string,
    NoteKind | undefined
  >();
  private blockCounter = 0;

  constructor(
    private readonly archive: EpubArchive,
    private readonly packageModel: PackageModel,
    private readonly manifestItem: ManifestItem,
    private readonly sectionId: string,
    private readonly styleSheet: EpubStyleSheet,
    private readonly fontFamilyIdsByCssName: ReadonlyMap<string, string>,
    private readonly warnings: EpubImportWarning[],
    private readonly unresolvedInternalLinks: UnresolvedInternalLink[],
    assets: Record<string, ImageAssetIR>,
    resources: Record<string, Uint8Array>,
  ) {
    this.assets = assets;
    this.resources = resources;
  }

  compile(root: ContentElement): readonly BlockIR[] {
    const body = firstContentDescendant(root, "body") ?? root;
    if (this.styleFor(body)?.hidden) {
      return [];
    }
    this.processContainer(body, this.contextForElement(body, {}));
    const finalBlock = this.blocks.at(-1);
    if (finalBlock) {
      this.bindPendingAnchors(finalBlock.id);
    }
    return this.blocks;
  }

  fragmentTargets(): ReadonlyMap<string, BookPosition> {
    return new Map(
      [...this.fragmentBlockIds].map(([fragment, blockId]) => [
        fragment,
        {
          sectionId: this.sectionId,
          blockId,
          offset: 0,
        },
      ]),
    );
  }

  fragmentNoteKindsById(): ReadonlyMap<string, NoteKind> {
    return new Map(this.fragmentNoteKinds);
  }

  private nextBlockId(): string {
    this.blockCounter += 1;
    return `${this.sectionId}:block:${this.blockCounter}`;
  }

  private sourceFor(
    element: ContentElement,
    blockId: string,
  ): ExternalSourceRef {
    return {
      scheme: "epub",
      documentId: this.manifestItem.path ?? this.manifestItem.href,
      elementId: contentAttribute(element, "id")?.trim() || blockId,
    };
  }

  private styleFor(element: ContentElement): EpubElementStyle | undefined {
    const style = styleForContentElement(element, this.styleSheet);
    if (!style?.fontFamily) {
      return style;
    }
    const bookFontFamilyId = this.fontFamilyIdsByCssName.get(
      normalizeCssFontFamily(style.fontFamily),
    );
    return {
      ...style,
      ...(bookFontFamilyId ? { bookFontFamilyId } : {}),
    };
  }

  private contextForElement(
    element: ContentElement,
    inherited: NoteContext,
  ): NoteContext {
    const noteContext = noteContextForElement(element, inherited);
    const style = this.styleFor(element);
    const bookFontFamilyId =
      style?.fontFamily !== undefined
        ? style.bookFontFamilyId
        : inherited.bookFontFamilyId;
    return {
      ...noteContext,
      ...(bookFontFamilyId ? { bookFontFamilyId } : {}),
    };
  }

  private blockStyleFor(element: ContentElement): BlockStyleIR | undefined {
    const computed = this.styleFor(element);
    if (!computed) {
      return undefined;
    }
    const style: BlockStyleIR = {
      ...(computed.textAlign ? { textAlign: computed.textAlign } : {}),
      ...(computed.fontWeight ? { fontWeight: computed.fontWeight } : {}),
      ...(computed.fontStyle ? { fontStyle: computed.fontStyle } : {}),
      ...(computed.marginBeforeEm !== undefined
        ? { marginBeforeEm: computed.marginBeforeEm }
        : {}),
      ...(computed.marginAfterEm !== undefined
        ? { marginAfterEm: computed.marginAfterEm }
        : {}),
    };
    return Object.keys(style).length > 0 ? style : undefined;
  }

  private recordElementAnchors(
    element: ContentElement,
    blockId: string,
    inheritedNoteKind?: NoteKind,
  ): void {
    const noteKind =
      (element.name === "a" ? undefined : noteKindForElement(element)) ??
      inheritedNoteKind;
    const anchorNames = [
      contentAttribute(element, "id")?.trim(),
      element.name === "a"
        ? contentAttribute(element, "name")?.trim()
        : undefined,
    ].filter((value): value is string => Boolean(value));
    for (const anchorName of anchorNames) {
      if (!this.fragmentBlockIds.has(anchorName)) {
        this.fragmentBlockIds.set(anchorName, blockId);
      }
      if (noteKind && !this.fragmentNoteKinds.has(anchorName)) {
        this.fragmentNoteKinds.set(anchorName, noteKind);
      }
    }
    for (const child of element.children) {
      if (child.kind === "element") {
        this.recordElementAnchors(child, blockId, noteKind);
      }
    }
  }

  private queueElementAnchors(
    element: ContentElement,
    inheritedNoteKind?: NoteKind,
  ): void {
    const noteKind =
      (element.name === "a" ? undefined : noteKindForElement(element)) ??
      inheritedNoteKind;
    const anchorNames = [
      contentAttribute(element, "id")?.trim(),
      element.name === "a"
        ? contentAttribute(element, "name")?.trim()
        : undefined,
    ].filter((value): value is string => Boolean(value));
    for (const anchorName of anchorNames) {
      if (
        !this.fragmentBlockIds.has(anchorName) &&
        !this.pendingFragmentAnchors.has(anchorName)
      ) {
        this.pendingFragmentAnchors.set(anchorName, noteKind);
      }
    }
    for (const child of element.children) {
      if (child.kind === "element") {
        this.queueElementAnchors(child, noteKind);
      }
    }
  }

  private bindPendingAnchors(blockId: string): void {
    for (const [anchorName, noteKind] of this.pendingFragmentAnchors) {
      if (!this.fragmentBlockIds.has(anchorName)) {
        this.fragmentBlockIds.set(anchorName, blockId);
      }
      if (noteKind && !this.fragmentNoteKinds.has(anchorName)) {
        this.fragmentNoteKinds.set(anchorName, noteKind);
      }
    }
    this.pendingFragmentAnchors.clear();
  }

  private processContainer(
    container: ContentElement,
    context: NoteContext,
  ): void {
    let pendingInline: InlineToken[] = [];

    const flushInline = (): void => {
      if (pendingInline.length > 0) {
        this.emitTokens(
          container,
          pendingInline,
          "paragraph",
          1,
          context.noteKind,
        );
        pendingInline = [];
      }
    };

    for (const child of container.children) {
      if (child.kind === "text") {
        appendTextToken(pendingInline, child.value, {
          marks: new Set(),
          ...(context.noteKind ? { noteKind: context.noteKind } : {}),
          ...(context.bookFontFamilyId
            ? { bookFontFamilyId: context.bookFontFamilyId }
            : {}),
        });
        continue;
      }

      const element = child;
      const name = element.name;
      const elementContext = this.contextForElement(element, context);
      if (IGNORED_ELEMENTS.has(name) || this.styleFor(element)?.hidden) {
        continue;
      }
      if (INLINE_ELEMENTS.has(name)) {
        collectInlineElement(
          element,
          {
            marks: new Set(),
            ...(elementContext.noteKind
              ? { noteKind: elementContext.noteKind }
              : {}),
            ...(elementContext.bookFontFamilyId
              ? { bookFontFamilyId: elementContext.bookFontFamilyId }
              : {}),
          },
          pendingInline,
          (candidate) => this.styleFor(candidate),
        );
        continue;
      }

      flushInline();
      this.processBlockElement(element, elementContext);
    }

    flushInline();
  }

  private processBlockElement(
    element: ContentElement,
    context: NoteContext,
  ): void {
    const name = element.name;
    if (this.styleFor(element)?.hidden) {
      return;
    }

    if (name === "p") {
      const firstBlockIndex = this.blocks.length;
      const tokens: InlineToken[] = [];
      collectInlineTokens(
        element,
        {
          marks: new Set(),
          ...(context.noteKind ? { noteKind: context.noteKind } : {}),
          ...(context.bookFontFamilyId
            ? { bookFontFamilyId: context.bookFontFamilyId }
            : {}),
        },
        tokens,
        (candidate) => this.styleFor(candidate),
      );
      this.emitTokens(element, tokens, "paragraph", 1, context.noteKind);
      const firstBlock = this.blocks[firstBlockIndex];
      if (firstBlock) {
        this.recordElementAnchors(element, firstBlock.id, context.noteKind);
      } else {
        this.queueElementAnchors(element, context.noteKind);
      }
      return;
    }

    if (/^h[1-6]$/.test(name)) {
      const firstBlockIndex = this.blocks.length;
      const tokens: InlineToken[] = [];
      collectInlineTokens(
        element,
        {
          marks: new Set(),
          ...(context.noteKind ? { noteKind: context.noteKind } : {}),
          ...(context.bookFontFamilyId
            ? { bookFontFamilyId: context.bookFontFamilyId }
            : {}),
        },
        tokens,
        (candidate) => this.styleFor(candidate),
      );
      const rawLevel = Number(name.slice(1));
      const level = Math.min(rawLevel, 3) as 1 | 2 | 3;
      this.emitTokens(element, tokens, "heading", level, context.noteKind);
      const firstBlock = this.blocks[firstBlockIndex];
      if (firstBlock) {
        this.recordElementAnchors(element, firstBlock.id, context.noteKind);
      } else {
        this.queueElementAnchors(element, context.noteKind);
      }
      return;
    }

    if (name === "img") {
      this.emitImage(element);
      return;
    }

    const firstBlockIndex = this.blocks.length;
    this.processContainer(element, context);
    const firstBlock = this.blocks[firstBlockIndex];
    if (firstBlock) {
      this.recordElementAnchors(element, firstBlock.id, context.noteKind);
    } else {
      this.queueElementAnchors(element, context.noteKind);
    }
  }

  private emitTokens(
    sourceElement: ContentElement,
    tokens: readonly InlineToken[],
    kind: "paragraph" | "heading",
    level: 1 | 2 | 3 = 1,
    noteKind?: NoteKind,
  ): void {
    let runs: TextToken[] = [];

    const flushRuns = (): void => {
      const normalizedTokens = trimTextTokens(runs);
      runs = [];
      if (normalizedTokens.length === 0) {
        return;
      }
      const normalizedRuns = normalizedTokens.map((token) => token.run);

      const id = this.nextBlockId();
      this.bindPendingAnchors(id);
      if (kind === "heading") {
        this.blocks.push({
          kind: "heading",
          id,
          level,
          runs: normalizedRuns,
          ...(noteKind ? { noteKind } : {}),
          ...(this.blockStyleFor(sourceElement)
            ? { style: this.blockStyleFor(sourceElement) }
            : {}),
          source: this.sourceFor(sourceElement, id),
        });
      } else {
        this.blocks.push({
          kind: "paragraph",
          id,
          runs: normalizedRuns,
          ...(noteKind ? { noteKind } : {}),
          ...(this.blockStyleFor(sourceElement)
            ? { style: this.blockStyleFor(sourceElement) }
            : {}),
          source: this.sourceFor(sourceElement, id),
        });
      }
      this.recordElementAnchors(sourceElement, id, noteKind);
      for (const token of normalizedTokens) {
        if (!token.pendingLink) {
          continue;
        }
        this.unresolvedInternalLinks.push({
          ...token.pendingLink,
          run: token.run,
          sourcePath: this.manifestItem.path ?? this.manifestItem.href,
        });
      }
    };

    for (const token of tokens) {
      if (token.kind === "text") {
        runs.push(token);
      } else {
        flushRuns();
        this.emitImage(token.element);
      }
    }
    flushRuns();
  }

  private emitImage(element: ContentElement): void {
    if (this.styleFor(element)?.hidden) {
      return;
    }
    const source = contentAttribute(element, "src")?.trim();
    if (!source) {
      this.warnings.push({
        code: "missing-image-skipped",
        message: "Image without a src attribute is skipped",
        context: this.manifestItem.path,
      });
      return;
    }

    let path: string;
    try {
      path = resolveArchiveReference(
        this.manifestItem.path ?? this.manifestItem.href,
        source,
      );
    } catch (error) {
      if (
        error instanceof EpubImportError &&
        error.code === "unsupported-external-resource"
      ) {
        this.warnings.push({
          code: "external-resource-ignored",
          message: `External image is ignored: ${source}`,
          context: source,
        });
        return;
      }
      throw error;
    }

    const manifestAsset = this.packageModel.manifestByPath.get(path);
    if (
      !manifestAsset ||
      !manifestAsset.mediaType.startsWith(IMAGE_MEDIA_TYPE_PREFIX)
    ) {
      this.warnings.push({
        code: "unmanifested-image-skipped",
        message: `Image is not declared as an image in the manifest: ${source}`,
        context: path,
      });
      return;
    }

    const bytes = this.archive.read(path);
    if (!bytes) {
      this.warnings.push({
        code: "missing-image-skipped",
        message: `Manifest image is missing from the archive: ${path}`,
        context: path,
      });
      return;
    }

    const assetId = `epub-asset:${manifestAsset.id}`;
    this.assets[assetId] ??= {
      id: assetId,
      mediaType: manifestAsset.mediaType,
      byteLength: bytes.byteLength,
    };
    this.resources[assetId] ??= bytes;

    const id = this.nextBlockId();
    this.bindPendingAnchors(id);
    const intrinsicSize = detectImageSize(bytes, manifestAsset.mediaType);
    this.blocks.push({
      kind: "image",
      id,
      assetId,
      alt: contentAttribute(element, "alt") ?? "",
      ...(intrinsicSize ? { intrinsicSize } : {}),
      ...(this.blockStyleFor(element)
        ? { style: this.blockStyleFor(element) }
        : {}),
      source: this.sourceFor(element, id),
    });
    this.recordElementAnchors(element, id);
  }
}

function contentRawText(element: ContentElement): string {
  return element.children
    .map((child) =>
      child.kind === "text" ? child.value : contentRawText(child),
    )
    .join("");
}

function normalizeCssFontFamily(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function includeEmbeddedFontFaces(
  archive: EpubArchive,
  packageModel: PackageModel,
  styleSheet: EpubStyleSheet,
  encryptionMethods: FontEncryptionMethods,
  fontFamilies: Record<string, BookFontFamilyIR>,
  fontFamilyIdsByCssName: Map<string, string>,
  resources: Record<string, Uint8Array>,
  warnings: EpubImportWarning[],
): void {
  for (const definition of styleSheet.fontFaces) {
    let declared: ManifestItem | undefined;
    let fontPath: string | undefined;
    for (const source of definition.sources) {
      try {
        const path = resolveArchiveReference(definition.basePath, source);
        const candidate = packageModel.manifestByPath.get(path);
        if (
          candidate &&
          FONT_MEDIA_TYPES.has(candidate.mediaType.toLowerCase())
        ) {
          declared = candidate;
          fontPath = path;
          break;
        }
      } catch {
        // Try the next source in the author's CSS fallback list.
      }
    }
    if (!declared || !fontPath) {
      warnings.push({
        code: "embedded-font-skipped",
        message: `Embedded font has no supported manifested source: ${definition.family}`,
        context: definition.basePath,
      });
      continue;
    }
    const archivedBytes = archive.read(fontPath);
    if (!archivedBytes) {
      warnings.push({
        code: "embedded-font-skipped",
        message: `Embedded font is missing: ${fontPath}`,
        context: fontPath,
      });
      continue;
    }
    const encryptionMethod = encryptionMethods.get(fontPath);
    let fontBytes = archivedBytes;
    if (encryptionMethod) {
      if (
        encryptionMethod !== IDPF_FONT_OBFUSCATION_ALGORITHM ||
        !packageModel.fontObfuscationIdentifier
      ) {
        warnings.push({
          code: "embedded-font-skipped",
          message: `Embedded font uses unsupported encryption: ${fontPath}`,
          context: fontPath,
        });
        continue;
      }
      fontBytes = deobfuscateIdpfFont(
        archivedBytes,
        idpfFontObfuscationKey(packageModel.fontObfuscationIdentifier),
      );
    }

    const cssKey = normalizeCssFontFamily(definition.family);
    const familyId =
      fontFamilyIdsByCssName.get(cssKey) ??
      `epub-font-family:${stableHash(new TextEncoder().encode(cssKey))}`;
    fontFamilyIdsByCssName.set(cssKey, familyId);
    const resourceId = `epub-font:${declared.id}`;
    const faceId = `${familyId}:${declared.id}:${definition.weight}:${definition.style}`;
    const previous = fontFamilies[familyId];
    if (!previous?.faces.some((face) => face.id === faceId)) {
      fontFamilies[familyId] = {
        id: familyId,
        cssFamily: definition.family,
        faces: [
          ...(previous?.faces ?? []),
          {
            id: faceId,
            familyId,
            resourceId,
            mediaType: declared.mediaType,
            weight: definition.weight,
            style: definition.style,
          },
        ],
      };
    }
    resources[resourceId] ??= fontBytes;
  }
}

function loadSectionStyleSheet(
  archive: EpubArchive,
  packageModel: PackageModel,
  manifestItem: ManifestItem,
  root: ContentElement,
  encryptionMethods: FontEncryptionMethods,
  fontFamilies: Record<string, BookFontFamilyIR>,
  fontFamilyIdsByCssName: Map<string, string>,
  resources: Record<string, Uint8Array>,
  warnings: EpubImportWarning[],
): EpubStyleSheet {
  const documentPath = manifestItem.path ?? manifestItem.href;
  const sources = contentDescendants(root, "style").map((element) => ({
    cssText: contentRawText(element),
    basePath: documentPath,
  }));
  for (const link of contentDescendants(root, "link")) {
    if (
      !splitTokens(contentAttribute(link, "rel")?.toLowerCase()).has(
        "stylesheet",
      )
    ) {
      continue;
    }
    const href = contentAttribute(link, "href")?.trim();
    if (!href) {
      continue;
    }
    try {
      const path = resolveArchiveReference(
        manifestItem.path ?? manifestItem.href,
        href,
      );
      const declared = packageModel.manifestByPath.get(path);
      if (declared && declared.mediaType !== "text/css") {
        warnings.push({
          code: "stylesheet-skipped",
          message: `Linked stylesheet has a non-CSS media type: ${href}`,
          context: path,
        });
        continue;
      }
      const bytes = archive.read(path);
      if (!bytes) {
        warnings.push({
          code: "stylesheet-skipped",
          message: `Linked stylesheet is missing: ${href}`,
          context: path,
        });
        continue;
      }
      sources.push({
        cssText: strFromU8(bytes),
        basePath: path,
      });
    } catch (error) {
      if (
        error instanceof EpubImportError &&
        error.code === "unsupported-external-resource"
      ) {
        warnings.push({
          code: "stylesheet-skipped",
          message: `External stylesheet is ignored: ${href}`,
          context: href,
        });
        continue;
      }
      throw error;
    }
  }
  const styleSheet = parseEpubStyleSheet(sources);
  includeEmbeddedFontFaces(
    archive,
    packageModel,
    styleSheet,
    encryptionMethods,
    fontFamilies,
    fontFamilyIdsByCssName,
    resources,
    warnings,
  );
  return styleSheet;
}

function sectionTitle(
  root: ContentElement,
  blocks: readonly BlockIR[],
): string | undefined {
  const heading = blocks.find((block) => block.kind === "heading");
  if (heading?.kind === "heading") {
    const value = heading.runs
      .map((run) => run.text)
      .join("")
      .trim();
    if (value.length > 0) {
      return value;
    }
  }

  return normalizedContentText(firstContentDescendant(root, "title"));
}

function compileSections(
  archive: EpubArchive,
  packageModel: PackageModel,
  encryptionMethods: FontEncryptionMethods,
  warnings: EpubImportWarning[],
): {
  sections: SectionIR[];
  assets: Record<string, ImageAssetIR>;
  fontFamilies: Record<string, BookFontFamilyIR>;
  resources: Record<string, Uint8Array>;
  firstSectionByPath: Map<string, SectionIR>;
  fragmentTargetsByPath: Map<string, ReadonlyMap<string, BookPosition>>;
  fragmentNoteKindsByPath: Map<string, ReadonlyMap<string, NoteKind>>;
  unresolvedInternalLinks: UnresolvedInternalLink[];
} {
  const sections: SectionIR[] = [];
  const assets: Record<string, ImageAssetIR> = {};
  const fontFamilies: Record<string, BookFontFamilyIR> = {};
  const fontFamilyIdsByCssName = new Map<string, string>();
  const resources: Record<string, Uint8Array> = {};
  const firstSectionByPath = new Map<string, SectionIR>();
  const fragmentTargetsByPath = new Map<
    string,
    ReadonlyMap<string, BookPosition>
  >();
  const fragmentNoteKindsByPath = new Map<
    string,
    ReadonlyMap<string, NoteKind>
  >();
  const unresolvedInternalLinks: UnresolvedInternalLink[] = [];

  for (const spineItem of packageModel.spine) {
    const { manifestItem: item, occurrence } = spineItem;
    if (!item.path) {
      continue;
    }

    const source = readText(archive, item.path, "missing-spine-resource");
    const document = parseContentDocument(source, item.path);
    if (document.recovered) {
      warnings.push({
        code: "malformed-xhtml-recovered",
        message: `Malformed XHTML was recovered with the HTML5 parser: ${item.href}`,
        context: item.path,
      });
    }
    const sectionId =
      occurrence === 1
        ? `epub-section:${item.id}`
        : `epub-section:${item.id}:occurrence:${occurrence}`;
    const styleSheet = loadSectionStyleSheet(
      archive,
      packageModel,
      item,
      document.root,
      encryptionMethods,
      fontFamilies,
      fontFamilyIdsByCssName,
      resources,
      warnings,
    );
    const compiler = new SectionCompiler(
      archive,
      packageModel,
      item,
      sectionId,
      styleSheet,
      fontFamilyIdsByCssName,
      warnings,
      unresolvedInternalLinks,
      assets,
      resources,
    );
    const blocks = compiler.compile(document.root);

    if (blocks.length === 0) {
      warnings.push({
        code: "empty-section-skipped",
        message: `Empty spine section is skipped: ${item.href}`,
        context: item.path,
      });
      continue;
    }

    const title = sectionTitle(document.root, blocks);
    const section: SectionIR = {
      id: sectionId,
      ...(title ? { title } : {}),
      blocks,
    };
    sections.push(section);
    if (!firstSectionByPath.has(item.path)) {
      firstSectionByPath.set(item.path, section);
      fragmentTargetsByPath.set(item.path, compiler.fragmentTargets());
      fragmentNoteKindsByPath.set(item.path, compiler.fragmentNoteKindsById());
    }
  }

  return {
    sections,
    assets,
    fontFamilies,
    resources,
    firstSectionByPath,
    fragmentTargetsByPath,
    fragmentNoteKindsByPath,
    unresolvedInternalLinks,
  };
}

function contentElementChildren(
  element: ContentElement,
  expectedName?: string,
): ContentElement[] {
  return element.children.filter(
    (child): child is ContentElement =>
      child.kind === "element" &&
      (expectedName === undefined || child.name === expectedName),
  );
}

function parseNavigationList(list: ContentElement): RawNavigationItem[] {
  const items: RawNavigationItem[] = [];
  for (const listItem of contentElementChildren(list, "li")) {
    const directElements = contentElementChildren(listItem);
    const labelElement =
      directElements.find(
        (element) => element.name === "a" || element.name === "span",
      ) ?? firstContentDescendant(listItem, "a");
    const label = normalizedContentText(labelElement);
    const href =
      labelElement?.name === "a"
        ? contentAttribute(labelElement, "href")?.trim()
        : undefined;
    const nestedList =
      directElements.find(
        (element) => element.name === "ol" || element.name === "ul",
      ) ?? firstContentDescendant(listItem, "ol");
    const children = nestedList ? parseNavigationList(nestedList) : [];

    if (label) {
      items.push({
        label,
        ...(href ? { href } : {}),
        children,
      });
    } else {
      items.push(...children);
    }
  }
  return items;
}

function parseEpub3Navigation(
  source: string,
  path: string,
  warnings: EpubImportWarning[],
): RawNavigationItem[] {
  const document = parseContentDocument(source, path);
  if (document.recovered) {
    warnings.push({
      code: "malformed-xhtml-recovered",
      message: `Malformed navigation XHTML was recovered with the HTML5 parser: ${path}`,
      context: path,
    });
  }

  const navigationElements = [
    ...(document.root.name === "nav" ? [document.root] : []),
    ...contentDescendants(document.root, "nav"),
  ];
  const toc =
    navigationElements.find((element) => {
      const semanticType =
        contentAttribute(element, "epub:type") ??
        contentAttribute(element, "type");
      return (
        splitTokens(semanticType).has("toc") ||
        contentAttribute(element, "role") === "doc-toc"
      );
    }) ?? navigationElements[0];
  const list = toc
    ? (firstContentDescendant(toc, "ol") ?? firstContentDescendant(toc, "ul"))
    : undefined;
  return list ? parseNavigationList(list) : [];
}

function parseNcxNavigation(source: string, path: string): RawNavigationItem[] {
  const document = parseXmlDocument(source, path);
  const navMap = firstDescendant(document, "navmap");
  if (!navMap) {
    return [];
  }

  const parsePoints = (parent: Element): RawNavigationItem[] => {
    const items: RawNavigationItem[] = [];
    for (const point of childElements(parent).filter(
      (element) => localName(element) === "navpoint",
    )) {
      const label = normalizedText(firstDescendant(point, "text"));
      const href = firstChildElement(point, "content")
        ?.getAttribute("src")
        ?.trim();
      const children = parsePoints(point);
      if (label) {
        items.push({
          label,
          ...(href ? { href } : {}),
          children,
        });
      } else {
        items.push(...children);
      }
    }
    return items;
  };

  return parsePoints(navMap);
}

function fragmentFromReference(reference: string): string | undefined {
  const hashIndex = reference.indexOf("#");
  if (hashIndex === -1) {
    return undefined;
  }
  const rawFragment = reference.slice(hashIndex + 1).split("?")[0];
  if (!rawFragment) {
    return undefined;
  }
  try {
    return decodeURIComponent(rawFragment);
  } catch {
    return rawFragment;
  }
}

function inferredNoteKindFromReference(
  reference: string,
  label: string,
): NoteKind | undefined {
  const markerPunctuation = "*†‡().+-=[]";
  if (
    ![...label].every(
      (character) =>
        /[\s\d]/u.test(character) || markerPunctuation.includes(character),
    )
  ) {
    return undefined;
  }
  const normalized = reference.toLowerCase();
  if (/(?:endnote|rearnote|[#/_-]en[-_\d])/u.test(normalized)) {
    return "endnote";
  }
  return /(?:footnote|[#/_-]fn[-_\d]|[#/_-]note[-_\d])/u.test(normalized)
    ? "footnote"
    : undefined;
}

function resolveInternalLinks(
  unresolved: readonly UnresolvedInternalLink[],
  firstSectionByPath: ReadonlyMap<string, SectionIR>,
  fragmentTargetsByPath: ReadonlyMap<string, ReadonlyMap<string, BookPosition>>,
  fragmentNoteKindsByPath: ReadonlyMap<string, ReadonlyMap<string, NoteKind>>,
  warnings: EpubImportWarning[],
): void {
  for (const pending of unresolved) {
    let targetPath: string;
    try {
      targetPath = resolveArchiveReference(pending.sourcePath, pending.href);
    } catch {
      warnings.push({
        code: "internal-link-skipped",
        message: `Internal link target is unsupported and was skipped: ${pending.href}`,
        context: pending.href,
      });
      continue;
    }

    const targetSection = firstSectionByPath.get(targetPath);
    if (!targetSection) {
      warnings.push({
        code: "internal-link-skipped",
        message: `Internal link does not resolve to a readable spine section: ${pending.href}`,
        context: pending.href,
      });
      continue;
    }

    const fragment = fragmentFromReference(pending.href);
    const fragmentTarget = fragment
      ? fragmentTargetsByPath.get(targetPath)?.get(fragment)
      : undefined;
    if (fragment && !fragmentTarget) {
      warnings.push({
        code: "internal-link-skipped",
        message: `Internal link fragment was not found: ${pending.href}`,
        context: pending.href,
      });
      continue;
    }

    const target = fragmentTarget ?? {
      sectionId: targetSection.id,
      blockId: targetSection.blocks[0]!.id,
      offset: 0,
    };
    const semanticNoteKind = fragment
      ? fragmentNoteKindsByPath.get(targetPath)?.get(fragment)
      : undefined;
    const inferredNoteKind =
      semanticNoteKind ??
      (pending.kind === "note-reference" || pending.kind === "internal"
        ? inferredNoteKindFromReference(pending.href, pending.label)
        : undefined);
    const kind: InternalLinkKind =
      pending.kind === "internal" && inferredNoteKind
        ? "note-reference"
        : pending.kind;
    const noteKind =
      inferredNoteKind ??
      (kind === "note-backlink" ? pending.sourceNoteKind : undefined);
    pending.run.link = {
      kind,
      target,
      ...(noteKind ? { noteKind } : {}),
      label: pending.label,
    };
    if (kind === "note-reference") {
      pending.run.verticalAlign = "superscript";
      pending.run.text = superscriptText(pending.run.text);
      const targetBlock = targetSection.blocks.find(
        (block) => block.id === target.blockId,
      );
      if (
        inferredNoteKind &&
        targetBlock &&
        (targetBlock.kind === "paragraph" || targetBlock.kind === "heading") &&
        !targetBlock.noteKind
      ) {
        targetBlock.noteKind = inferredNoteKind;
      }
    }
  }
}

function compileNavigation(
  archive: EpubArchive,
  packageModel: PackageModel,
  firstSectionByPath: ReadonlyMap<string, SectionIR>,
  fragmentTargetsByPath: ReadonlyMap<string, ReadonlyMap<string, BookPosition>>,
  warnings: EpubImportWarning[],
): readonly BookNavigationItem[] | undefined {
  const navigationItem = packageModel.navigationItem;
  if (!navigationItem?.path) {
    return undefined;
  }

  const source = readText(
    archive,
    navigationItem.path,
    "missing-spine-resource",
  );
  const rawItems = navigationItem.properties.has("nav")
    ? parseEpub3Navigation(source, navigationItem.path, warnings)
    : parseNcxNavigation(source, navigationItem.path);
  let itemCounter = 0;

  const resolveItems = (
    items: readonly RawNavigationItem[],
  ): BookNavigationItem[] => {
    const resolved: BookNavigationItem[] = [];
    for (const item of items) {
      const children = resolveItems(item.children);
      if (!item.href) {
        resolved.push(...children);
        continue;
      }

      let targetPath: string;
      try {
        targetPath = resolveArchiveReference(
          navigationItem.path ?? packageModel.path,
          item.href,
        );
      } catch {
        warnings.push({
          code: "navigation-item-skipped",
          message: `Navigation target is unsupported and was skipped: ${item.href}`,
          context: item.href,
        });
        resolved.push(...children);
        continue;
      }

      const section = firstSectionByPath.get(targetPath);
      if (!section) {
        warnings.push({
          code: "navigation-item-skipped",
          message: `Navigation target does not resolve to a readable spine section: ${item.href}`,
          context: item.href,
        });
        resolved.push(...children);
        continue;
      }

      const fragment = fragmentFromReference(item.href);
      const fragmentTarget = fragment
        ? fragmentTargetsByPath.get(targetPath)?.get(fragment)
        : undefined;
      if (fragment && !fragmentTarget) {
        warnings.push({
          code: "navigation-target-fallback",
          message: `Navigation fragment was not found; using the section start: ${item.href}`,
          context: item.href,
        });
      }
      const target: BookPosition = fragmentTarget ?? {
        sectionId: section.id,
        blockId: section.blocks[0].id,
        offset: 0,
      };
      itemCounter += 1;
      resolved.push({
        id: `epub-nav:${itemCounter}`,
        label: item.label,
        target,
        ...(children.length > 0 ? { children } : {}),
      });
    }
    return resolved;
  };

  const navigation = resolveItems(rawItems);
  return navigation.length > 0 ? navigation : undefined;
}

function includeCoverResource(
  archive: EpubArchive,
  packageModel: PackageModel,
  assets: Record<string, ImageAssetIR>,
  resources: Record<string, Uint8Array>,
  warnings: EpubImportWarning[],
): string | undefined {
  const coverItem = packageModel.coverItem;
  if (
    !coverItem?.path ||
    !coverItem.mediaType.startsWith(IMAGE_MEDIA_TYPE_PREFIX)
  ) {
    return undefined;
  }
  const bytes = archive.read(coverItem.path);
  if (!bytes) {
    warnings.push({
      code: "missing-image-skipped",
      message: `Cover image is missing from the archive: ${coverItem.path}`,
      context: coverItem.path,
    });
    return undefined;
  }

  const assetId = `epub-asset:${coverItem.id}`;
  assets[assetId] ??= {
    id: assetId,
    mediaType: coverItem.mediaType,
    byteLength: bytes.byteLength,
  };
  resources[assetId] ??= bytes;
  return assetId;
}

function removeUnusedEmbeddedFonts(
  sections: readonly SectionIR[],
  fontFamilies: Record<string, BookFontFamilyIR>,
  resources: Record<string, Uint8Array>,
): void {
  const referencedFamilyIds = new Set(
    sections.flatMap((section) =>
      section.blocks.flatMap((block) =>
        isTextBlock(block)
          ? block.runs.flatMap((run) =>
              run.bookFontFamilyId ? [run.bookFontFamilyId] : [],
            )
          : [],
      ),
    ),
  );
  const allFontResourceIds = new Set(
    Object.values(fontFamilies).flatMap((family) =>
      family.faces.map((face) => face.resourceId),
    ),
  );
  for (const familyId of Object.keys(fontFamilies)) {
    if (!referencedFamilyIds.has(familyId)) {
      delete fontFamilies[familyId];
    }
  }
  const retainedFontResourceIds = new Set(
    Object.values(fontFamilies).flatMap((family) =>
      family.faces.map((face) => face.resourceId),
    ),
  );
  for (const resourceId of allFontResourceIds) {
    if (!retainedFontResourceIds.has(resourceId)) {
      delete resources[resourceId];
    }
  }
}

export function importEpub(
  bytes: Uint8Array,
  options: ImportEpubOptions = {},
): EpubImportResult {
  const archive = EpubArchive.open(bytes, options);
  const mimetype = archive.read("mimetype");
  if (!mimetype || strFromU8(mimetype) !== EPUB_MIMETYPE) {
    throw new EpubImportError(
      "invalid-mimetype",
      `EPUB mimetype must be exactly ${EPUB_MIMETYPE}`,
      "mimetype",
    );
  }

  const warnings: EpubImportWarning[] = [];
  const packagePath = parseContainer(archive);
  const packageModel = parsePackage(archive, packagePath, warnings);
  const encryptionMethods = fontEncryptionMethods(archive);
  const {
    sections,
    assets,
    fontFamilies,
    resources,
    firstSectionByPath,
    fragmentTargetsByPath,
    fragmentNoteKindsByPath,
    unresolvedInternalLinks,
  } = compileSections(archive, packageModel, encryptionMethods, warnings);

  if (sections.length === 0) {
    throw new EpubImportError(
      "empty-publication",
      "EPUB does not contain any supported readable sections",
      packagePath,
    );
  }

  resolveInternalLinks(
    unresolvedInternalLinks,
    firstSectionByPath,
    fragmentTargetsByPath,
    fragmentNoteKindsByPath,
    warnings,
  );
  const navigation = compileNavigation(
    archive,
    packageModel,
    firstSectionByPath,
    fragmentTargetsByPath,
    warnings,
  );
  const coverAssetId = includeCoverResource(
    archive,
    packageModel,
    assets,
    resources,
    warnings,
  );
  removeUnusedEmbeddedFonts(sections, fontFamilies, resources);
  const contentHash = options.contentDigest?.toLowerCase() ?? stableHash(bytes);
  if (options.contentDigest && !/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new EpubImportError(
      "invalid-input",
      "contentDigest must be a hexadecimal SHA-256 digest",
    );
  }
  const book: BookIR = {
    schemaVersion: BOOK_IR_VERSION,
    id: `epub:${contentHash}`,
    revisionId: `epub-revision:${contentHash}`,
    title: packageModel.title ?? sections[0].title ?? "Untitled publication",
    ...(packageModel.language ? { language: packageModel.language } : {}),
    sections,
    assets,
    ...(Object.keys(fontFamilies).length > 0 ? { fontFamilies } : {}),
    ...(coverAssetId ? { coverAssetId } : {}),
    ...(navigation ? { navigation } : {}),
  };
  assertValidBookIR(book);

  return {
    book,
    metadata: {
      ...(packageModel.identifier
        ? { identifier: packageModel.identifier }
        : {}),
      ...(packageModel.author ? { author: packageModel.author } : {}),
      ...(packageModel.pageProgressionDirection
        ? {
            pageProgressionDirection: packageModel.pageProgressionDirection,
          }
        : {}),
    },
    resources,
    warnings,
  };
}
