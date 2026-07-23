# Persimmon

Persimmon (柿子) is a lightweight, native-rendered EPUB reader focused on
excellent typography, instant interaction, and a future review workflow with
Drifting.

The reading core intentionally does not use a WebView. EPUB content is compiled
into a versioned TypeScript `BookIR`, laid out with Skia Paragraph, and rendered
with React Native Skia on iOS, Android, and the web.

## Workspace

- `apps/persimmon`: Expo application for iOS, Android, and web.
- `packages/book-core`: BookIR, locators, annotations, and EPUB importing.
- `packages/layout`: paragraph layout, pagination, and page scenes.
- `packages/reader-skia`: Skia page and turn rendering.

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
outside the first milestone.
