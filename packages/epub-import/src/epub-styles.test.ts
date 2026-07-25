import { describe, expect, it } from "vitest";

import { parseContentDocument } from "./content-tree";
import { parseEpubStyleSheet, styleForContentElement } from "./epub-styles";

function firstBodyChild(source: string) {
  const root = parseContentDocument(
    `<html><body>${source}</body></html>`,
    "style-test.xhtml",
  ).root;
  const body = root.children.find(
    (child) => child.kind === "element" && child.name === "body",
  );
  if (!body || body.kind !== "element") {
    throw new Error("body not found");
  }
  const child = body.children.find((node) => node.kind === "element");
  if (!child || child.kind !== "element") {
    throw new Error("element not found");
  }
  return child;
}

describe("safe EPUB style cascade", () => {
  it("applies tag, class, id, inline, and important precedence", () => {
    const sheet = parseEpubStyleSheet([
      `
        p { text-align: justify; font-weight: normal }
        .lead { text-align: center; margin: 1em 0 2em }
        #opening { font-weight: bold }
        p { text-align: left !important }
      `,
    ]);
    const element = firstBodyChild(
      '<p id="opening" class="lead" style="font-style: italic; text-align: center">Text</p>',
    );

    expect(styleForContentElement(element, sheet)).toEqual({
      textAlign: "start",
      fontWeight: 700,
      fontStyle: "italic",
      marginBeforeEm: 1,
      marginAfterEm: 2,
    });
  });

  it("normalizes supported length units and ignores unsafe properties", () => {
    const sheet = parseEpubStyleSheet([
      `.hidden { display: none; position: fixed; margin-top: 32px; margin-bottom: -4em }`,
    ]);
    const element = firstBodyChild('<div class="hidden">Secret</div>');

    expect(styleForContentElement(element, sheet)).toEqual({
      hidden: true,
      marginBeforeEm: 2,
      marginAfterEm: 0,
    });
  });
});
