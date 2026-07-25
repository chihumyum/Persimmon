import { describe, expect, it } from "vitest";
import { strToU8, zipSync, type Zippable } from "fflate";

import { EpubImportError, importEpub } from "./index";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

interface EpubFixtureOptions {
  packagePath?: string;
  packageXml: string;
  resources?: Record<string, Uint8Array | string>;
  extraEntries?: Record<string, Uint8Array | string>;
}

function fixtureBytes({
  packagePath = "EPUB/package.opf",
  packageXml,
  resources = {},
  extraEntries = {},
}: EpubFixtureOptions): Uint8Array {
  const entries: Zippable = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
      <container
        xmlns="urn:oasis:names:tc:opendocument:xmlns:container"
        version="1.0"
      >
        <rootfiles>
          <rootfile
            full-path="${packagePath}"
            media-type="application/oebps-package+xml"
          />
        </rootfiles>
      </container>`),
    [packagePath]: strToU8(packageXml),
  };

  for (const [path, value] of Object.entries({
    ...resources,
    ...extraEntries,
  })) {
    entries[path] = typeof value === "string" ? strToU8(value) : value;
  }

  return zipSync(entries);
}

function minimalPackage(
  chapterHref = "chapter.xhtml",
  extraManifest = "",
  metadata = "",
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
      <metadata
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:opf="http://www.idpf.org/2007/opf"
      >
        <dc:identifier>urn:persimmon:test</dc:identifier>
        <dc:title>柿子试读</dc:title>
        <dc:creator>柿子作者</dc:creator>
        <dc:language>zh-CN</dc:language>
        ${metadata}
      </metadata>
      <manifest>
        <item id="chapter" href="${chapterHref}" media-type="application/xhtml+xml"/>
        ${extraManifest}
      </manifest>
      <spine page-progression-direction="ltr">
        <itemref idref="chapter"/>
      </spine>
    </package>`;
}

function expectImportError(
  operation: () => unknown,
  code: EpubImportError["code"],
): void {
  try {
    operation();
    throw new Error("Expected import to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(EpubImportError);
    expect((error as EpubImportError).code).toBe(code);
  }
}

describe("importEpub", () => {
  it("imports a minimal reflowable EPUB into valid BookIR", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(
        "chapter.xhtml",
        '<item id="cover" href="images/cover.png" media-type="image/png"/>',
      ),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <head><title>第一节</title></head>
            <body>
              <h1 id="opening">第一章</h1>
              <p id="paragraph">这是一颗柿子。</p>
              <img id="cover-image" src="images/cover.png" alt="一颗柿子"/>
            </body>
          </html>`,
        "EPUB/images/cover.png": PNG_BYTES,
      },
    });

    const result = importEpub(bytes);

    expect(result.book).toMatchObject({
      schemaVersion: 1,
      title: "柿子试读",
      language: "zh-CN",
      sections: [
        {
          id: "epub-section:chapter",
          title: "第一章",
        },
      ],
      assets: {
        "epub-asset:cover": {
          id: "epub-asset:cover",
          mediaType: "image/png",
          byteLength: PNG_BYTES.byteLength,
        },
      },
    });
    expect(result.metadata).toEqual({
      identifier: "urn:persimmon:test",
      author: "柿子作者",
      pageProgressionDirection: "ltr",
    });
    expect(result.book.sections[0].blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "image",
    ]);
    expect(result.resources["epub-asset:cover"]).toEqual(PNG_BYTES);
    expect(result.warnings).toEqual([]);
  });

  it("resolves a nested OPF and preserves inline marks and line breaks", () => {
    const packagePath = "EPUB/package/content.opf";
    const bytes = fixtureBytes({
      packagePath,
      packageXml: minimalPackage("../text/chapter.xhtml"),
      resources: {
        "EPUB/text/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <p id="marked">
                Plain <strong>strong <em>both</em></strong><br/>tail
              </p>
            </body>
          </html>`,
      },
    });

    const result = importEpub(bytes);
    const block = result.book.sections[0].blocks[0];

    expect(block).toMatchObject({
      kind: "paragraph",
      source: {
        scheme: "epub",
        documentId: "EPUB/text/chapter.xhtml",
        elementId: "marked",
      },
      runs: [
        { text: "Plain " },
        { text: "strong ", marks: ["strong"] },
        { text: "both", marks: ["strong", "emphasis"] },
        { text: "\ntail" },
      ],
    });
  });

  it("applies the safe EPUB author-style whitelist and skips hidden content", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(
        "chapter.xhtml",
        '<item id="style" href="book.css" media-type="text/css"/>',
      ),
      resources: {
        "EPUB/book.css": `
          p.lead {
            text-align: justify;
            margin: 1em 0 2em;
          }
          .bold { font-weight: bold; }
          .hidden { display: none; }
        `,
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <head><link rel="stylesheet" href="book.css"/></head>
            <body>
              <p class="lead">Styled <span class="bold">text</span></p>
              <p class="hidden">Must not be imported</p>
              <p style="text-align: center; font-style: italic">Centered</p>
            </body>
          </html>`,
      },
    });

    const result = importEpub(bytes);
    const blocks = result.book.sections[0].blocks;

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: "paragraph",
      style: {
        textAlign: "justify",
        marginBeforeEm: 1,
        marginAfterEm: 2,
      },
      runs: [{ text: "Styled " }, { text: "text", marks: ["strong"] }],
    });
    expect(blocks[1]).toMatchObject({
      kind: "paragraph",
      style: {
        textAlign: "center",
        fontStyle: "italic",
      },
    });
  });

  it("keeps repeated spine entries with deterministic occurrence ids", () => {
    const packageXml = minimalPackage().replace(
      '<itemref idref="chapter"/>',
      '<itemref idref="chapter"/><itemref idref="chapter"/>',
    );
    const bytes = fixtureBytes({
      packageXml,
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body><p>Repeated chapter</p></body>
          </html>`,
      },
    });

    const result = importEpub(bytes);

    expect(result.book.sections.map((section) => section.id)).toEqual([
      "epub-section:chapter",
      "epub-section:chapter:occurrence:2",
    ]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "duplicate-spine-item-recovered",
        context: "chapter.xhtml",
      }),
    );
  });

  it("recovers malformed content XHTML without weakening package parsing", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <p id="before">Before</p
              <p id="after">After</p>
            </body>
          </html>`,
      },
    });

    const result = importEpub(bytes);
    const text = result.book.sections[0].blocks
      .flatMap((block) =>
        block.kind === "image" ? [] : block.runs.map((run) => run.text),
      )
      .join(" ");

    expect(text).toContain("Before");
    expect(text).toContain("After");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "malformed-xhtml-recovered",
        context: "EPUB/chapter.xhtml",
      }),
    );
  });

  it("imports an EPUB 3 nav document and cover image", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(
        "chapter.xhtml",
        `
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>
        `,
      ),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body><h1 id="opening">Opening</h1><p>Body</p></body>
          </html>`,
        "EPUB/nav.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml"
                xmlns:epub="http://www.idpf.org/2007/ops">
            <body>
              <nav epub:type="toc">
                <ol><li><a href="chapter.xhtml#opening">Opening</a></li></ol>
              </nav>
            </body>
          </html>`,
        "EPUB/cover.png": PNG_BYTES,
      },
    });

    const result = importEpub(bytes);

    expect(result.book.coverAssetId).toBe("epub-asset:cover");
    expect(result.resources["epub-asset:cover"]).toEqual(PNG_BYTES);
    expect(result.book.navigation).toEqual([
      {
        id: "epub-nav:1",
        label: "Opening",
        target: {
          sectionId: "epub-section:chapter",
          blockId: "epub-section:chapter:block:1",
          offset: 0,
        },
      },
    ]);
  });

  it("imports a nested EPUB 2 NCX table of contents", () => {
    const bytes = fixtureBytes({
      packageXml: `<?xml version="1.0" encoding="utf-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="2.0">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>EPUB 2 book</dc:title>
          </metadata>
          <manifest>
            <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
            <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          </manifest>
          <spine toc="ncx"><itemref idref="chapter"/></spine>
        </package>`,
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <h1 id="chapter">Chapter</h1>
              <h2 id="part">Part</h2>
            </body>
          </html>`,
        "EPUB/toc.ncx": `<?xml version="1.0"?>
          <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
            <navMap>
              <navPoint id="chapter">
                <navLabel><text>Chapter</text></navLabel>
                <content src="chapter.xhtml#chapter"/>
                <navPoint id="part">
                  <navLabel><text>Part</text></navLabel>
                  <content src="chapter.xhtml#part"/>
                </navPoint>
              </navPoint>
            </navMap>
          </ncx>`,
      },
    });

    const result = importEpub(bytes);

    expect(result.book.navigation?.[0]).toMatchObject({
      label: "Chapter",
      target: {
        sectionId: "epub-section:chapter",
        blockId: "epub-section:chapter:block:1",
      },
      children: [
        {
          label: "Part",
          target: {
            sectionId: "epub-section:chapter",
            blockId: "epub-section:chapter:block:2",
          },
        },
      ],
    });
  });

  it("rejects malformed package XML", () => {
    const bytes = fixtureBytes({
      packageXml:
        '<package xmlns="http://www.idpf.org/2007/opf"><metadata></package>',
    });

    expectImportError(() => importEpub(bytes), "malformed-xml");
  });

  it("rejects fixed-layout EPUB publications", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(
        "chapter.xhtml",
        "",
        '<meta property="rendition:layout">pre-paginated</meta>',
      ),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body><p>Fixed</p></body>
          </html>`,
      },
    });

    expectImportError(() => importEpub(bytes), "unsupported-fixed-layout");
  });

  it("rejects path traversal entries before extracting content", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body><p>Safe</p></body>
          </html>`,
      },
      extraEntries: {
        "../escape.xhtml": "<p>unsafe</p>",
      },
    });

    expectImportError(() => importEpub(bytes), "unsafe-archive-path");
  });

  it("enforces archive entry limits", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body><p>Safe</p></body>
          </html>`,
      },
    });

    expectImportError(
      () => importEpub(bytes, { limits: { maxEntries: 2 } }),
      "archive-limit-exceeded",
    );
  });
});
