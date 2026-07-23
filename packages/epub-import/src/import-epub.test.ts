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

    expectImportError(
      () => importEpub(bytes),
      "unsupported-fixed-layout",
    );
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
