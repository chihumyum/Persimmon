# MVP acceptance evidence

This document keeps automated checks, historical physical-device evidence, and
release acceptance separate. It must not be read as a promise that every commit
has been installed and retested on hardware.

## Automated gate

The repository gate is:

```bash
pnpm verify
```

It checks:

| Area            | Command or behavior                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Formatting      | Prettier check across the main repository, excluding generated files and the independently maintained submodule |
| Static analysis | ESLint and TypeScript across application and workspace packages                                                 |
| Behavior        | Vitest unit and integration tests                                                                               |
| Expo health     | Expo Doctor dependency and project checks                                                                       |
| Bundling        | Production JavaScript exports for iOS and Android                                                               |

GitHub Actions runs the same gate for pull requests and pushes to `main` without
repository secrets. The public page-turn project is cloned as an ordinary HTTPS
submodule.

## Private EPUB corpus

Maintainers may additionally run:

```bash
pnpm test:epubs
```

It scans the ignored `epubs-for-test/` directory. The corpus contains a mix of
languages, book sizes, images, navigation formats, and imperfect publisher
markup, but its copyrighted files and reading-library inventory are not project
fixtures and are never required for contributors or CI.

Warnings from corpus validation are explicit recovery outcomes, not silent
success. Typical accepted warnings include a missing navigation fragment that
falls back to a section start, an empty section that is skipped, or an image
reference absent from the manifest.

## Historical native-device sign-off

On 2026-08-03, the maintainer reported that the then-current iOS and Android
builds passed the following physical-device scenarios. Raw Instruments and
Android Studio traces were not committed, so this is historical maintainer
evidence rather than a reproducible check for current `main`.

- First launch, permissions, file selection, and language overrides.
- Import of text-heavy and image-containing reflowable EPUBs.
- Library search, filtering, settings, native menus, export, and deletion.
- Table-of-contents navigation and overlay/back behavior.
- Repeated taps, drag completion, drag cancellation, and position stability
  through typography changes.
- Background/foreground transitions, forced relaunch, rotation, and safe areas.
- Local data deletion without accidental Google Drive deletion, and the inverse.
- Two-device Google Drive book and progress convergence for the test accounts
  available at that time.
- No observed sustained memory growth or obvious page-turn long-frame problem on
  the devices used.

This sign-off does not cover later dependency updates, current OAuth publishing
status, production signing, store review, or the exact APK currently offered for
download.

## Release acceptance

An Android or iOS release is accepted only when the exact signed artifact is
verified and installed after the source gate. Follow
[release-checklist.md](release-checklist.md) and record the artifact checksum,
source commit, platform, build type, and device scenarios separately.

## Outside the current MVP

- DRM and fixed-layout EPUB.
- PDF, MOBI, book scripts, MathML, complex SVG/table layout, and full browser
  CSS.
- Persistent highlights and annotations.
- Claims of App Store or Google Play availability before those stores actually
  accept and distribute the application.
