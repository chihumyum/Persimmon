# Persimmon

Persimmon (柿子) is a lightweight, native-rendered EPUB reader focused on
excellent typography, instant interaction, and a future review workflow with
Drifting.

The reading core intentionally does not use a WebView. EPUB content is compiled
into a versioned TypeScript `BookIR`, laid out with Skia Paragraph, and rendered
with React Native Skia on iOS, Android, and the web.

See [docs/architecture.md](docs/architecture.md) for the rendering invariants,
package boundaries, and next milestones.

## Workspace

- `apps/persimmon`: Expo application for iOS, Android, and web.
- `packages/book-core`: versioned BookIR, stable locators, and validation.
- `packages/epub-import`: bounded EPUB ZIP/XML/XHTML compilation into BookIR.
- `packages/layout`: paragraph layout, pagination, and page scenes.
- `packages/reader-skia`: live SkParagraph layout and Skia page rendering.

## First working slice

- A local bookshelf with a built-in Chinese/English sample.
- Reflowable EPUB import with archive limits and path traversal protection.
- Live SkParagraph pagination; pages never become screenshots.
- Rapid page input coalesced into one desired target instead of a FIFO queue.
- A short slide transition rendered from two live page scenes.
- Font-size repagination anchored to a stable BookIR text position.
- Local bookshelf and reading-position persistence.

Web bundles one complete Noto Serif SC weight because CanvasKit cannot read
browser system fonts. The reader surface and its 15 MB CJK font are lazy-loaded
only after a book is opened.

## Development

Use Node 22 LTS. Node 24 currently triggers an upstream V8 crash while pnpm
verifies Skia's large platform packages.

```bash
corepack enable
pnpm install
pnpm dev:web
```

Validation:

```bash
pnpm typecheck
pnpm test
pnpm build:web
```

## Initial scope

The first release targets reflowable, novel-style EPUB files. Fixed-layout
books, scripts, MathML, and browser-level CSS compatibility are deliberately
outside the first milestone. EPUB images currently keep their layout position
as placeholders; decoding and cached image rendering is the next media step.
