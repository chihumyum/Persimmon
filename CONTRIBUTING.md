# Contributing to Persimmon

Focused contributions are welcome. The maintainer controls the roadmap and
reviews issues and pull requests on a best-effort basis, without a response-time
commitment.

## Before opening a pull request

1. Discuss broad product changes in an issue before implementing them.
2. Keep each pull request narrow and explain its user-visible effect.
3. Do not commit copyrighted books, private EPUB files, credentials, signing
   material, generated native projects, APKs, IPAs, or other release artifacts.
4. Add tests for behavior that can be verified without a physical device.
5. Preserve the local-first data model and treat EPUB contents as untrusted.

## Development setup

Use Node.js 22.23.1 and pnpm 10.17.1:

```bash
git clone --recurse-submodules https://github.com/chihumyum/Persimmon.git
cd Persimmon
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` is the required automated gate. Device-specific changes should
also include a short manual test record naming the platform, build type, and
scenario exercised. Publishing credentials and the maintainer's private EPUB
corpus are never required for a contribution.

## Licensing

By submitting a contribution, you agree that it may be distributed under the
repository's Apache License 2.0. No contributor license agreement is required.
The Persimmon brand policy remains separate from the source-code license.
