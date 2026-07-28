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

  it("compiles the final simple selector without changing cascade behavior", () => {
    const sheet = parseEpubStyleSheet([
      `
        section > p.lead.featured:hover { text-align: center }
        p#opening.lead { font-weight: bold }
        p[data-kind="lead"] { display: none }
      `,
    ]);
    const element = firstBodyChild(
      '<p id="opening" class="lead featured">Text</p>',
    );

    expect(styleForContentElement(element, sheet)).toEqual({
      textAlign: "center",
      fontWeight: 700,
    });
  });

  it("extracts font faces and keeps only the first explicit CSS family", () => {
    const sheet = parseEpubStyleSheet([
      {
        cssText: `
          @font-face {
            font-family: "Publisher Song";
            src: local("Ignored"), url("../Fonts/song.woff2") format("woff2");
            font-weight: 650;
            font-style: oblique;
          }
          p { font-family: "Publisher Song", serif; }
        `,
        basePath: "OPS/Styles/book.css",
      },
    ]);
    expect(sheet.fontFaces).toEqual([
      {
        family: "Publisher Song",
        sources: ["../Fonts/song.woff2"],
        weight: 700,
        style: "italic",
        basePath: "OPS/Styles/book.css",
      },
    ]);
    expect(
      styleForContentElement(firstBodyChild("<p>Text</p>"), sheet),
    ).toMatchObject({ fontFamily: "Publisher Song" });
  });
});
