import {
  DOMParser,
  type Document,
  type Element,
  type Node,
} from "@xmldom/xmldom";

import { EpubImportError } from "./errors";

export function parseXmlDocument(
  source: string,
  path: string,
  mimeType: "application/xml" | "application/xhtml+xml" = "application/xml",
): Document {
  try {
    return new DOMParser({
      locator: false,
      onError(level, message) {
        if (level !== "warning") {
          throw new Error(message);
        }
      },
    }).parseFromString(source, mimeType);
  } catch (error) {
    throw new EpubImportError(
      "malformed-xml",
      `Malformed XML in ${path}`,
      path,
      { cause: error },
    );
  }
}

export function localName(node: Node): string {
  return (
    node.localName ??
    node.nodeName.slice(node.nodeName.lastIndexOf(":") + 1)
  ).toLowerCase();
}

export function childElements(node: Node): Element[] {
  const children: Element[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) {
      children.push(child as Element);
    }
  }
  return children;
}

export function firstChildElement(
  node: Node,
  expectedLocalName: string,
): Element | undefined {
  return childElements(node).find(
    (child) => localName(child) === expectedLocalName,
  );
}

export function descendants(
  node: Node,
  expectedLocalName: string,
): Element[] {
  const matches: Element[] = [];
  const visit = (parent: Node): void => {
    for (const child of childElements(parent)) {
      if (localName(child) === expectedLocalName) {
        matches.push(child);
      }
      visit(child);
    }
  };
  visit(node);
  return matches;
}

export function firstDescendant(
  node: Node,
  expectedLocalName: string,
): Element | undefined {
  for (const child of childElements(node)) {
    if (localName(child) === expectedLocalName) {
      return child;
    }
    const nested = firstDescendant(child, expectedLocalName);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export function normalizedText(node: Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  const value = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : undefined;
}

