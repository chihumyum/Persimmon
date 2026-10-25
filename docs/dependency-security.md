# Dependency security review

Reviewed: 2026-10-26

Run the production dependency audit with:

```bash
pnpm audit --prod
```

The lockfile applies narrow overrides for patched releases of `@xmldom/xmldom`,
`brace-expansion`, `compression`, `js-yaml`, `nanoid`, `postcss`, `shell-quote`,
`source-map-js`, `uuid`, and `vite`. These packages are transitive dependencies
of Expo's development and build tooling, React Native's DevTools integration, or
Vitest, and none of them is in the exported app bundles. The `uuid` override
moves the version used by `xcode` from 7.0.3 to the patched 11.1.1 release;
`xcode` uses its compatible `v4()` API. The overrides are covered by the normal
verification and bundle gates.

The EPUB importer uses `@xmldom/xmldom` 0.9.12 directly. This replaces 0.9.10
with fixes for malformed-XML denial of service and serialization validation.
Expo's plist tooling uses patched 0.8.15 or 0.9.12; `js-yaml` is pinned to
4.3.2.

Vitest 4 replaces the Vitest 3 worker pool and `vite-node`, so `tinypool` is no
longer installed. This resolves the Tinypool prototype pollution advisories
GHSA-5gmw-xhrv-c9v3 and GHSA-85c8-ppgw-ccpr and the `@vitest/mocker` advisories
GHSA-82fw-gwwq-j7x9 and GHSA-qxg6-89mg-rqv8. Vitest and Vite run only in local
and CI test jobs.

## Remaining Expo CLI advisories

Two high-severity advisories remain in dependencies of `@expo/cli`, reached
through `expo -> @expo/cli`. Dependabot labels them runtime because `expo` is a
production dependency, but the CLI runs only on developer machines and build
hosts for `expo start`, `expo export`, and `expo run`. Source-mapped iOS and
Android `expo export` bundles contain neither package; the only `@expo/cli` file
in them is Metro's module runtime, `build/metro-require/require.js`.

- `zod` 3.25.76, GHSA-mrhx-c7xc-m3w5: array validation records an issue for
  every failing element and can exhaust memory. The fix is only in Zod 4.6.6;
  3.25.76 is the last 3.x release and `@expo/cli` requires `^3.25.76`, so an
  override would replace the Zod 3 API that the CLI is written against. The CLI
  uses Zod to validate dev tools plugin manifests from installed packages and
  MCP dev tools extension schemas.
- `node-forge` 1.4.0, GHSA-86w9-cpqp-85rv: RSA PKCS#1 v1.5 signature
  verification accepts extra nested DigestAlgorithm elements. No patched release
  exists; 1.4.0 is the latest version. The CLI uses node-forge to read Apple
  signing certificates for `expo run:ios` and, through
  `@expo/code-signing-certificates`, to sign and verify expo-updates development
  manifests when a client sends `expo-expect-signature`. Persimmon does not
  install `expo-updates` or configure `updates.codeSigningCertificate`.

At this review, the newest Expo 57 patch release, `expo` 57.0.31 with
`@expo/cli` 57.0.32, still requires `zod` `^3.25.76` and `node-forge` `^1.3.3`,
so following the `expo-sdk-drift` issue does not clear either advisory.
Re-review when Expo moves the CLI to Zod 4 or node-forge publishes a fix. Until
then these are open build tool findings, not a clean dependency audit.

## Remaining router dependency advisory

`decode-uri-component` 0.2.2 remains a transitive runtime dependency through
`expo-router -> query-string`. GHSA-vcc3-ghjq-m6fr reports excessive work for
malformed percent-encoded input. The patched 0.5.0 package is ESM, while this
version of `query-string` loads it as a CommonJS function, so a version override
alone is not a compatible fix. This is the only advisory package in the exported
app bundle, where `expo-router` uses `query-string` to convert navigation state
to and from URL paths, including `persimmon://` deep links. At this review,
`query-string` 7.1.3 is the last 7.x release and `expo-router` 57.0.29, the
newest Expo 57 router, still requires `query-string` `^7.1.3`. Track an upstream
router/query-string update or a separately tested backport. Do not classify this
remaining moderate finding as build-tool-only or claim a clean dependency audit.

## Locally mitigated upstream issue

The original audit reported two high-severity denial-of-service advisories for
`image-size`, reached through `expo -> @expo/metro -> metro -> image-size`:

- GHSA-w3rx-r6r6-pgpr: malformed ICNS input can loop indefinitely.
- GHSA-5p2g-fcmc-qvqq: malformed JXL or HEIF input can loop indefinitely.

At the original review date, the advisory data listed no patched `image-size`
release. Persimmon therefore patches 1.2.1 locally so the ICNS, HEIF,
containerized JXL, and JXL codestream handlers are not registered or called.
Metro does not support those formats as repository asset extensions, and
Persimmon has no tracked files using them. `scripts/image-size-security.test.ts`
runs crafted inputs in bounded child processes to verify that the disabled
formats are rejected rather than parsed.

The package is used by the Metro build pipeline rather than Persimmon's runtime
EPUB importer, and ordinary EPUB files are not passed to it. The version-based
audit may report those advisories independently of the local mitigation; the
local patch and regression test are the mitigation. Re-review and prefer an
upstream release whenever Expo or Metro changes, and before giving an untrusted
workflow access to secrets or privileged infrastructure.
