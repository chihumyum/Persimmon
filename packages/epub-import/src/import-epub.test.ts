import { describe, expect, it } from "vitest";
import { strToU8, zipSync, type Zippable } from "fflate";

import { EpubImportError, importEpub } from "./index";
import {
  deobfuscateIdpfFont,
  IDPF_FONT_OBFUSCATION_ALGORITHM,
  idpfFontObfuscationKey,
} from "./font-obfuscation";

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

  it("drops styled whitespace before a line break without emitting an empty run", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <p>left<em> </em><br/>right</p>
            </body>
          </html>`,
      },
    });

    const result = importEpub(bytes);
    const block = result.book.sections[0].blocks[0];

    expect(block).toMatchObject({
      kind: "paragraph",
      runs: [{ text: "left\nright" }],
    });
  });

  it("binds an empty fragment anchor to the next readable block", () => {
    const bytes = fixtureBytes({
      packageXml: minimalPackage(),
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <p><a href="#note-1">1</a></p>
              <div><a id="note-1"/></div>
              <p>Footnote body</p>
            </body>
          </html>`,
      },
    });

    const result = importEpub(bytes);
    const [referenceBlock, footnoteBlock] = result.book.sections[0].blocks;
    const referenceRun =
      referenceBlock?.kind === "paragraph" ? referenceBlock.runs[0] : undefined;

    expect(referenceRun?.link?.target).toEqual({
      sectionId: result.book.sections[0].id,
      blockId: footnoteBlock?.id,
      offset: 0,
    });
    expect(
      result.warnings.filter(
        (warning) => warning.code === "internal-link-skipped",
      ),
    ).toEqual([]);
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

  it("preserves explicitly assigned embedded fonts and deobfuscates IDPF resources", () => {
    const originalFont = Uint8Array.from(
      { length: 1200 },
      (_, index) => (index * 17) % 251,
    );
    const identifier = "urn:persimmon:font-test";
    const obfuscatedFont = deobfuscateIdpfFont(
      originalFont,
      idpfFontObfuscationKey(identifier),
    );
    const packageXml = minimalPackage(
      "chapter.xhtml",
      `
        <item id="style" href="styles/book.css" media-type="text/css"/>
        <item id="publisher-font" href="fonts/publisher.ttf" media-type="font/ttf"/>
        <item id="unused-font" href="fonts/unused.ttf" media-type="font/ttf"/>
      `,
    )
      .replace("<package ", '<package unique-identifier="pub-id" ')
      .replace("<dc:identifier>", '<dc:identifier id="pub-id">')
      .replace("urn:persimmon:test", identifier);
    const bytes = fixtureBytes({
      packageXml,
      resources: {
        "EPUB/styles/book.css": `
          @font-face {
            font-family: "Publisher Serif";
            src: url("../fonts/publisher.ttf") format("truetype");
          }
          @font-face {
            font-family: "Unused Font";
            src: url("../fonts/unused.ttf") format("truetype");
          }
          .publisher { font-family: "Publisher Serif", serif; }
          .reader { font-family: serif; }
        `,
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <head><link rel="stylesheet" href="styles/book.css"/></head>
            <body>
              <p class="publisher">Publisher <span class="reader">Reader</span></p>
              <p>Default reader font</p>
            </body>
          </html>`,
        "EPUB/fonts/publisher.ttf": obfuscatedFont,
        "EPUB/fonts/unused.ttf": originalFont,
      },
      extraEntries: {
        "META-INF/encryption.xml": `<?xml version="1.0"?>
          <encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"
            xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
            <enc:EncryptedData>
              <enc:EncryptionMethod Algorithm="${IDPF_FONT_OBFUSCATION_ALGORITHM}"/>
              <enc:CipherData>
                <enc:CipherReference URI="EPUB/fonts/publisher.ttf"/>
              </enc:CipherData>
            </enc:EncryptedData>
          </encryption>`,
      },
    });

    const result = importEpub(bytes);
    expect(Object.values(result.book.fontFamilies ?? {})).toHaveLength(1);
    const family = Object.values(result.book.fontFamilies ?? {})[0];
    expect(family).toMatchObject({
      cssFamily: "Publisher Serif",
      faces: [
        {
          resourceId: "epub-font:publisher-font",
          mediaType: "font/ttf",
          weight: 400,
          style: "normal",
        },
      ],
    });
    const firstBlock = result.book.sections[0]?.blocks[0];
    expect(firstBlock?.kind === "paragraph" ? firstBlock.runs : []).toEqual([
      {
        text: "Publisher ",
        bookFontFamilyId: family?.id,
      },
      { text: "Reader" },
    ]);
    const secondBlock = result.book.sections[0]?.blocks[1];
    expect(
      secondBlock?.kind === "paragraph" ? secondBlock.runs[0] : undefined,
    ).toEqual({ text: "Default reader font" });
    expect(result.resources["epub-font:publisher-font"]).toEqual(originalFont);
    expect(result.resources["epub-font:unused-font"]).toBeUndefined();
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

  it("compiles footnotes, endnotes, and backlinks into stable positions", () => {
    const bytes = fixtureBytes({
      packageXml: `<?xml version="1.0" encoding="utf-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Notes</dc:title>
          </metadata>
          <manifest>
            <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
            <item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine>
            <itemref idref="chapter"/>
            <itemref idref="notes"/>
          </spine>
        </package>`,
      resources: {
        "EPUB/chapter.xhtml": `<?xml version="1.0"?>
          <html
            xmlns="http://www.w3.org/1999/xhtml"
            xmlns:epub="http://www.idpf.org/2007/ops"
          >
            <body>
              <p>
                Body<a id="ref-foot" href="#fn-one" epub:type="noteref">1</a>
              </p>
              <aside id="fn-one" epub:type="footnote">
                <p>
                  <a href="#ref-foot" role="doc-backlink">1</a> Footnote text.
                  <a href="#ref-end">See the endnote reference</a>
                </p>
              </aside>
              <p>
                More<sup><a id="ref-end" class="endnote-ref" href="notes.xhtml#en-one">2</a></sup>
              </p>
            </body>
          </html>`,
        "EPUB/notes.xhtml": `<?xml version="1.0"?>
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <section role="doc-endnotes">
                <h1>Notes</h1>
                <ol>
                  <li id="en-one">
                    <p><a href="chapter.xhtml#ref-end" role="doc-backlink">2</a> Endnote text.</p>
                  </li>
                </ol>
              </section>
            </body>
          </html>`,
      },
    });

    const result = importEpub(bytes);
    const chapter = result.book.sections[0]!;
    const notes = result.book.sections[1]!;
    const footnoteBlock = chapter.blocks[1];
    const endnoteBlock = notes.blocks[1];
    const footnoteReference =
      chapter.blocks[0]?.kind === "paragraph"
        ? chapter.blocks[0].runs.find((run) => run.link)
        : undefined;
    const endnoteReference =
      chapter.blocks[2]?.kind === "paragraph"
        ? chapter.blocks[2].runs.find((run) => run.link)
        : undefined;

    expect(footnoteReference).toMatchObject({
      text: "¹",
      verticalAlign: "superscript",
      link: {
        kind: "note-reference",
        noteKind: "footnote",
        label: "1",
        target: {
          sectionId: chapter.id,
          blockId: footnoteBlock?.id,
          offset: 0,
        },
      },
    });
    expect(footnoteBlock).toMatchObject({ noteKind: "footnote" });
    expect(endnoteReference).toMatchObject({
      text: "²",
      verticalAlign: "superscript",
      link: {
        kind: "note-reference",
        noteKind: "endnote",
        label: "2",
        target: {
          sectionId: notes.id,
          blockId: endnoteBlock?.id,
          offset: 0,
        },
      },
    });
    expect(endnoteBlock).toMatchObject({ noteKind: "endnote" });

    const footnoteBacklink =
      footnoteBlock?.kind === "paragraph"
        ? footnoteBlock.runs.find((run) => run.link)
        : undefined;
    const endnoteBacklink =
      endnoteBlock?.kind === "paragraph"
        ? endnoteBlock.runs.find((run) => run.link)
        : undefined;
    expect(footnoteBacklink?.link).toMatchObject({
      kind: "note-backlink",
      noteKind: "footnote",
      target: { sectionId: chapter.id, blockId: chapter.blocks[0]?.id },
    });
    expect(
      footnoteBlock?.kind === "paragraph"
        ? footnoteBlock.runs.find((run) => run.link?.kind === "internal")?.link
        : undefined,
    ).toMatchObject({
      kind: "internal",
      target: { sectionId: chapter.id, blockId: chapter.blocks[2]?.id },
    });
    expect(endnoteBacklink?.link).toMatchObject({
      kind: "note-backlink",
      noteKind: "endnote",
      target: { sectionId: chapter.id, blockId: chapter.blocks[2]?.id },
    });
    expect(result.warnings).toEqual([]);
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
