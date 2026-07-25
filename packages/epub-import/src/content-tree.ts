import type { Element as XmlElement, Node as XmlNode } from "@xmldom/xmldom";
import { parse } from "parse5";

import { EpubImportError } from "./errors";
import { parseXmlDocument } from "./xml";

export interface ContentText {
  readonly kind: "text";
  readonly value: string;
}

export interface ContentElement {
  readonly kind: "element";
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly ContentNode[];
}

export type ContentNode = ContentElement | ContentText;

export interface ParsedContentDocument {
  readonly root: ContentElement;
  readonly recovered: boolean;
}

interface HtmlAttribute {
  readonly name: string;
  readonly value: string;
}

interface HtmlNode {
  readonly nodeName?: string;
  readonly tagName?: string;
  readonly value?: string;
  readonly attrs?: readonly HtmlAttribute[];
  readonly childNodes?: readonly HtmlNode[];
}

function xmlLocalName(node: XmlNode): string {
  return (
    node.localName ?? node.nodeName.slice(node.nodeName.lastIndexOf(":") + 1)
  ).toLowerCase();
}

function fromXmlNode(node: XmlNode): ContentNode | undefined {
  if (node.nodeType === 3 || node.nodeType === 4) {
    return {
      kind: "text",
      value: node.nodeValue ?? "",
    };
  }
  if (node.nodeType !== 1) {
    return undefined;
  }

  const element = node as XmlElement;
  const attributes: Record<string, string> = {};
  const xmlAttributes = element.attributes;
  if (xmlAttributes) {
    for (let index = 0; index < xmlAttributes.length; index += 1) {
      const attribute = xmlAttributes.item(index);
      if (attribute) {
        attributes[attribute.name.toLowerCase()] = attribute.value;
      }
    }
  }

  const children: ContentNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const normalized = fromXmlNode(child);
    if (normalized) {
      children.push(normalized);
    }
  }

  return {
    kind: "element",
    name: xmlLocalName(node),
    attributes,
    children,
  };
}

function fromHtmlNode(node: HtmlNode): ContentNode | undefined {
  if (node.nodeName === "#text") {
    return {
      kind: "text",
      value: node.value ?? "",
    };
  }

  const name = node.tagName?.toLowerCase();
  if (!name) {
    return undefined;
  }

  const attributes: Record<string, string> = {};
  for (const attribute of node.attrs ?? []) {
    attributes[attribute.name.toLowerCase()] = attribute.value;
  }

  return {
    kind: "element",
    name,
    attributes,
    children: normalizeHtmlChildren(node.childNodes ?? []),
  };
}

function normalizeHtmlChildren(nodes: readonly HtmlNode[]): ContentNode[] {
  const children: ContentNode[] = [];
  for (const node of nodes) {
    const normalized = fromHtmlNode(node);
    if (normalized) {
      children.push(normalized);
      continue;
    }
    children.push(...normalizeHtmlChildren(node.childNodes ?? []));
  }
  return children;
}

function firstElement(
  nodes: readonly ContentNode[],
): ContentElement | undefined {
  for (const node of nodes) {
    if (node.kind === "element") {
      return node;
    }
  }
  return undefined;
}

function parseStrictXhtml(source: string, path: string): ContentElement {
  const document = parseXmlDocument(source, path, "application/xhtml+xml");
  const root = document.documentElement
    ? fromXmlNode(document.documentElement)
    : undefined;
  if (!root || root.kind !== "element") {
    throw new EpubImportError(
      "malformed-xml",
      `XHTML document has no root element: ${path}`,
      path,
    );
  }
  return root;
}

function parseRecoveredHtml(source: string, path: string): ContentElement {
  const document = parse(source) as unknown as HtmlNode;
  const root = firstElement(normalizeHtmlChildren(document.childNodes ?? []));
  if (!root) {
    throw new EpubImportError(
      "malformed-xml",
      `XHTML recovery produced no root element: ${path}`,
      path,
    );
  }
  return root;
}

export function parseContentDocument(
  source: string,
  path: string,
): ParsedContentDocument {
  try {
    return {
      root: parseStrictXhtml(source, path),
      recovered: false,
    };
  } catch (error) {
    if (!(error instanceof EpubImportError) || error.code !== "malformed-xml") {
      throw error;
    }
  }

  return {
    root: parseRecoveredHtml(source, path),
    recovered: true,
  };
}

export function contentAttribute(
  element: ContentElement,
  name: string,
): string | undefined {
  return element.attributes[name.toLowerCase()];
}

export function contentDescendants(
  element: ContentElement,
  expectedName: string,
): ContentElement[] {
  const matches: ContentElement[] = [];
  for (const child of element.children) {
    if (child.kind !== "element") {
      continue;
    }
    if (child.name === expectedName) {
      matches.push(child);
    }
    matches.push(...contentDescendants(child, expectedName));
  }
  return matches;
}

export function firstContentDescendant(
  element: ContentElement,
  expectedName: string,
): ContentElement | undefined {
  for (const child of element.children) {
    if (child.kind !== "element") {
      continue;
    }
    if (child.name === expectedName) {
      return child;
    }
    const nested = firstContentDescendant(child, expectedName);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export function normalizedContentText(
  element: ContentElement | undefined,
): string | undefined {
  if (!element) {
    return undefined;
  }

  const collect = (node: ContentNode): string =>
    node.kind === "text"
      ? node.value
      : node.children.map((child) => collect(child)).join("");
  const value = collect(element).replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : undefined;
}
