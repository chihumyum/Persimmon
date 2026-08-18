# Dependency security review

Reviewed: 2026-08-19

Run the production dependency audit with:

```bash
pnpm audit --prod
```

The lockfile applies narrow overrides for patched releases of `brace-expansion`,
`js-yaml`, `nanoid`, and `postcss`. These packages are transitive dependencies
of Expo's development and build tooling; the overrides stay within the API line
consumed by the parent package and are covered by the normal verification and
bundle gates.

## Accepted upstream issue

The audit currently reports two high-severity denial-of-service advisories for
`image-size`, reached through `expo -> @expo/metro -> metro -> image-size`:

- GHSA-w3rx-r6r6-pgpr: malformed ICNS input can loop indefinitely.
- GHSA-5p2g-fcmc-qvqq: malformed JXL or HEIF input can loop indefinitely.

At the review date, the advisory data lists no patched `image-size` release. The
package is used by the Metro build pipeline rather than Persimmon's runtime EPUB
importer, and ordinary EPUB files are not passed to it. A malicious pull request
could add a crafted repository image and consume a hosted build job; the public
Verify workflow has no secrets, a read-only token, first-contributor approval,
and a 20-minute job timeout to bound that exposure.

This is a documented temporary acceptance, not a statement that the advisory is
fixed. Remove the acceptance and upgrade as soon as Expo/Metro resolves to a
patched release. Re-review it whenever Expo or Metro changes and before giving
an untrusted workflow access to secrets or privileged infrastructure.

Moderate findings in build tooling are reviewed separately and do not imply that
vulnerable code is shipped in the native application bundle. They should still
be upgraded through compatible Expo releases or narrow tested overrides when
available.
