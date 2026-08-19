# Dependency security review

Reviewed: 2026-08-19

Run the production dependency audit with:

```bash
pnpm audit --prod
```

The lockfile applies narrow overrides for patched releases of `brace-expansion`,
`js-yaml`, `nanoid`, `postcss`, and `uuid`. These packages are transitive
dependencies of Expo's development and build tooling. The `uuid` override moves
the version used by `xcode` from 7.0.3 to the patched 11.1.1 release; `xcode`
uses its compatible `v4()` API. The overrides are covered by the normal
verification and bundle gates.

## Locally mitigated upstream issue

The audit currently reports two high-severity denial-of-service advisories for
`image-size`, reached through `expo -> @expo/metro -> metro -> image-size`:

- GHSA-w3rx-r6r6-pgpr: malformed ICNS input can loop indefinitely.
- GHSA-5p2g-fcmc-qvqq: malformed JXL or HEIF input can loop indefinitely.

At the review date, the advisory data lists no patched `image-size` release.
Persimmon therefore patches 1.2.1 locally so the ICNS, HEIF, containerized JXL,
and JXL codestream handlers are not registered or called. Metro does not support
those formats as repository asset extensions, and Persimmon has no tracked files
using them. `scripts/image-size-security.test.ts` runs crafted inputs in bounded
child processes to verify that the disabled formats are rejected rather than
parsed.

The package is used by the Metro build pipeline rather than Persimmon's runtime
EPUB importer, and ordinary EPUB files are not passed to it. The version-based
audit still reports both advisories because upstream has not published a patched
version; the local patch and regression test are the mitigation. Re-review and
prefer an upstream release whenever Expo or Metro changes, and before giving an
untrusted workflow access to secrets or privileged infrastructure.
