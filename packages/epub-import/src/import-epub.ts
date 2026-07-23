import {
  BOOK_IR_VERSION,
  assertValidBookIR,
  type BlockIR,
  type BookIR,
  type ExternalSourceRef,
  type ImageAssetIR,
  type InlineMark,
  type InlineRunIR,
  type SectionIR,
} from "@persimmon/book-core";
import { strFromU8 } from "fflate";
import type { Document, Element, Node } from "@xmldom/xmldom";

import {
  EpubArchive,
  resolveArchiveReference,
  type OpenEpubArchiveOptions,
} from "./archive";
import { EpubImportError } from "./errors";
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

export interface EpubImportWarning {
  code:
    | "external-resource-ignored"
    | "non-linear-spine-item-skipped"
    | "unsupported-spine-item-skipped"
    | "empty-section-skipped"
    | "missing-image-skipped"
    | "unmanifested-image-skipped";
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

export interface ImportEpubOptions extends OpenEpubArchiveOptions {}

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
  pageProgressionDirection?: "ltr" | "rtl" | "default";
  manifestById: ReadonlyMap<string, ManifestItem>;
  manifestByPath: ReadonlyMap<string, ManifestItem>;
  spine: readonly ManifestItem[];
}

interface TextToken {
  kind: "text";
  run: InlineRunIR;
}

interface ImageToken {
  kind: "image";
  element: Element;
}

type InlineToken = TextToken | ImageToken;

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

function splitTokens(value: string | null): Set<string> {
  return new Set((value ?? "").split(/\s+/).filter(Boolean));
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
  missingCode: "missing-container" | "missing-package" | "missing-spine-resource",
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

  const spineItems: ManifestItem[] = [];
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

    spineItems.push(item);
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
    identifier: getMetadataText(metadata, "identifier"),
    pageProgressionDirection,
    manifestById,
    manifestByPath,
    spine: spineItems,
  };
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

function appendTextToken(
  tokens: InlineToken[],
  rawText: string,
  marks: ReadonlySet<InlineMark>,
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

  const orderedMarks = MARK_ORDER.filter((mark) => marks.has(mark));
  const run: InlineRunIR =
    orderedMarks.length > 0 ? { text, marks: orderedMarks } : { text };

  if (previous?.kind === "text" && sameMarks(previous.run.marks, run.marks)) {
    previous.run = {
      ...previous.run,
      text: previous.run.text + text,
    };
  } else {
    tokens.push({ kind: "text", run });
  }
}

function appendBreakToken(tokens: InlineToken[], marks: ReadonlySet<InlineMark>) {
  const previous = tokens.at(-1);
  if (previous?.kind === "text" && previous.run.text.endsWith(" ")) {
    previous.run = {
      ...previous.run,
      text: previous.run.text.replace(/ +$/, ""),
    };
  }

  const orderedMarks = MARK_ORDER.filter((mark) => marks.has(mark));
  const run: InlineRunIR =
    orderedMarks.length > 0
      ? { text: "\n", marks: orderedMarks }
      : { text: "\n" };
  const last = tokens.at(-1);
  if (last?.kind === "text" && sameMarks(last.run.marks, run.marks)) {
    last.run = {
      ...last.run,
      text: `${last.run.text}\n`,
    };
  } else {
    tokens.push({ kind: "text", run });
  }
}

function collectInlineTokens(
  node: Node,
  inheritedMarks: ReadonlySet<InlineMark>,
  tokens: InlineToken[],
): void {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 3 || child.nodeType === 4) {
      appendTextToken(tokens, child.nodeValue ?? "", inheritedMarks);
      continue;
    }
    if (child.nodeType !== 1) {
      continue;
    }

    const element = child as Element;
    collectInlineElement(element, inheritedMarks, tokens);
  }
}

function collectInlineElement(
  element: Element,
  inheritedMarks: ReadonlySet<InlineMark>,
  tokens: InlineToken[],
): void {
  const name = localName(element);
  if (IGNORED_ELEMENTS.has(name)) {
    return;
  }
  if (name === "img") {
    tokens.push({ kind: "image", element });
    return;
  }
  if (name === "br") {
    appendBreakToken(tokens, inheritedMarks);
    return;
  }

  const marks = new Set(inheritedMarks);
  if (name === "strong" || name === "b") {
    marks.add("strong");
  }
  if (name === "em" || name === "i") {
    marks.add("emphasis");
  }
  collectInlineTokens(element, marks, tokens);
}

function trimRuns(runs: readonly InlineRunIR[]): InlineRunIR[] {
  const output = runs.map((run) => ({ ...run }));

  while (output.length > 0) {
    output[0] = {
      ...output[0],
      text: output[0].text.replace(/^[ \n]+/, ""),
    };
    if (output[0].text.length > 0) {
      break;
    }
    output.shift();
  }

  while (output.length > 0) {
    const lastIndex = output.length - 1;
    output[lastIndex] = {
      ...output[lastIndex],
      text: output[lastIndex].text.replace(/[ \n]+$/, ""),
    };
    if (output[lastIndex].text.length > 0) {
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
  private blockCounter = 0;

  constructor(
    private readonly archive: EpubArchive,
    private readonly packageModel: PackageModel,
    private readonly manifestItem: ManifestItem,
    private readonly sectionId: string,
    private readonly warnings: EpubImportWarning[],
    assets: Record<string, ImageAssetIR>,
    resources: Record<string, Uint8Array>,
  ) {
    this.assets = assets;
    this.resources = resources;
  }

  compile(document: Document): readonly BlockIR[] {
    const body = firstDescendant(document, "body") ?? document.documentElement;
    if (!body) {
      throw new EpubImportError(
        "malformed-xml",
        `XHTML document has no root element: ${this.manifestItem.path}`,
        this.manifestItem.path,
      );
    }
    this.processContainer(body);
    return this.blocks;
  }

  private nextBlockId(): string {
    this.blockCounter += 1;
    return `${this.sectionId}:block:${this.blockCounter}`;
  }

  private sourceFor(element: Element, blockId: string): ExternalSourceRef {
    return {
      scheme: "epub",
      documentId: this.manifestItem.path ?? this.manifestItem.href,
      elementId: element.getAttribute("id")?.trim() || blockId,
    };
  }

  private processContainer(container: Element): void {
    let pendingInline: InlineToken[] = [];

    const flushInline = (): void => {
      if (pendingInline.length > 0) {
        this.emitTokens(container, pendingInline, "paragraph");
        pendingInline = [];
      }
    };

    for (let child = container.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        appendTextToken(pendingInline, child.nodeValue ?? "", new Set());
        continue;
      }
      if (child.nodeType !== 1) {
        continue;
      }

      const element = child as Element;
      const name = localName(element);
      if (IGNORED_ELEMENTS.has(name)) {
        continue;
      }
      if (INLINE_ELEMENTS.has(name)) {
        collectInlineElement(element, new Set(), pendingInline);
        continue;
      }

      flushInline();
      this.processBlockElement(element);
    }

    flushInline();
  }

  private processBlockElement(element: Element): void {
    const name = localName(element);

    if (name === "p") {
      const tokens: InlineToken[] = [];
      collectInlineTokens(element, new Set(), tokens);
      this.emitTokens(element, tokens, "paragraph");
      return;
    }

    if (/^h[1-6]$/.test(name)) {
      const tokens: InlineToken[] = [];
      collectInlineTokens(element, new Set(), tokens);
      const rawLevel = Number(name.slice(1));
      const level = Math.min(rawLevel, 3) as 1 | 2 | 3;
      this.emitTokens(element, tokens, "heading", level);
      return;
    }

    if (name === "img") {
      this.emitImage(element);
      return;
    }

    this.processContainer(element);
  }

  private emitTokens(
    sourceElement: Element,
    tokens: readonly InlineToken[],
    kind: "paragraph" | "heading",
    level: 1 | 2 | 3 = 1,
  ): void {
    let runs: InlineRunIR[] = [];

    const flushRuns = (): void => {
      const normalizedRuns = trimRuns(runs);
      runs = [];
      if (normalizedRuns.length === 0) {
        return;
      }

      const id = this.nextBlockId();
      if (kind === "heading") {
        this.blocks.push({
          kind: "heading",
          id,
          level,
          runs: normalizedRuns,
          source: this.sourceFor(sourceElement, id),
        });
      } else {
        this.blocks.push({
          kind: "paragraph",
          id,
          runs: normalizedRuns,
          source: this.sourceFor(sourceElement, id),
        });
      }
    };

    for (const token of tokens) {
      if (token.kind === "text") {
        runs.push(token.run);
      } else {
        flushRuns();
        this.emitImage(token.element);
      }
    }
    flushRuns();
  }

  private emitImage(element: Element): void {
    const source = element.getAttribute("src")?.trim();
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
    this.blocks.push({
      kind: "image",
      id,
      assetId,
      alt: element.getAttribute("alt") ?? "",
      source: this.sourceFor(element, id),
    });
  }
}

function sectionTitle(
  document: Document,
  blocks: readonly BlockIR[],
): string | undefined {
  const heading = blocks.find((block) => block.kind === "heading");
  if (heading?.kind === "heading") {
    const value = heading.runs.map((run) => run.text).join("").trim();
    if (value.length > 0) {
      return value;
    }
  }

  return normalizedText(firstDescendant(document, "title"));
}

function compileSections(
  archive: EpubArchive,
  packageModel: PackageModel,
  warnings: EpubImportWarning[],
): {
  sections: SectionIR[];
  assets: Record<string, ImageAssetIR>;
  resources: Record<string, Uint8Array>;
} {
  const sections: SectionIR[] = [];
  const assets: Record<string, ImageAssetIR> = {};
  const resources: Record<string, Uint8Array> = {};

  for (const item of packageModel.spine) {
    if (!item.path) {
      continue;
    }

    const source = readText(archive, item.path, "missing-spine-resource");
    const document = parseXmlDocument(
      source,
      item.path,
      "application/xhtml+xml",
    );
    const sectionId = `epub-section:${item.id}`;
    const compiler = new SectionCompiler(
      archive,
      packageModel,
      item,
      sectionId,
      warnings,
      assets,
      resources,
    );
    const blocks = compiler.compile(document);

    if (blocks.length === 0) {
      warnings.push({
        code: "empty-section-skipped",
        message: `Empty spine section is skipped: ${item.href}`,
        context: item.path,
      });
      continue;
    }

    const title = sectionTitle(document, blocks);
    sections.push({
      id: sectionId,
      ...(title ? { title } : {}),
      blocks,
    });
  }

  return { sections, assets, resources };
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
  const { sections, assets, resources } = compileSections(
    archive,
    packageModel,
    warnings,
  );

  if (sections.length === 0) {
    throw new EpubImportError(
      "empty-publication",
      "EPUB does not contain any supported readable sections",
      packagePath,
    );
  }

  const contentHash = stableHash(bytes);
  const book: BookIR = {
    schemaVersion: BOOK_IR_VERSION,
    id: `epub:${contentHash}`,
    revisionId: `epub-revision:${contentHash}`,
    title: packageModel.title ?? sections[0].title ?? "Untitled publication",
    ...(packageModel.language ? { language: packageModel.language } : {}),
    sections,
    assets,
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
            pageProgressionDirection:
              packageModel.pageProgressionDirection,
          }
        : {}),
    },
    resources,
    warnings,
  };
}
