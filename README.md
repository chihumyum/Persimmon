# Persimmon

<p align="right"><a href="./README.zh-CN.md">简体中文</a></p>

<p align="center"><em>Read. Nothing else.</em></p>

Persimmon is a local-first EPUB reader for iOS and Android. It compiles
reflowable EPUB books into a platform-independent document model, paginates them
without a WebView, and renders the result with React Native Skia.

Download the Android APK from this repository's
[Releases](https://github.com/chihumyum/Persimmon/releases) or the
[Persimmon website](https://persimmon.cc). For iOS, follow the website's App
Store link.

## Why Persimmon

- **A focused reading surface.** The interface leaves room for the book instead
  of surrounding it with social features, ads, or unrelated tools.
- **Page turns tuned for touch.** The animation follows the gesture, stays fluid
  through repeated swipes, and supports quickly thumbing backward through pages.
- **Free cloud sync.** Keep books and reading progress synchronized across
  devices without a Persimmon subscription.

<p align="center">

https://github.com/user-attachments/assets/a7dd5166-b9cd-491d-8166-04f7361ee171

</p>

<p align="center">

https://github.com/user-attachments/assets/57c71d41-e69f-4fd6-9cf0-4000cb227ba9

</p>

## Interface

Real screens from Persimmon on iPhone, iPad, and Android.

<p align="center">
  <img src="./docs/media/library-google-drive-sync.png" width="30%" alt="Persimmon library with Google Drive sync" />
  &nbsp;
  <img src="./docs/media/reader-style-controls.png" width="30%" alt="Persimmon reading style controls" />
  &nbsp;
  <img src="./docs/media/android-settings-google-drive.jpg" width="30%" alt="Persimmon settings and Google Drive sync on Android" />
  <br />
  <sub>Library and sync · Reading controls · App settings</sub>
</p>

<p align="center">
  <img src="./docs/media/ipad-font-picker.png" width="90%" alt="Persimmon iPad reading view and font picker" />
  <br />
  <sub>iPad reading view and local font selection</sub>
</p>

## What works

- Import DRM-free, reflowable EPUB 2 and EPUB 3 books.
- Parse OPF, XHTML, NCX and navigation documents with bounded ZIP and content
  processing.
- Build a native local library with the original EPUB, metadata, cover,
  resources, and reading progress stored separately.
- Search, filter, and sort the library; inspect, export, sync, or delete books.
- Read with chapter-aware pagination, table-of-contents navigation, typography
  controls, themes, local fonts, and persistent positions.
- Render native Skia pages and an interactive, physically tuned page-turn
  animation.
- Synchronize books and progress across devices with free cloud sync.
- Use the interface in English, Simplified or Traditional Chinese, Japanese,
  Korean, German, French, Spanish, and Brazilian Portuguese.

Google Drive sync is implemented on both platforms, but access from distributed
builds also depends on the project's Google OAuth publishing and test-user
status. See [the sync guide](docs/google-drive-sync.md) before relying on it in
a custom build.

## Deliberate limits

Persimmon focuses on ordinary, reflowable books. It does not currently support
DRM, fixed-layout EPUB, PDF, MOBI, book scripts, MathML, browser-complete CSS,
or persistent highlights and annotations. EPUB content is treated as untrusted:
scripts are not executed and CSS is reduced to an explicit safe subset.

## Architecture

The data path is:

```text
EPUB archive -> versioned BookIR -> shared paginator -> PageScene -> native Skia
```

The workspace separates EPUB import, the platform-neutral book model, layout,
page-turn mechanics, Skia rendering, and the Expo application. The page-turn
renderer is included as the public
[`react-native-natural-page-turn`](https://github.com/chihumyum/react-native-natural-page-turn)
Git submodule.

See [architecture](docs/architecture.md),
[design system](docs/design-system.md), and
[page-turn integration](docs/page-turn-library.md) for more detail.

## Development

Requirements:

- Node.js 22.23.1
- pnpm 10.17.1 through Corepack
- Xcode for iOS native builds
- Android Studio and Android SDK for Android native builds

Clone the repository with its public submodule:

```bash
git clone --recurse-submodules https://github.com/chihumyum/Persimmon.git
cd Persimmon
corepack enable
pnpm install --frozen-lockfile
```

Start the Expo development server for a project-specific development build:

```bash
pnpm dev:native
```

Install native development builds with `pnpm native:ios:device` or
`pnpm native:android:device`. Expo Go is not supported.

## Verification

Run the same aggregate gate used by GitHub Actions:

```bash
pnpm verify
```

It checks formatting, lint, TypeScript, unit tests, Expo dependency and project
health, and production JavaScript bundles for both iOS and Android. Maintainers
also test a private EPUB corpus and signed builds, but neither private books nor
publishing credentials are required for normal development or pull requests.

Historical physical-device results are recorded in
[the MVP acceptance document](docs/mvp-acceptance.md). They are evidence for the
named revision and date, not a claim that every later commit has been retested
on hardware.

## Releases

`pnpm release:android` and `pnpm release:ios` build and verify production
artifacts but do not publish them. An existing signed Android APK can be checked
without changing GitHub or Cloudflare:

```bash
pnpm publish:android:apk -- --dry-run path/to/Persimmon.apk
```

A stable Android publication writes the same verified APK to this repository's
GitHub Releases and the stable Cloudflare R2 download. A GitHub prerelease never
replaces the stable R2 object. Publishing is maintainer-only and manually
dispatched.

## Contributing and security

Focused bug fixes, tests, accessibility improvements, and EPUB compatibility
work are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull
request. Use [GitHub Issues](https://github.com/chihumyum/Persimmon/issues) for
public bugs and feature proposals. Please follow [SECURITY.md](SECURITY.md) for
vulnerabilities instead of opening a public issue.

The maintainer controls the roadmap and reviews contributions on a best-effort
basis; there is no support or response-time commitment.

## License and brand

Source code and documentation are licensed under the
[Apache License 2.0](LICENSE), except for separately identified third-party
material and Persimmon brand assets. The Persimmon name, logo, application icon,
product screenshots, and trade dress are not granted under Apache-2.0. See
[TRADEMARKS.md](TRADEMARKS.md) and [NOTICE](NOTICE).

The root package remains marked `private` to prevent accidental npm publication;
that field does not restrict use under the repository license.
